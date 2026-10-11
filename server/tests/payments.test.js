const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
process.env.BACHS_WEBHOOK_SECRET = 'whsec_test_not_real';
process.env.BACHS_SECRET_KEY = 'sk_sandbox_not_real';
const { stub, stubRateLimits, serve, table, makeDb } = require('./helpers');

const users = table([{ id: 'u1', plan: 'Free', premiumExpiresAt: null }], {}, { yield: 4 });
const payments = table([
  { id: 'p1', userId: 'u1', txRef: 'TX1', checkoutId: 'chk_1', amount: 5, currency: 'USD', planType: 'monthly', status: 'PENDING' },
  { id: 'p2', userId: 'u1', txRef: 'TX2', checkoutId: 'chk_2', amount: 5, currency: 'USD', planType: 'monthly', status: 'PENDING' }
], {}, { yield: 4 });
const notified = [];
stub('db', makeDb({ user: users, payment: payments }));
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

// ---- Premium renewal / expiry through the webhook (mocked Bachs, signed events) ----
const pay = (id, txRef, planType = 'monthly') => payments.rows.push({ id, userId: 'u1', txRef, checkoutId: 'chk_' + id, amount: 5, currency: 'USD', planType, status: 'PENDING' });
const fire = async (id, txRef) => {
  const raw = event({ data: { checkout_id: 'chk_' + id, status: 'SUCCEEDED', currency: 'USD', amount: '5', charge_id: 'ch_' + id, metadata: { txRef } } });
  assert.equal((await post(raw, { 'x-bachs-signature-v2': sign(raw) })).status, 200);
  await settle();
};
const DAYMS = 864e5;

test('renewal while ACTIVE stacks onto the remaining time; payment rows preserved', async () => {
  const before = payments.rows.length;
  const left = new Date(Date.now() + 10 * DAYMS);
  Object.assign(users.rows[0], { plan: 'Premium', premiumExpiresAt: left });
  pay('r1', 'TXR1'); await fire('r1', 'TXR1');
  const gained = users.rows[0].premiumExpiresAt - left;
  assert.ok(Math.abs(gained - 30 * DAYMS) < 5000, 'adds 30d to the existing expiry');
  assert.equal(payments.rows.length, before + 1, 'no payment records removed');
  assert.ok(payments.rows.every(p => p.id), 'older payments untouched');
});
test('renewal after EXPIRY starts from now, not from the stale date', async () => {
  Object.assign(users.rows[0], { plan: 'Premium', premiumExpiresAt: new Date(Date.now() - 20 * DAYMS) });
  pay('r2', 'TXR2', 'yearly'); await fire('r2', 'TXR2');
  const left = users.rows[0].premiumExpiresAt - Date.now();
  assert.ok(Math.abs(left - 365 * DAYMS) < 5000);
});
test('first purchase with NULL expiry starts from now', async () => {
  Object.assign(users.rows[0], { plan: 'Free', premiumExpiresAt: null });
  pay('r3', 'TXR3'); await fire('r3', 'TXR3');
  assert.equal(users.rows[0].plan, 'Premium');
  assert.ok(Math.abs(users.rows[0].premiumExpiresAt - Date.now() - 30 * DAYMS) < 5000);
});
test('status endpoint reports Free for a lapsed subscription (not the stale stored plan)', async () => {
  const { tokenFor } = require('./helpers');
  Object.assign(users.rows[0], { plan: 'Premium', premiumExpiresAt: new Date(Date.now() - DAYMS) });
  const r = await srv.call('GET', '/api/payments/status/TXR3', { token: tokenFor({ id: 'u1', role: 'USER' }) });
  assert.equal(r.body.plan, 'Free');
  Object.assign(users.rows[0], { premiumExpiresAt: new Date(Date.now() + DAYMS) });
  assert.equal((await srv.call('GET', '/api/payments/status/TXR3', { token: tokenFor({ id: 'u1', role: 'USER' }) })).body.plan, 'Premium');
});

// =====================================================================
// Idempotency + concurrency. MOCKED: an in-memory fake DB whose operations
// yield to the event loop so simultaneous deliveries genuinely interleave, and
// whose interactive $transaction really rolls back. Each single statement is
// atomic (as in Postgres); correctness must come from the conditional writes.
// Real Postgres row-locking behaviour is NOT exercised here.
// =====================================================================
const reset = (user = {}) => {
  Object.assign(users.rows[0], { plan: 'Free', premiumActivatedAt: null, premiumExpiresAt: null }, user);
  notified.length = 0;
};
const addPay = (id, planType = 'monthly') => {
  payments.rows.push({ id, userId: 'u1', txRef: 'TX_' + id, checkoutId: 'chk_' + id, amount: 5, currency: 'USD', planType, status: 'PENDING' });
  return 'TX_' + id;
};
const evt = (txRef, id, evtId = 'evt_' + id) => event({ id: evtId, data: { checkout_id: 'chk_' + id, status: 'SUCCEEDED', currency: 'USD', amount: '5', charge_id: 'ch_' + id, metadata: { txRef } } });
const deliver = (raw) => post(raw, { 'x-bachs-signature-v2': sign(raw) });
const payRow = (id) => payments.rows.find(p => p.id === id);
const near = (actualMs, expectedMs, tol = 5000) => Math.abs(actualMs - expectedMs) < tol;

