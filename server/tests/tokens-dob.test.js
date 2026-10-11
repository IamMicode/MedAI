// Typed access tokens + server-side date-of-birth enforcement for sessions that
// were issued BEFORE the rule existed. REAL middleware/route code; MOCKED database.
const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const { stub, stubRateLimits, serve, sign, tokenFor, table, jwt } = require('./helpers');

const users = table([], { role: 'USER', plan: 'Free' }, { yield: 2 });
let userLookups = 0;
const baseFind = users.findUnique;
users.findUnique = async (a) => { userLookups++; return baseFind(a); };
stub('db', { user: users, doctorProfile: table([]), passwordResetCode: table([]), $transaction: async (o) => Promise.all(o) });
stubRateLimits();
stub('passport', { passport: { authenticate: () => (req, res, next) => next() }, configurePassport() {} });
const { requireAuth } = require('../src/middleware/auth');
const express = require('express');
const probe = express.Router().get('/', requireAuth, (req, res) => res.json({ ok: true, id: req.user.id }));

let srv;
test.before(async () => {
  const pw = await bcrypt.hash('passw0rd!', 4);
  users.rows.push(
    { role: 'USER', id: 'adult', email: 'a@x.co', username: 'adult', dob: '1990-05-05', password: pw },
    { role: 'USER', id: 'nodob', email: 'n@x.co', username: 'nodob', dob: null, password: pw },
    { role: 'USER', id: 'nodob2', email: 'n2@x.co', username: 'nodob2', dob: null, password: pw },
    { role: 'USER', id: 'nodob3', email: 'n3@x.co', username: 'nodob3', dob: null, password: pw },
    { id: 'doc', email: 'd@x.co', username: 'doc', role: 'DOCTOR', dob: null },
    { id: 'adm', email: 'ad@x.co', username: 'adm', role: 'ADMIN', dob: null }
  );
  srv = await serve([['/auth', require('../src/routes/auth')], ['/probe', probe], ['/api/profile', require('../src/routes/profile')]]);
});
test.after(async () => { await srv.close(); });

const ago = (s) => Math.floor(Date.now() / 1000) - s;
// what the PREVIOUS deployment minted: no `typ`, no `dobOk`, issued in the past
const legacy = (id, role = 'USER', extra = {}) => sign({ id, role, email: id + '@x.co', username: id, plan: 'Free', iat: ago(3600), ...extra }, { expiresIn: '7d' });
const get = (token) => srv.call('GET', '/probe', { token });

// ───────────── F. typed tokens ─────────────
test('current full sessions are typed and accepted', async () => {
  assert.equal((await get(tokenFor({ id: 'adult', role: 'USER' }))).status, 200);
  assert.equal(jwt.decode(tokenFor({ id: 'adult', role: 'USER' })).typ, 'access');
});

test('every token this version issues is typed: login, pending-2FA, step, doctor', async () => {
  const login = await srv.call('POST', '/auth/login', { body: { usernameOrEmail: 'adult', password: 'passw0rd!' } });
  const claims = jwt.decode(login.body.token);
  assert.equal(claims.typ, 'access');
  assert.equal(claims.dobOk, true);
  const nodob = await srv.call('POST', '/auth/login', { body: { usernameOrEmail: 'nodob', password: 'passw0rd!' } });
  assert.equal(jwt.decode(nodob.body.stepToken).typ, 'step');
  assert.equal(nodob.body.token, undefined);
});

test('wrong / missing types are refused as sessions', async () => {
  const bad = {
    pending: sign({ id: 'adult', role: 'USER', pending2FA: true, typ: '2fa-pending' }),
    step: sign({ id: 'adult', purpose: 'complete-dob', mfa: true, typ: 'step' }),
    stepNoTyp: sign({ id: 'adult', purpose: 'complete-dob', mfa: true }),
    pendingNoTyp: sign({ id: 'adult', pending2FA: true }),
    typRefresh: sign({ id: 'adult', role: 'USER', typ: 'refresh' }),
    typAccessButPending: sign({ id: 'adult', role: 'USER', typ: 'access', pending2FA: true }),
    untypedNow: sign({ id: 'adult', role: 'USER' }),              // untyped AND issued after the cutoff
    legacyNoRole: sign({ id: 'adult', iat: ago(3600) }),
    legacyWithPurpose: legacy('adult', 'USER', { purpose: 'google-signup' }),
    forged: jwt.sign({ id: 'adult', role: 'USER', typ: 'access' }, 'not-the-secret')
  };
  for (const [name, t] of Object.entries(bad)) assert.equal((await get(t)).status, 401, name);
});

test('rollout: an UNTYPED token issued before the cutoff is still honoured (no mass logout)…', async () => {
  assert.equal((await get(legacy('adult'))).status, 200);
});

