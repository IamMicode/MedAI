// OPT-IN integration test against a REAL PostgreSQL database (not part of `npm test`).
//
//   createdb medai_it && for f in prisma/migrations/*/migration.sql; do psql -d medai_it -v ON_ERROR_STOP=1 -1 -f $f; done
//   npm i --no-save pg
//   TEST_DATABASE_URL=postgres://user@127.0.0.1:5432/medai_it node --test tests/integration/pg-concurrency.test.js
//
// Use a DISPOSABLE database only: this test inserts and deletes its own rows.
// It runs the REAL webhook / 2FA route code over HTTP with a REAL Postgres pool
// and real transactions; only the Prisma client is replaced by pgAdapter.js (see
// the caveats there). No payment provider, email or OAuth service is contacted.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const URL_ = process.env.TEST_DATABASE_URL;
const skip = !URL_ ? 'set TEST_DATABASE_URL to a disposable PostgreSQL database to run' : false;

process.env.BACHS_WEBHOOK_SECRET = 'whsec_test_not_real';
process.env.BACHS_SECRET_KEY = 'sk_sandbox_not_real';
const speakeasy = require('speakeasy');
const bcrypt = require('bcrypt');
const { stub, stubRateLimits, serve, sign } = require('../helpers');
const { makePrisma } = require('./pgAdapter');

let db, srv, notified = [];
const RUN = crypto.randomBytes(4).toString('hex');
const DAY = 864e5;

test.before(async () => {
  if (skip) return;
  db = makePrisma(URL_);
  const { rows } = await db.$pool.query(`select current_database() as d, version() as v`);
  assert.match(rows[0].d, /^medai_it/, 'refusing to run on a database whose name does not start with medai_it');
  stub('db', db);
  stub('utils/notify', async (...a) => { notified.push(a); });
  stubRateLimits();
  stub('passport', { passport: { authenticate: () => (req, res, next) => next() }, configurePassport() {} });
  srv = await serve([['/api/payments', require('../../src/routes/payments')], ['/auth', require('../../src/routes/auth')]]);
});
test.after(async () => { if (skip) return; await srv.close(); await db.$pool.query(`delete from "Payment" where "userId" like $1`, [`it_${RUN}%`]); await db.$pool.query(`delete from "User" where id like $1`, [`it_${RUN}%`]); await db.$pool.end(); });

let n = 0;
async function mkUser(extra = {}) {
  const id = `it_${RUN}_${++n}`;
  const cols = { id, username: id, email: id + '@x.co', updatedAt: new Date(), ...extra };
  const keys = Object.keys(cols);
  const vals = keys.map((k, i) => cols[k] instanceof Date ? cols[k].toISOString().replace('Z', '') : cols[k]);
  await db.$pool.query(`insert into "User" (${keys.map(k => `"${k}"`).join(',')}) values (${keys.map((k, i) => `$${i + 1}`).join(',')})`, vals);
  return id;
}
async function mkPayment(userId, planType = 'monthly') {
  const id = `it_${RUN}_p${++n}`;
  await db.$pool.query(`insert into "Payment" (id,"userId","txRef","checkoutId",amount,currency,"planType",status) values ($1,$2,$3,$4,5,'USD',$5,'PENDING')`, [id, userId, 'TX_' + id, 'chk_' + id, planType]);
  return { id, txRef: 'TX_' + id, checkoutId: 'chk_' + id };
}
const getUser = async (id) => (await db.$pool.query(`select * from "User" where id=$1`, [id])).rows[0];
const getPay = async (id) => (await db.$pool.query(`select * from "Payment" where id=$1`, [id])).rows[0];
const near = (ms, want, tol = 8000) => Math.abs(ms - want) < tol;

// ---- signed webhook deliveries (REAL signature verification code runs) ----
const sig = (raw, ts = Math.floor(Date.now() / 1000)) => `t=${ts},v1=${crypto.createHmac('sha256', process.env.BACHS_WEBHOOK_SECRET).update(`${ts}.`).update(raw).digest('hex')}`;
const evt = (p, evtId = 'evt_' + p.id) => JSON.stringify({ id: evtId, type: 'collection.succeeded', data: { checkout_id: p.checkoutId, status: 'SUCCEEDED', currency: 'USD', amount: '5', charge_id: 'ch_' + p.id, metadata: { txRef: p.txRef } } });
const deliver = (raw) => srv.call('POST', '/api/payments/webhook', { rawBody: raw, headers: { 'Content-Type': 'application/json', 'x-bachs-signature-v2': sig(raw) } });