test('CONCURRENT duplicate deliveries of one payment → exactly ONE extension and ONE notification', async () => {
  reset();
  const tx = addPay('c1');
  const raw = evt(tx, 'c1');
  const rs = await Promise.all(Array.from({ length: 6 }, () => deliver(raw)));
  assert.ok(rs.every(r => r.status === 200 && r.body.received === true));
  await settle();
  assert.equal(payRow('c1').status, 'SUCCESSFUL');
  assert.ok(near(users.rows[0].premiumExpiresAt - Date.now(), 30 * DAYMS), 'only one 30-day extension');
  assert.equal(notified.length, 1);
});

test('concurrent redeliveries with DIFFERENT event ids for the same payment still extend once', async () => {
  reset();
  const tx = addPay('c2');
  await Promise.all(['a', 'b', 'c'].map(k => deliver(evt(tx, 'c2', 'evt_' + k))));
  await settle();
  assert.ok(near(users.rows[0].premiumExpiresAt - Date.now(), 30 * DAYMS));
});

test('two DISTINCT payments for one user processed concurrently → both renewals count (60 days, not 30)', async () => {
  reset();
  const a = addPay('d1'), b = addPay('d2');
  await Promise.all([deliver(evt(a, 'd1')), deliver(evt(b, 'd2'))]);
  await settle();
  assert.equal(payRow('d1').status, 'SUCCESSFUL');
  assert.equal(payRow('d2').status, 'SUCCESSFUL');
  assert.ok(near(users.rows[0].premiumExpiresAt - Date.now(), 60 * DAYMS), 'no lost renewal');
  assert.equal(notified.length, 2);
});

test('concurrent monthly + yearly on an already-ACTIVE subscription stack onto the existing expiry', async () => {
  const existing = new Date(Date.now() + 10 * DAYMS);
  reset({ plan: 'Premium', premiumExpiresAt: existing });
  const a = addPay('e1', 'monthly'), b = addPay('e2', 'yearly'), c = addPay('e3', 'monthly');
  await Promise.all([deliver(evt(a, 'e1')), deliver(evt(b, 'e2')), deliver(evt(c, 'e3'))]);
  await settle();
  assert.ok(near(users.rows[0].premiumExpiresAt - existing, (30 + 365 + 30) * DAYMS), 'all three periods added');
});

test('failure mid-transaction ROLLS BACK: payment is not left SUCCESSFUL without Premium; webhook answers 500; redelivery then succeeds once', async () => {
  reset();
  const tx = addPay('f1');
  const raw = evt(tx, 'f1');
  const realUpdateMany = users.updateMany;
  users.updateMany = async () => { throw new Error('simulated DB failure'); };
  let r;
  try { r = await deliver(raw); } finally { users.updateMany = realUpdateMany; }
  await settle();
  assert.equal(r.status, 500, 'provider is told to retry');
  assert.equal(payRow('f1').status, 'PENDING', 'claim rolled back');
  assert.equal(payRow('f1').verifiedAt ?? null, null);
  assert.equal(users.rows[0].plan, 'Free');
  assert.equal(users.rows[0].premiumExpiresAt, null);
  assert.equal(notified.length, 0);
  const retry = await deliver(raw);
  assert.equal(retry.status, 200);
  await settle();
  assert.equal(payRow('f1').status, 'SUCCESSFUL');
  assert.ok(near(users.rows[0].premiumExpiresAt - Date.now(), 30 * DAYMS));
  assert.equal(notified.length, 1);
});

test('repeated deliveries AFTER completion never extend again (same event, new event id, late failed event)', async () => {
  reset();
  const tx = addPay('g1');
  await deliver(evt(tx, 'g1')); await settle();
  const done = users.rows[0].premiumExpiresAt.getTime();
  for (let i = 0; i < 3; i++) await deliver(evt(tx, 'g1'));
  await deliver(evt(tx, 'g1', 'evt_other_id'));
  const failed = JSON.stringify({ id: 'evt_f', type: 'collection.failed', data: { checkout_id: 'chk_g1', charge_id: 'ch_x', metadata: { txRef: tx } } });
  assert.equal((await deliver(failed)).status, 200);
  await settle();
  assert.equal(users.rows[0].premiumExpiresAt.getTime(), done, 'expiry unchanged');
  assert.equal(payRow('g1').status, 'SUCCESSFUL', 'a late failed event cannot flip a settled payment');
  assert.equal(notified.length, 1);
});

test('an underpaid duplicate cannot overwrite an already-SUCCESSFUL payment, and extends nothing', async () => {
  reset();
  const tx = addPay('h1');
  await deliver(evt(tx, 'h1')); await settle();
  const done = users.rows[0].premiumExpiresAt.getTime();
  const bad = event({ id: 'evt_bad', data: { checkout_id: 'chk_h1', status: 'SUCCEEDED', currency: 'USD', amount: '0.01', metadata: { txRef: tx } } });
  await deliver(bad); await settle();
  assert.equal(payRow('h1').status, 'SUCCESSFUL');
  assert.equal(users.rows[0].premiumExpiresAt.getTime(), done);
});
