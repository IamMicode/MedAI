// Second-factor hardening: single-use backup codes under concurrency, TOTP replay
// protection, and bounded attempts. REAL route code; MOCKED in-memory database
// whose operations yield so simultaneous requests interleave (each statement is
// atomic, as in Postgres). Real Postgres behaviour is not exercised.
const test = require('node:test');
const assert = require('node:assert/strict');
const speakeasy = require('speakeasy');
const bcrypt = require('bcrypt');
const { stub, stubRateLimits, serve, sign, table } = require('./helpers');

const secret = speakeasy.generateSecret({ length: 20 }).base32;
const codeAt = (offsetSteps = 0) => speakeasy.totp({ secret, encoding: 'base32', time: Date.now() / 1000 + offsetSteps * 30 });

const users = table([], { role: 'USER', plan: 'Free' }, { yield: 3 });
stub('db', { user: users, doctorProfile: table([]), passwordResetCode: table([]), $transaction: async (o) => Promise.all(o) });
stubRateLimits();
stub('passport', { passport: { authenticate: () => (req, res, next) => next() }, configurePassport() {} });

let srv, hashes;
const BACKUPS = ['BACKUP-AAAA', 'BACKUP-BBBB', 'BACKUP-CCCC'];
test.before(async () => {
  hashes = await Promise.all(BACKUPS.map(c => bcrypt.hash(c, 4)));
  srv = await serve([['/auth', require('../src/routes/auth')]]);
});
test.after(async () => { await srv.close(); });
test.beforeEach(() => {
  users.rows.length = 0;
  const base = { role: 'USER', dob: '1990-01-01', twoFactorEnabled: true, twoFactorSecret: secret, twoFactorAttempts: 0, twoFactorWindowEndsAt: null, twoFactorLastStep: null };
  users.rows.push(
    { ...base, id: 'u1', email: 'a@x.co', username: 'a', twoFactorBackupCodes: [...hashes] },
    { ...base, id: 'u2', email: 'b@x.co', username: 'b', twoFactorBackupCodes: [...hashes] }
  );
});
const row = (id) => users.rows.find(u => u.id === id);
const pending = (id) => sign({ id, pending2FA: true }, { expiresIn: '5m' });
const verify = (id, code) => srv.call('POST', '/auth/2fa/verify-login', { body: { pendingToken: pending(id), code } });

// ───────────── C. backup codes ─────────────
test('SAME backup code used by 4 simultaneous requests → exactly ONE session; code is gone afterwards', async () => {
  const rs = await Promise.all(Array.from({ length: 4 }, () => verify('u1', BACKUPS[0])));
  assert.equal(rs.filter(r => r.status === 200 && r.body.token).length, 1);
  assert.ok(rs.filter(r => r.status !== 200).every(r => r.status === 401));
  assert.equal(row('u1').twoFactorBackupCodes.length, 2);
  assert.equal((await verify('u1', BACKUPS[0])).status, 401, 'cannot be used again');
});

test('two DIFFERENT backup codes used at the same moment are both honoured and both consumed', async () => {
  const rs = await Promise.all([verify('u1', BACKUPS[0]), verify('u1', BACKUPS[1])]);
  assert.deepEqual(rs.map(r => r.status), [200, 200]);
  assert.equal(row('u1').twoFactorBackupCodes.length, 1);
  assert.equal((await verify('u1', BACKUPS[2])).status, 200, 'remaining recovery code still works');
});

test('recovery still works normally: each backup code once, others untouched', async () => {
  assert.equal((await verify('u1', BACKUPS[1])).status, 200);
  assert.equal(row('u1').twoFactorBackupCodes.length, 2);
  assert.equal((await verify('u1', BACKUPS[1])).status, 401);
  assert.equal((await verify('u1', BACKUPS[0])).status, 200);
});