// ======================= payments =======================
test('PG: 10 concurrent duplicate deliveries → ONE extension, ONE notification, all answered 200', { skip }, async () => {
  notified = [];
  const u = await mkUser(); const p = await mkPayment(u);
  const rs = await Promise.all(Array.from({ length: 10 }, () => deliver(evt(p))));
  assert.ok(rs.every(r => r.status === 200), JSON.stringify(rs.map(r => r.status)));
  await new Promise(r => setTimeout(r, 150));
  const user = await getUser(u);
  assert.equal(user.plan, 'Premium');
  assert.ok(near(user.premiumExpiresAt - Date.now(), 30 * DAY), 'exactly one 30-day extension: ' + user.premiumExpiresAt);
  assert.equal((await getPay(p.id)).status, 'SUCCESSFUL');
  assert.equal(notified.length, 1);
});

test('PG: concurrent duplicates that differ only in event id still extend once', { skip }, async () => {
  const u = await mkUser(); const p = await mkPayment(u);
  await Promise.all(['a', 'b', 'c', 'd'].map(k => deliver(evt(p, 'evt_' + k + p.id))));
  assert.ok(near((await getUser(u)).premiumExpiresAt - Date.now(), 30 * DAY));
});

test('PG: two DISTINCT concurrent renewals for one user → both count (60 days)', { skip }, async () => {
  const u = await mkUser(); const a = await mkPayment(u), b = await mkPayment(u);
  const rs = await Promise.all([deliver(evt(a)), deliver(evt(b))]);
  assert.deepEqual(rs.map(r => r.status), [200, 200]);
  assert.ok(near((await getUser(u)).premiumExpiresAt - Date.now(), 60 * DAY), String((await getUser(u)).premiumExpiresAt));
  assert.equal((await getPay(a.id)).status, 'SUCCESSFUL'); assert.equal((await getPay(b.id)).status, 'SUCCESSFUL');
});

test('PG: concurrent monthly + yearly + monthly on an ACTIVE subscription stack onto the existing expiry', { skip }, async () => {
  const existing = new Date(Date.now() + 10 * DAY);
  const u = await mkUser({ plan: 'Premium', premiumExpiresAt: existing });
  const ps = [await mkPayment(u, 'monthly'), await mkPayment(u, 'yearly'), await mkPayment(u, 'monthly')];
  const rs = await Promise.all(ps.map(p => deliver(evt(p))));
  assert.ok(rs.every(r => r.status === 200));
  assert.ok(near((await getUser(u)).premiumExpiresAt - existing, (30 + 365 + 30) * DAY));
});

test('PG stress: 8 payments × 3 duplicate deliveries each, all at once, one user → exactly 8 renewals, no 5xx, no deadlock', { skip }, async () => {
  const u = await mkUser(); const ps = []; for (let i = 0; i < 8; i++) ps.push(await mkPayment(u));
  const reqs = ps.flatMap(p => [deliver(evt(p)), deliver(evt(p)), deliver(evt(p))]);
  const rs = await Promise.all(reqs);
  assert.deepEqual([...new Set(rs.map(r => r.status))], [200], 'statuses: ' + [...new Set(rs.map(r => r.status))]);
  assert.ok(near((await getUser(u)).premiumExpiresAt - Date.now(), 8 * 30 * DAY, 15000));
  for (const p of ps) assert.equal((await getPay(p.id)).status, 'SUCCESSFUL');
});

test('PG rollback: a failure AFTER the payment was claimed leaves the payment PENDING and the user unchanged; webhook answers 500; redelivery then works once', { skip }, async () => {
  const u = await mkUser(); const p = await mkPayment(u);
  const orig = db.$transaction;
  db.$transaction = async (fn) => orig(async (tx) => {                 // inject the failure inside the REAL transaction
    const real = tx.user.updateMany;
    tx.user.updateMany = async () => { await tx.$client.query('select 1/0'); };   // a genuine Postgres error mid-transaction
    return fn(tx);
  });
  let r;
  try { r = await deliver(evt(p)); } finally { db.$transaction = orig; }
  assert.equal(r.status, 500);
  const pay = await getPay(p.id), user = await getUser(u);
  assert.equal(pay.status, 'PENDING', 'claim rolled back by Postgres');
  assert.equal(pay.verifiedAt, null);
  assert.equal(user.plan, 'Free'); assert.equal(user.premiumExpiresAt, null);
  assert.equal((await deliver(evt(p))).status, 200);
  assert.ok(near((await getUser(u)).premiumExpiresAt - Date.now(), 30 * DAY));
});

