// Regression tests for the 2FA bypass: Google OAuth (and the DOB step) must not
// hand out a session to an account with 2FA enabled before the second factor is
// verified. Google/OAuth itself is mocked (passport stub); speakeasy is real.
const test = require('node:test');
const assert = require('node:assert/strict');
const speakeasy = require('speakeasy');
const bcrypt = require('bcrypt');
const { stub, stubRateLimits, serve, sign, tokenFor, table, jwt } = require('./helpers');

const secret = speakeasy.generateSecret({ length: 20 }).base32;
const totp = () => speakeasy.totp({ secret, encoding: 'base32' });

const users = table([], { role: 'USER', plan: 'Free' });
const doctorProfiles = table([]);
const baseFindUnique = users.findUnique;
users.findUnique = async (args) => {                      // emulate `include: { doctorProfile: true }`
  const u = await baseFindUnique(args);
  return u && args.include?.doctorProfile ? { ...u, doctorProfile: doctorProfiles.rows.find(p => p.userId === u.id) || null } : u;
};
stub('db', { user: users, doctorProfile: doctorProfiles, passwordResetCode: table([]), $transaction: async (o) => Promise.all(o) });
stubRateLimits();
let googleResult = { user: null, info: null };
stub('passport', {
  passport: { authenticate: (n, o, cb) => (req, res, next) => cb ? cb(null, googleResult.user, googleResult.info) : next() },
  configurePassport() {}
});
const { requireAuth } = require('../src/middleware/auth');
const probe = require('express').Router().get('/', requireAuth, (req, res) => res.json({ ok: true, id: req.user.id }));

let srv, backupHash;
test.before(async () => {
  backupHash = await bcrypt.hash('BACKUP-1111', 4);
  srv = await serve([['/auth', require('../src/routes/auth')], ['/api/doctors', require('../src/routes/doctors')], ['/probe', probe]]);
});
test.after(async () => { await srv.close(); });
test.beforeEach(async () => {
  users.rows.length = 0; doctorProfiles.rows.length = 0;
  users.rows.push(
    { id: 'mfa', email: 'mfa@x.co', username: 'mfa', role: 'USER', dob: '1990-01-01', twoFactorEnabled: true, twoFactorSecret: secret, twoFactorBackupCodes: [backupHash], password: await bcrypt.hash('passw0rd!', 4) },
    { id: 'mfa-nodob', email: 'mn@x.co', username: 'mn', role: 'USER', dob: null, twoFactorEnabled: true, twoFactorSecret: secret, twoFactorBackupCodes: [], password: await bcrypt.hash('passw0rd!', 4) },
    { id: 'plain', email: 'plain@x.co', username: 'plain', role: 'USER', dob: '1990-01-01', twoFactorEnabled: false, password: await bcrypt.hash('passw0rd!', 4) },
    { id: 'plain-nodob', email: 'pn@x.co', username: 'pn', role: 'USER', dob: null, twoFactorEnabled: false, password: await bcrypt.hash('passw0rd!', 4) },
    { id: 'doc', email: 'doc@x.co', username: 'doc', role: 'DOCTOR', twoFactorEnabled: true, twoFactorSecret: secret, twoFactorBackupCodes: [], password: await bcrypt.hash('passw0rd!', 4) }
  );
  doctorProfiles.rows.push({ userId: 'doc', verificationStatus: 'APPROVED', fullName: 'Dr Doc', specialty: 'GP' });
});
const fragment = (loc, key) => new URLSearchParams(new URL(loc, 'http://x').hash.slice(1)).get(key);
const asUser = (id) => users.rows.find(u => u.id === id);

// ───────────── Google OAuth ─────────────
test('Google callback for a 2FA account issues NO session — only a 2FA step', async () => {
  googleResult = { user: asUser('mfa'), info: null };
  const r = await srv.call('GET', '/auth/google/callback');
  assert.equal(r.status, 302);
  const loc = r.headers.get('location');
  assert.match(loc, /Login_page\.html#google_2fa=/);
  assert.doesNotMatch(loc, /[?&]token=/, 'no session token in the redirect');
  assert.doesNotMatch(loc, /dashboard\.html|admin\.html/);
});
test('the temporary Google 2FA token cannot call ANY protected route', async () => {
  googleResult = { user: asUser('mfa'), info: null };
  const pending = fragment((await srv.call('GET', '/auth/google/callback')).headers.get('location'), 'google_2fa');
  assert.ok(pending);
  assert.equal((await srv.call('GET', '/probe', { token: pending })).status, 401);
});
test('2FA step: wrong code → 401 and still no session; right TOTP → real session that works', async () => {
  googleResult = { user: asUser('mfa'), info: null };
  const pending = fragment((await srv.call('GET', '/auth/google/callback')).headers.get('location'), 'google_2fa');
  const wrong = await srv.call('POST', '/auth/2fa/verify-login', { body: { pendingToken: pending, code: '000000' } });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.body.token, undefined);
  const ok = await srv.call('POST', '/auth/2fa/verify-login', { body: { pendingToken: pending, code: totp() } });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.token);
  assert.equal((await srv.call('GET', '/probe', { token: ok.body.token })).status, 200);
});
test('a backup code completes the Google 2FA step exactly once', async () => {
  googleResult = { user: asUser('mfa'), info: null };
  const mk = async () => fragment((await srv.call('GET', '/auth/google/callback')).headers.get('location'), 'google_2fa');
  const first = await srv.call('POST', '/auth/2fa/verify-login', { body: { pendingToken: await mk(), code: 'BACKUP-1111' } });
  assert.equal(first.status, 200);
  const reuse = await srv.call('POST', '/auth/2fa/verify-login', { body: { pendingToken: await mk(), code: 'BACKUP-1111' } });
  assert.equal(reuse.status, 401);
});
test('Google callback WITHOUT 2FA still logs in normally', async () => {
  googleResult = { user: asUser('plain'), info: null };
  const r = await srv.call('GET', '/auth/google/callback');
  assert.match(r.headers.get('location'), /dashboard\.html\?token=/);
});

