const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
crypto.randomInt = () => 123456; // deterministic reset code for the test
const { stub, stubRateLimits, serve, sign, tokenFor, table, jwt } = require('./helpers');

const users = table([], { role: 'USER', plan: 'Free', emailVerified: false });
const resetCodes = table([], { usedAt: null, verifiedAt: null, resetTokenHash: null, attempts: 0 });
stub('db', { user: users, passwordResetCode: resetCodes, $transaction: async (ops) => Promise.all(ops) });
stubRateLimits();

// passport is stubbed so the Google callback can be driven with chosen outcomes
let googleResult = { user: null, info: null };
stub('passport', {
  passport: { authenticate: (name, opts, cb) => (req, res, next) => cb ? cb(null, googleResult.user, googleResult.info) : next() },
  configurePassport() {}
});
const authRoutes = require('../src/routes/auth');

const years = (n) => { const d = new Date(); d.setUTCFullYear(d.getUTCFullYear() - n); return d.toISOString().slice(0, 10); };
const reg = (over = {}) => ({ username: 'tester1', email: 'a@b.co', password: 'password123', dob: years(25), ...over });

let srv;
test.before(async () => { srv = await serve([['/auth', authRoutes]]); });
test.after(async () => { await srv.close(); });
test.beforeEach(() => { users.rows.length = 0; resetCodes.rows.length = 0; });

// ───────────────────────── registration & age ─────────────────────────
test('register: adult succeeds and receives a login token', async () => {
  const r = await srv.call('POST', '/auth/register', { body: reg() });
  assert.equal(r.status, 201);
  assert.ok(r.body.token);
  assert.equal(users.rows.length, 1);
});
test('register: under-18 rejected and NO account created', async () => {
  const r = await srv.call('POST', '/auth/register', { body: reg({ dob: years(15) }) });
  assert.equal(r.status, 400);
  assert.match(r.body.message, /at least 18/);
  assert.equal(users.rows.length, 0);
});
test('register: missing / junk / future / impossible dob rejected', async () => {
  for (const dob of [undefined, 'banana', '2999-01-01', '1990-02-31', '01/01/2000']) {
    const body = reg(); if (dob === undefined) delete body.dob; else body.dob = dob;
    const r = await srv.call('POST', '/auth/register', { body });
    assert.equal(r.status, 400, `dob=${dob}`);
  }
  assert.equal(users.rows.length, 0);
});

// ───────────────────────── password reset (full flow) ─────────────────────────
test('password reset: request → verify → reset works; token is single-use; code alone cannot reset', async () => {
  const bcrypt = require('bcrypt');
  users.rows.push({ id: 'u1', email: 'a@b.co', username: 'a', password: await bcrypt.hash('oldpassword1', 4), role: 'USER' });
  const old = new Date(Date.now() - 3 * 864e5);
  resetCodes.rows.push({ id: 'stale', userId: 'u1', expiresAt: old, usedAt: old, createdAt: old });

  assert.equal((await srv.call('POST', '/auth/forgot-password', { body: { email: 'a@b.co' } })).status, 200);
  assert.equal(resetCodes.rows.find(r => r.id === 'stale'), undefined, 'stale code purged');

  assert.equal((await srv.call('POST', '/auth/verify-reset-code', { body: { email: 'a@b.co', code: '000000' } })).status, 400);
  const v = await srv.call('POST', '/auth/verify-reset-code', { body: { email: 'a@b.co', code: '123456' } });
  assert.equal(v.status, 200);
  assert.ok(v.body.resetToken);

  // the 6-digit code itself must not be accepted by /reset-password
  assert.equal((await srv.call('POST', '/auth/reset-password', { body: { email: 'a@b.co', code: '123456', password: 'newpassword1' } })).status, 400);
  assert.equal((await srv.call('POST', '/auth/reset-password', { body: { email: 'a@b.co', resetToken: 'z'.repeat(64), password: 'newpassword1' } })).status, 400);

  const ok = await srv.call('POST', '/auth/reset-password', { body: { email: 'a@b.co', resetToken: v.body.resetToken, password: 'newpassword1' } });
  assert.equal(ok.status, 200);
  assert.equal(await bcrypt.compare('newpassword1', users.rows[0].password), true);
  const again = await srv.call('POST', '/auth/reset-password', { body: { email: 'a@b.co', resetToken: v.body.resetToken, password: 'another-pass1' } });
  assert.equal(again.status, 400);
});
test('password reset: unknown email gets the same generic answer (no account enumeration)', async () => {
  const r = await srv.call('POST', '/auth/forgot-password', { body: { email: 'nobody@x.co' } });
  assert.equal(r.status, 200);
});

// ───────────────────────── mid-flow tokens are not login tokens ─────────────────────────
test('requireAuth rejects 2FA pendingToken and Google step tokens used as Bearer tokens', async () => {
  users.rows.push({ id: 'u9', email: 'x@y.co', username: 'x', role: 'USER', password: 'h' });
  const { requireAuth } = require('../src/middleware/auth');
  const mini = await serve([['/t', require('express').Router().get('/', requireAuth, (req, res) => res.json({ ok: true }))]]);
  try {
    const good = await mini.call('GET', '/t', { token: tokenFor(users.rows[0]) });
    assert.equal(good.status, 200);
    for (const t of [sign({ id: 'u9', pending2FA: true }), sign({ purpose: 'google-dob', id: 'u9' }), sign({ purpose: 'google-signup', email: 'e@e.co' })]) {
      assert.equal((await mini.call('GET', '/t', { token: t })).status, 401);
    }
  } finally {
    await mini.close();
  }
});