test('…but the exception can be closed instantly by setting the cutoff in the past, and an unparseable cutoff fails closed', async () => {
  const prev = process.env.ACCESS_TOKEN_LEGACY_CUTOFF;
  try {
    process.env.ACCESS_TOKEN_LEGACY_CUTOFF = '1970-01-01';
    assert.equal((await get(legacy('adult'))).status, 401);
    assert.equal((await get(tokenFor({ id: 'adult', role: 'USER' }))).status, 200, 'typed tokens unaffected');
    process.env.ACCESS_TOKEN_LEGACY_CUTOFF = 'garbage';
    assert.equal((await get(legacy('adult'))).status, 401);
    process.env.ACCESS_TOKEN_LEGACY_CUTOFF = new Date(Date.now() + 3600e3).toISOString();   // pinned later: older tokens ok
    assert.equal((await get(legacy('adult'))).status, 200);
  } finally {
    if (prev === undefined) delete process.env.ACCESS_TOKEN_LEGACY_CUTOFF; else process.env.ACCESS_TOKEN_LEGACY_CUTOFF = prev;
  }
});

// ───────────── E. legacy sessions and the date of birth ─────────────
test('LEGACY session, patient with NO date of birth → 403 DOB_REQUIRED on protected routes (real routes too)', async () => {
  const t = legacy('nodob');
  const r = await get(t);
  assert.equal(r.status, 403);
  assert.equal(r.body.code, 'DOB_REQUIRED');
  const profile = await srv.call('GET', '/api/profile', { token: t });
  assert.equal(profile.status, 403);
  assert.equal(profile.body.code, 'DOB_REQUIRED');
});

test('a current-version token WITHOUT the dobOk claim is checked against the database too', async () => {
  const t = sign({ id: 'nodob', role: 'USER', typ: 'access' });
  assert.equal((await get(t)).status, 403);
});

test('legacy session of a patient who HAS a date of birth keeps working; dobOk tokens skip the lookup', async () => {
  assert.equal((await get(legacy('adult'))).status, 200);
  const before = userLookups;
  assert.equal((await get(tokenFor({ id: 'nodob', role: 'USER' }))).status, 200, 'dobOk claim is trusted (only minted after DOB is confirmed)');
  assert.equal(userLookups, before, 'no DB read for dobOk tokens');
});

test('doctors and admins are not gated; a deleted account is refused', async () => {
  assert.equal((await get(legacy('doc', 'DOCTOR'))).status, 200);
  assert.equal((await get(legacy('adm', 'ADMIN'))).status, 200);
  assert.equal((await get(legacy('ghost'))).status, 401);
});

test('completion with the EXISTING session: under-18 stays blocked; adult completes; same session then works; no new token is issued', async () => {
  const t = legacy('nodob2');
  const young = await srv.call('POST', '/auth/complete-dob', { token: t, body: { dob: '2015-01-01' } });
  assert.equal(young.status, 400);
  assert.equal((await get(t)).status, 403, 'still blocked');
  const bad = await srv.call('POST', '/auth/complete-dob', { token: t, body: { dob: '2999-01-01' } });
  assert.equal(bad.status, 400);
  const ok = await srv.call('POST', '/auth/complete-dob', { token: t, body: { dob: '1985-03-03' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.token, undefined, 'not a token-refresh endpoint');
  assert.equal(ok.body.user.dob, '1985-03-03');
  assert.equal(ok.body.user.password, undefined);
  assert.equal((await get(t)).status, 200, 'the session the user already had now works');
});

test('completion endpoint is NOT a refresh/back door: users who already have a DOB, doctors, mid-login tokens and anonymous callers are refused', async () => {
  const withDob = await srv.call('POST', '/auth/complete-dob', { token: legacy('adult'), body: { dob: '1970-01-01' } });
  assert.equal(withDob.status, 409);
  assert.equal(withDob.body.token, undefined);
  assert.equal(users.rows.find(u => u.id === 'adult').dob, '1990-05-05', 'unchanged');
  assert.equal((await srv.call('POST', '/auth/complete-dob', { token: legacy('doc', 'DOCTOR'), body: { dob: '1980-01-01' } })).status, 401);
  assert.equal((await srv.call('POST', '/auth/complete-dob', { token: sign({ id: 'nodob', pending2FA: true, typ: '2fa-pending' }), body: { dob: '1980-01-01' } })).status, 401);
  assert.equal((await srv.call('POST', '/auth/complete-dob', { body: { dob: '1980-01-01' } })).status, 401);
  assert.equal(users.rows.find(u => u.id === 'nodob').dob, null, 'nothing was written');
});

test('two simultaneous completions: exactly one writes, the other gets 409', async () => {
  const t = legacy('nodob3');
  const rs = await Promise.all([
    srv.call('POST', '/auth/complete-dob', { token: t, body: { dob: '1980-01-01' } }),
    srv.call('POST', '/auth/complete-dob', { token: t, body: { dob: '1999-09-09' } })
  ]);
  assert.deepEqual(rs.map(r => r.status).sort(), [200, 409]);
});