// ───────────── C. TOTP replay ─────────────
test('a TOTP code cannot be replayed; an older step is refused; a NEWER step still works', async () => {
  const code = codeAt(0);
  assert.equal((await verify('u1', code)).status, 200);
  assert.equal((await verify('u1', code)).status, 401, 'same code again = replay');
  assert.equal((await verify('u1', codeAt(-1))).status, 401, 'older step than the last accepted one');
  assert.equal((await verify('u1', codeAt(1))).status, 200, 'a later step is a legitimate new code');
});

test('the SAME TOTP code submitted by 4 simultaneous requests → exactly ONE session', async () => {
  const code = codeAt(0);
  const rs = await Promise.all(Array.from({ length: 4 }, () => verify('u1', code)));
  assert.equal(rs.filter(r => r.status === 200).length, 1);
});

// ───────────── D. bounded attempts ─────────────
test('5 wrong codes, then even the CORRECT code is refused (429 + Retry-After); a fresh pendingToken does not help', async () => {
  for (let i = 0; i < 5; i++) assert.equal((await verify('u1', '00000' + i)).status, 401);
  const locked = await verify('u1', codeAt(0));
  assert.equal(locked.status, 429);
  assert.ok(Number(locked.headers.get('retry-after')) > 0);
  assert.equal(locked.body.token, undefined);
  assert.equal((await verify('u1', BACKUPS[0])).status, 429, 'backup codes are blocked too');
  assert.equal(row('u1').twoFactorBackupCodes.length, 3, 'a blocked attempt consumes nothing');
});

test('20 PARALLEL wrong guesses → only 5 are evaluated, the rest are 429 (no parallel bypass of the cap)', async () => {
  const rs = await Promise.all(Array.from({ length: 20 }, (_, i) => verify('u1', String(100000 + i))));
  assert.equal(rs.filter(r => r.status === 401).length, 5);
  assert.equal(rs.filter(r => r.status === 429).length, 15);
  assert.equal((await verify('u1', codeAt(0))).status, 429);
});

test('the lock is per ACCOUNT: another user is unaffected', async () => {
  for (let i = 0; i < 6; i++) await verify('u1', '00000' + i);
  assert.equal((await verify('u1', codeAt(0))).status, 429);
  assert.equal((await verify('u2', codeAt(0))).status, 200);
});

test('an outsider without a valid pendingToken cannot spend or lock anyone\'s attempts', async () => {
  for (let i = 0; i < 30; i++) {
    const forged = sign({ id: 'u1', pending2FA: true }, { expiresIn: '5m' }).slice(0, -3) + 'abc';
    assert.equal((await srv.call('POST', '/auth/2fa/verify-login', { body: { pendingToken: forged, code: '000000' } })).status, 401);
  }
  assert.equal(row('u1').twoFactorAttempts, 0);
  assert.equal((await verify('u1', codeAt(0))).status, 200, 'victim can still sign in');
});

test('the lock expires with its window; a successful verification resets the counter', async () => {
  for (let i = 0; i < 6; i++) await verify('u1', '00000' + i);
  assert.equal((await verify('u1', codeAt(0))).status, 429);
  row('u1').twoFactorWindowEndsAt = new Date(Date.now() - 1000);          // window over
  assert.equal((await verify('u1', codeAt(0))).status, 200);
  assert.equal(row('u1').twoFactorAttempts, 0);
  assert.equal(row('u1').twoFactorWindowEndsAt, null);
  for (let i = 0; i < 3; i++) await verify('u1', '00000' + i);            // 3 misses, then a success…
  assert.equal((await verify('u1', BACKUPS[0])).status, 200);
  for (let i = 0; i < 5; i++) assert.equal((await verify('u1', '11111' + i)).status, 401);   // …starts a fresh budget of 5
});

test('error messages are useful but reveal no secrets (no remaining-attempt counts, no code hints)', async () => {
  const wrong = await verify('u1', '123456');
  assert.equal(wrong.body.message, 'Incorrect code. Please try again.');
  for (let i = 0; i < 5; i++) await verify('u1', '654321');
  const locked = await verify('u1', '123456');
  assert.match(locked.body.message, /Too many incorrect codes/);
  assert.doesNotMatch(JSON.stringify(locked.body), /\d+ attempts?|remaining/i);
});
