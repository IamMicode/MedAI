const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
process.env.BACHS_WEBHOOK_SECRET = 'whsec_test_not_real';
process.env.BACHS_SECRET_KEY = 'sk_sandbox_not_real';
const { stub, stubRateLimits, serve, table } = require('./helpers');

const users = table([{ id: 'u1', plan: 'Free', premiumExpiresAt: null }]);
const payments = table([
  { id: 'p1', userId: 'u1', txRef: 'TX1', checkoutId: 'chk_1', amount: 5, currency: 'USD', planType: 'monthly', status: 'PENDING' },
  { id: 'p2', userId: 'u1', txRef: 'TX2', checkoutId: 'chk_2', amount: 5, currency: 'USD', planType: 'monthly', status: 'PENDING' }
]);
const notified = [];
stub('db', { user: users, payment: payments, $transaction: async (ops) => Promise.all(ops) });
stub('utils/notify', async (...a) => { notified.push(a); });
stubRateLimits();
const router = require('../src/routes/payments');

let srv;
test.before(async () => { srv = await serve([['/api/payments', router]]); });
test.after(async () => { await srv.close(); });

const sign = (rawBody, ts = Math.floor(Date.now() / 1000), secret = process.env.BACHS_WEBHOOK_SECRET) =>
  `t=${ts},v1=${crypto.createHmac('sha256', secret).update(`${ts}.`).update(rawBody).digest('hex')}`;
const event = (over = {}) => JSON.stringify({ id: 'evt_1', type: 'collection.succeeded', data: { checkout_id: 'chk_1', status: 'SUCCEEDED', currency: 'USD', amount: '5', charge_id: 'ch_1', metadata: { txRef: 'TX1' } }, ...over });
const post = (raw, headers) => srv.call('POST', '/api/payments/webhook', { rawBody: raw, headers: { 'Content-Type': 'application/json', ...headers } });
const settle = () => new Promise(r => setTimeout(r, 60));

test('webhook: no signature, wrong signature, wrong secret, stale timestamp → all 401 and nothing changes', async () => {
  const raw = event();
  assert.equal((await post(raw, {})).status, 401);
  assert.equal((await post(raw, { 'x-bachs-signature-v2': 't=1,v1=deadbeef' })).status, 401);
  assert.equal((await post(raw, { 'x-bachs-signature-v2': sign(raw, undefined, 'a-different-secret') })).status, 401);
  const old = Math.floor(Date.now() / 1000) - 3600;
  assert.equal((await post(raw, { 'x-bachs-signature-v2': sign(raw, old) })).status, 401);
  await settle();
  assert.equal(payments.rows[0].status, 'PENDING');
  assert.equal(users.rows[0].plan, 'Free');
});
test('webhook: tampered body with a previously valid signature is rejected', async () => {
  const raw = event(); const sig = sign(raw);
  const tampered = raw.replace('"amount":"5"', '"amount":"0.01"');
  assert.equal((await post(tampered, { 'x-bachs-signature-v2': sig })).status, 401);
});
test('webhook: valid signed success upgrades the user to Premium exactly once', async () => {
  const raw = event();
  const r = await post(raw, { 'x-bachs-signature-v2': sign(raw) });
  assert.equal(r.status, 200);
  await settle();
  assert.equal(payments.rows[0].status, 'SUCCESSFUL');
  assert.equal(users.rows[0].plan, 'Premium');
  assert.ok(users.rows[0].premiumExpiresAt > new Date());
  const notes = notified.length;
  const again = await post(raw, { 'x-bachs-signature-v2': sign(raw) });   // at-least-once redelivery
  assert.equal(again.status, 200);
  await settle();
  assert.equal(notified.length, notes, 'no duplicate processing');
});
test('webhook: underpayment or wrong currency does NOT upgrade', async () => {
  users.rows[0].plan = 'Free';
  const raw = event({ data: { checkout_id: 'chk_2', status: 'SUCCEEDED', currency: 'USD', amount: '1', metadata: { txRef: 'TX2' } } });
  assert.equal((await post(raw, { 'x-bachs-signature-v2': sign(raw) })).status, 200);
  await settle();
  assert.equal(payments.rows[1].status, 'FAILED');
  assert.equal(users.rows[0].plan, 'Free');
});
test('payment initialize/status require login', async () => {
  assert.equal((await srv.call('POST', '/api/payments/initialize', { body: {} })).status, 401);
  assert.equal((await srv.call('GET', '/api/payments/status/TX1')).status, 401);
});