// ───────────── 2FA account that also lacks a date of birth ─────────────
test('2FA + no DOB: 2FA is demanded first; after it, the DOB step; only then a session', async () => {
  googleResult = { user: asUser('mfa-nodob'), info: null };
  const loc = (await srv.call('GET', '/auth/google/callback')).headers.get('location');
  assert.match(loc, /#google_2fa=/, 'second factor first');
  const pending = fragment(loc, 'google_2fa');
  const afterMfa = await srv.call('POST', '/auth/2fa/verify-login', { body: { pendingToken: pending, code: totp() } });
  assert.equal(afterMfa.status, 200);
  assert.equal(afterMfa.body.token, undefined, 'no session until DOB is given');
  assert.equal(afterMfa.body.requiresDob, true);
  assert.equal((await srv.call('GET', '/probe', { token: afterMfa.body.stepToken })).status, 401, 'step token is not a login');
  const done = await srv.call('POST', '/auth/complete-dob', { body: { stepToken: afterMfa.body.stepToken, dob: '1985-05-05' } });
  assert.equal(done.status, 200);
  assert.ok(done.body.token);
});
test('the DOB step can NOT be used to skip 2FA: a step token not minted after MFA is refused for a 2FA account', async () => {
  const noMfaStep = sign({ purpose: 'complete-dob', id: 'mfa-nodob', mfa: false });
  const forgedNoClaim = sign({ purpose: 'complete-dob', id: 'mfa-nodob' });
  for (const stepToken of [noMfaStep, forgedNoClaim]) {
    const r = await srv.call('POST', '/auth/google/complete', { body: { stepToken, dob: '1985-05-05' } });
    assert.equal(r.status, 403);
    assert.equal(r.body.token, undefined);
  }
  assert.equal(asUser('mfa-nodob').dob, null, 'DOB was not written either');
});
test('a forged step token (wrong secret) never yields a session', async () => {
  const forged = jwt.sign({ purpose: 'complete-dob', id: 'mfa', mfa: true }, 'attacker-secret');
  assert.equal((await srv.call('POST', '/auth/complete-dob', { body: { stepToken: forged, dob: '1985-05-05' } })).status, 400);
});

// ───────────── email/password login ─────────────
test('password login for a 2FA account: requires2FA, no token; pendingToken is not a session', async () => {
  const r = await srv.call('POST', '/auth/login', { body: { usernameOrEmail: 'mfa', password: 'passw0rd!' } });
  assert.equal(r.status, 200);
  assert.equal(r.body.requires2FA, true);
  assert.equal(r.body.token, undefined);
  assert.equal((await srv.call('GET', '/probe', { token: r.body.pendingToken })).status, 401);
  assert.equal(jwt.decode(r.body.pendingToken).typ, '2fa-pending');
  const ok = await srv.call('POST', '/auth/2fa/verify-login', { body: { pendingToken: r.body.pendingToken, code: totp() } });
  assert.ok(ok.body.token);
});
test('password login without 2FA works normally; wrong password is refused', async () => {
  const ok = await srv.call('POST', '/auth/login', { body: { usernameOrEmail: 'plain', password: 'passw0rd!' } });
  assert.ok(ok.body.token);
  assert.equal((await srv.call('GET', '/probe', { token: ok.body.token })).status, 200);
  assert.equal((await srv.call('POST', '/auth/login', { body: { usernameOrEmail: 'plain', password: 'nope' } })).status, 401);
});

// ───────────── doctor login ─────────────
test('doctor with 2FA enabled gets NO session from the password alone', async () => {
  const r = await srv.call('POST', '/api/doctors/login', { body: { email: 'doc@x.co', password: 'passw0rd!' } });
  assert.equal(r.status, 200);
  assert.equal(r.body.token, undefined);
  assert.equal(r.body.requires2FA, true);
  assert.equal((await srv.call('GET', '/probe', { token: r.body.pendingToken })).status, 401);
  const ok = await srv.call('POST', '/auth/2fa/verify-login', { body: { pendingToken: r.body.pendingToken, code: totp() } });
  assert.ok(ok.body.token);
});
test('doctor without 2FA still logs in as before', async () => {
  users.rows.find(u => u.id === 'doc').twoFactorEnabled = false;
  const r = await srv.call('POST', '/api/doctors/login', { body: { email: 'doc@x.co', password: 'passw0rd!' } });
  assert.ok(r.body.token);
  assert.equal(jwt.decode(r.body.token).typ, 'access');
  assert.equal(r.body.status, 'APPROVED');
});

// ───────────── age gate on password login (consistency with Google) ─────────────
test('patient with no DOB on file: password login asks for it instead of issuing a session; completion then works', async () => {
  const r = await srv.call('POST', '/auth/login', { body: { usernameOrEmail: 'pn', password: 'passw0rd!' } });
  assert.equal(r.body.token, undefined);
  assert.equal(r.body.requiresDob, true);
  const young = await srv.call('POST', '/auth/complete-dob', { body: { stepToken: r.body.stepToken, dob: '2015-01-01' } });
  assert.equal(young.status, 400);
  assert.equal(young.body.token, undefined);
  assert.equal(asUser('plain-nodob').dob, null);
  const ok = await srv.call('POST', '/auth/complete-dob', { body: { stepToken: r.body.stepToken, dob: '1988-08-08' } });
  assert.ok(ok.body.token);
});