test('PG: deliveries AFTER completion (same payload, new event id, late failed, underpaid) change nothing', { skip }, async () => {
  const u = await mkUser(); const p = await mkPayment(u);
  await deliver(evt(p));
  const before = (await getUser(u)).premiumExpiresAt.getTime();
  for (let i = 0; i < 3; i++) await deliver(evt(p));
  await deliver(evt(p, 'evt_other'));
  const failed = JSON.stringify({ id: 'evt_f', type: 'collection.failed', data: { checkout_id: p.checkoutId, metadata: { txRef: p.txRef } } });
  await deliver(failed);
  const under = JSON.stringify({ id: 'evt_u', type: 'collection.succeeded', data: { checkout_id: p.checkoutId, status: 'SUCCEEDED', currency: 'USD', amount: '0.01', metadata: { txRef: p.txRef } } });
  await deliver(under);
  assert.equal((await getUser(u)).premiumExpiresAt.getTime(), before);
  assert.equal((await getPay(p.id)).status, 'SUCCESSFUL');
});

// ======================= 2FA =======================
const secret = speakeasy.generateSecret({ length: 20 }).base32;
const BACKUPS = ['BACKUP-AAAA', 'BACKUP-BBBB', 'BACKUP-CCCC'];
async function mk2fa() {
  const hashes = await Promise.all(BACKUPS.map(c => bcrypt.hash(c, 4)));
  const id = await mkUser({ role: 'USER', dob: '1990-01-01', twoFactorEnabled: true, twoFactorSecret: secret });
  await db.$pool.query(`update "User" set "twoFactorBackupCodes"=$1::text[] where id=$2`, [hashes, id]);
  return id;
}
const verify2 = (id, code) => srv.call('POST', '/auth/2fa/verify-login', { body: { pendingToken: sign({ id, pending2FA: true }, { expiresIn: '5m' }), code } });
const codeAt = (steps = 0) => speakeasy.totp({ secret, encoding: 'base32', time: Date.now() / 1000 + steps * 30 });

test('PG 2FA: the SAME backup code in 4 simultaneous requests → exactly one session; array shrinks by one', { skip }, async () => {
  const id = await mk2fa();
  const rs = await Promise.all(Array.from({ length: 4 }, () => verify2(id, BACKUPS[0])));
  assert.equal(rs.filter(r => r.status === 200 && r.body.token).length, 1, JSON.stringify(rs.map(r => r.status)));
  assert.equal((await getUser(id)).twoFactorBackupCodes.length, 2);
});

test('PG 2FA: two DIFFERENT backup codes at once are both honoured', { skip }, async () => {
  const id = await mk2fa();
  const rs = await Promise.all([verify2(id, BACKUPS[0]), verify2(id, BACKUPS[1])]);
  assert.deepEqual(rs.map(r => r.status), [200, 200]);
  assert.equal((await getUser(id)).twoFactorBackupCodes.length, 1);
});

test('PG 2FA: the SAME TOTP code in 4 simultaneous requests → one session; replay afterwards refused; a later step accepted', { skip }, async () => {
  const id = await mk2fa(); const code = codeAt(0);
  const rs = await Promise.all(Array.from({ length: 4 }, () => verify2(id, code)));
  assert.equal(rs.filter(r => r.status === 200).length, 1);
  assert.equal((await verify2(id, code)).status, 401);
  assert.equal((await verify2(id, codeAt(1))).status, 200);
});

test('PG 2FA: 20 PARALLEL wrong guesses → only 5 evaluated (401), 15 locked (429); then even the right code is refused', { skip }, async () => {
  const id = await mk2fa();
  const rs = await Promise.all(Array.from({ length: 20 }, (_, i) => verify2(id, String(100000 + i))));
  assert.equal(rs.filter(r => r.status === 401).length, 5);
  assert.equal(rs.filter(r => r.status === 429).length, 15);
  assert.equal((await verify2(id, codeAt(0))).status, 429);
  await db.$pool.query(`update "User" set "twoFactorWindowEndsAt" = now() at time zone 'utc' - interval '1 second' where id=$1`, [id]);
  assert.equal((await verify2(id, codeAt(0))).status, 200, 'window over → allowed again, counter reset');
  assert.equal((await getUser(id)).twoFactorAttempts, 0);
});