// ───────────────────────── Google sign-up age enforcement ─────────────────────────
const signupToken = (over = {}) => sign({ purpose: 'google-signup', googleId: 'g-123', email: 'newbie@gmail.com', firstname: 'New', lastname: 'Bie', avatarUrl: null, ...over }, { expiresIn: '15m' });

test('google callback: brand-new identity gets NO account and is sent to the DOB step', async () => {
  googleResult = { user: false, info: { googleSignup: { googleId: 'g-1', email: 'n@g.co', firstname: 'N', lastname: 'G', avatarUrl: null } } };
  const r = await srv.call('GET', '/auth/google/callback');
  assert.equal(r.status, 302);
  assert.match(r.headers.get('location'), /Login_page\.html#google_signup=/);
  assert.doesNotMatch(r.headers.get('location'), /token=/);
  assert.equal(users.rows.length, 0);
});
test('google callback: existing patient WITHOUT a dob is sent to the DOB step, not logged in', async () => {
  googleResult = { user: { id: 'old', role: 'USER', dob: null, email: 'o@g.co' }, info: null };
  const r = await srv.call('GET', '/auth/google/callback');
  assert.match(r.headers.get('location'), /#google_dob=/);
  assert.doesNotMatch(r.headers.get('location'), /[?&]token=/);
});
test('google callback: patient with dob logs in; admin/doctor without dob are not gated', async () => {
  for (const u of [{ id: 'a', role: 'USER', dob: '1990-01-01' }, { id: 'b', role: 'ADMIN', dob: null }, { id: 'c', role: 'DOCTOR', dob: null }]) {
    googleResult = { user: u, info: null };
    const r = await srv.call('GET', '/auth/google/callback');
    assert.match(r.headers.get('location'), /[?&]token=/, u.role);
  }
});
test('google/complete: adult creates the account (with dob) and gets a session', async () => {
  const r = await srv.call('POST', '/auth/google/complete', { body: { stepToken: signupToken(), dob: years(30) } });
  assert.equal(r.status, 201);
  assert.ok(r.body.token);
  assert.equal(users.rows.length, 1);
  assert.equal(users.rows[0].authProvider, 'google');
  assert.ok(users.rows[0].dob);
});
test('google/complete: under-18 is rejected and NO account is created', async () => {
  const r = await srv.call('POST', '/auth/google/complete', { body: { stepToken: signupToken(), dob: years(16) } });
  assert.equal(r.status, 400);
  assert.match(r.body.message, /at least 18/);
  assert.equal(users.rows.length, 0);
});
test('google/complete: junk dob, missing dob, expired/forged/wrong-purpose tokens rejected', async () => {
  for (const body of [{ stepToken: signupToken(), dob: 'banana' }, { stepToken: signupToken() }, { dob: years(30) }]) {
    assert.equal((await srv.call('POST', '/auth/google/complete', { body })).status, 400);
  }
  const expired = sign({ purpose: 'google-signup', googleId: 'g', email: 'e@e.co' }, { expiresIn: -10 });
  const forged = jwt.sign({ purpose: 'google-signup', googleId: 'g', email: 'e@e.co' }, 'wrong-secret');
  const loginToken = sign({ id: 'u1', role: 'USER' });          // a normal login token has no purpose
  for (const stepToken of [expired, forged, loginToken]) {
    assert.equal((await srv.call('POST', '/auth/google/complete', { body: { stepToken, dob: years(30) } })).status, 400);
  }
  assert.equal(users.rows.length, 0);
});
test('google/complete: legacy patient without dob — adult is let in and dob saved; under-18 gets no session', async () => {
  users.rows.push({ id: 'legacy', email: 'l@g.co', username: 'l', role: 'USER', dob: null });
  const tooYoung = await srv.call('POST', '/auth/google/complete', { body: { stepToken: sign({ purpose: 'google-dob', id: 'legacy' }), dob: years(12) } });
  assert.equal(tooYoung.status, 400);
  assert.equal(tooYoung.body.token, undefined);
  assert.equal(users.rows[0].dob, null);
  const ok = await srv.call('POST', '/auth/google/complete', { body: { stepToken: sign({ purpose: 'google-dob', id: 'legacy' }), dob: years(40) } });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.token);
  assert.ok(users.rows[0].dob);
});
test('google/complete: cannot create a duplicate of an existing email', async () => {
  users.rows.push({ id: 'e1', email: 'newbie@gmail.com', username: 'newbie', role: 'USER', dob: '1990-01-01' });
  const r = await srv.call('POST', '/auth/google/complete', { body: { stepToken: signupToken(), dob: years(30) } });
  assert.equal(r.status, 409);
  assert.equal(users.rows.length, 1);
});
