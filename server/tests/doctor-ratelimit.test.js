// Doctor sign-in/registration rate limiting + account-enumeration resistance.
// REAL limiter + route code; the database is an in-memory fake (mocked).
const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const { stub, serve } = require('./helpers');

const hash = bcrypt.hashSync('Correct-horse-1', 4);
const rows = {
  'doc@x.co': { id: 'd1', email: 'doc@x.co', role: 'DOCTOR', password: hash, twoFactorEnabled: false, username: 'd', doctorProfile: { verificationStatus: 'APPROVED', fullName: 'Dr D', specialty: 'GP' } },
  'pat@x.co': { id: 'p1', email: 'pat@x.co', role: 'USER', password: hash, username: 'p', doctorProfile: null }
};
let lookups = 0;
stub('db', { user: { findUnique: async ({ where }) => { lookups++; return rows[where.email] || null; }, create: async () => { throw new Error('should not be reached'); } } });
stub('utils/notify', async () => {});
const router = require('../src/routes/doctors');

let srv;
test.before(async () => { srv = await serve([['/api/doctors', router]], { trustProxy: 1 }); });
test.after(async () => { await srv.close(); });

// With `trust proxy` = 1 Express takes the client IP from the LAST X-Forwarded-For
// entry (the one Render's proxy appended); anything the client put before it is ignored.
const from = (ip, spoof = 'x') => ({ 'X-Forwarded-For': `${spoof}, ${ip}` });
const login = (ip, email, password, spoof) => srv.call('POST', '/api/doctors/login', { body: { email, password }, headers: from(ip, spoof) });

test('login: unknown email, patient email and wrong password return the SAME generic 401', async () => {
  const a = await login('198.51.100.1', 'nobody@x.co', 'Whatever-123');
  const b = await login('198.51.100.1', 'pat@x.co', 'Correct-horse-1');   // right password, but not a doctor
  const c = await login('198.51.100.1', 'doc@x.co', 'wrong-password');
  for (const r of [a, b, c]) assert.equal(r.status, 401);
  assert.deepEqual(a.body, b.body);
  assert.deepEqual(a.body, c.body);
  assert.equal(a.body.message, 'Invalid email or password.');
  assert.doesNotMatch(JSON.stringify(a.body), /no doctor|incorrect password/i);
});

test('login: correct credentials still work', async () => {
  const r = await login('198.51.100.2', 'doc@x.co', 'Correct-horse-1');
  assert.equal(r.status, 200);
  assert.ok(r.body.token);
});

test('login: the 21st FAILED attempt from one IP is 429, and it is rejected BEFORE any DB/bcrypt work', async () => {
  const ip = '198.51.100.3';
  for (let i = 0; i < 20; i++) assert.equal((await login(ip, 'doc@x.co', 'bad-' + i)).status, 401);
  const before = lookups;
  const blocked = await login(ip, 'doc@x.co', 'Correct-horse-1');   // even the right password is refused now
  assert.equal(blocked.status, 429);
  assert.equal(lookups, before, 'limiter ran before the user lookup / password check');
});

test('login: spoofed leading X-Forwarded-For entries do NOT dodge the limit', async () => {
  const ip = '198.51.100.4';
  for (let i = 0; i < 20; i++) await login(ip, 'doc@x.co', 'bad', `1.2.3.${i}`);
  assert.equal((await login(ip, 'doc@x.co', 'bad', '9.9.9.9')).status, 429);
});

test('login: another client / shared-network neighbour on a different IP is unaffected', async () => {
  const blockedIp = '198.51.100.5';
  for (let i = 0; i < 21; i++) await login(blockedIp, 'doc@x.co', 'bad');
  assert.equal((await login(blockedIp, 'doc@x.co', 'Correct-horse-1')).status, 429);
  assert.equal((await login('198.51.100.6', 'doc@x.co', 'Correct-horse-1')).status, 200);
});

test('login: SUCCESSFUL sign-ins do not use up the budget (a clinic behind one IP can all log in)', async () => {
  const ip = '198.51.100.7';
  for (let i = 0; i < 30; i++) assert.equal((await login(ip, 'doc@x.co', 'Correct-horse-1')).status, 200);
  assert.equal((await login(ip, 'doc@x.co', 'bad')).status, 401);   // still not limited
});

test('registration: limited per IP (11th attempt in the hour is 429, before validation or DB work)', async () => {
  const ip = '198.51.100.8';
  const reg = () => srv.call('POST', '/api/doctors/register', { body: {}, headers: from(ip) });
  for (let i = 0; i < 10; i++) assert.equal((await reg()).status, 400);
  const before = lookups;
  assert.equal((await reg()).status, 429);
  assert.equal(lookups, before);
});
