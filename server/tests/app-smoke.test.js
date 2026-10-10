// Boots the REAL src/index.js (all routes, helmet, CORS, the real rate limiters)
// with only the database replaced by a harmless fake.
const test = require('node:test');
const assert = require('node:assert/strict');
const { stub, sign, tokenFor } = require('./helpers');

stub('db', new Proxy({ $queryRaw: async () => [1] }, { get: (t, k) => k in t ? t[k] : new Proxy({}, { get: () => async () => null }) }));
const express = require('express');
const realListen = express.application.listen;
let server;
express.application.listen = function (p, cb) { server = realListen.call(this, 0, cb); return server; };
const quiet = console.log; console.log = () => {};
const err = console.error; console.error = () => {};
require('../src/index.js');
console.log = quiet; console.error = err;

let base;
test.before(async () => { await new Promise(r => setTimeout(r, 300)); base = `http://127.0.0.1:${server.address().port}`; });
test.after(() => server.close());
const get = (p, o = {}) => fetch(base + p, o);

test('health + 404 + security headers', async () => {
  const h = await get('/api/health'); assert.equal(h.status, 200);
  assert.ok(h.headers.get('x-content-type-options'));
  assert.equal((await get('/api/nope')).status, 404);
});
test('CORS: production origin allowed, unknown origin blocked with 403', async () => {
  const ok = await get('/api/health', { headers: { Origin: 'https://med-ai-3.vercel.app' } });
  assert.equal(ok.headers.get('access-control-allow-origin'), 'https://med-ai-3.vercel.app');
  const bad = await get('/api/health', { headers: { Origin: 'https://evil.example' } });
  assert.equal(bad.status, 403);
  assert.equal(bad.headers.get('access-control-allow-origin'), null);
});
test('protected routes require a login', async () => {
  for (const p of ['/api/profile', '/api/ai/usage', '/api/chat/conversations', '/api/doctor-portal/patients', '/api/health-logs/summary', '/api/admin/users', '/api/admin/me', '/api/achievements', '/api/notifications']) {
    const r = await get(p); assert.ok([401, 403].includes(r.status), `${p} → ${r.status}`);
  }
});
test('mid-flow tokens (2FA pending / Google step) are not accepted as logins anywhere', async () => {
  for (const t of [sign({ id: 'u', pending2FA: true }), sign({ id: 'u', purpose: 'google-dob' })]) {
    const r = await get('/api/profile', { headers: { Authorization: 'Bearer ' + t } });
    assert.equal(r.status, 401);
  }
});
test('a normal user token cannot reach admin or doctor-portal routes', async () => {
  const t = tokenFor({ id: 'u', role: 'USER' });
  for (const p of ['/api/admin/me', '/api/admin/users', '/api/doctor-portal/patients']) {
    assert.equal((await get(p, { headers: { Authorization: 'Bearer ' + t } })).status, 403, p);
  }
});
test('unsigned payment webhook is rejected; Google sign-in without config is a clean 503', async () => {
  assert.equal((await get('/api/payments/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401);
  assert.equal((await get('/api/auth/google')).status, 503);
});
test('login endpoint is rate limited', async () => {
  let last;
  for (let i = 0; i < 25; i++) last = await get('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"usernameOrEmail":"a","password":"b"}' });
  assert.equal(last.status, 429);
});
