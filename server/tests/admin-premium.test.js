// Admin user list shows EFFECTIVE Premium status (from the expiry date), not the stored string.
// MOCKED in-memory database.
const test = require('node:test');
const assert = require('node:assert/strict');
const { stub, serve, tokenFor, table } = require('./helpers');

const DAY = 864e5;
const mk = (id, plan, exp) => ({ id, username: id, email: id + '@x.co', role: 'USER', plan, premiumExpiresAt: exp, createdAt: new Date() });
const users = table([
  { id: 'adm', username: 'adm', email: 'adm@x.co', role: 'ADMIN', plan: 'Free', premiumExpiresAt: null, createdAt: new Date() },
  mk('active', 'Premium', new Date(Date.now() + 5 * DAY)),
  mk('expired', 'Premium', new Date(Date.now() - 2 * DAY)),
  mk('noexp', 'Premium', null),
  mk('free', 'Free', null),
  mk('stale', 'Free', new Date(Date.now() + DAY))        // a date alone never grants Premium
]);
stub('db', { user: users, triageRecord: table([]), achievement: table([]), $transaction: async (o) => Promise.all(o) });
stub('utils/notify', async () => {});
let srv;
test.before(async () => { srv = await serve([['/api/admin', require('../src/routes/admin')]]); });
test.after(async () => { await srv.close(); });
const list = async (q = '') => (await srv.call('GET', '/api/admin/users?all=true' + q, { token: tokenFor({ id: 'adm', role: 'ADMIN' }) })).body.users;
const byId = (us, id) => us.find(u => u.id === id);

test('each user gets effective plan + premiumStatus + expiry; the stored value is kept as storedPlan', async () => {
  const us = await list();
  assert.deepEqual([byId(us, 'active').plan, byId(us, 'active').premiumStatus], ['Premium', 'active']);
  assert.deepEqual([byId(us, 'expired').plan, byId(us, 'expired').premiumStatus], ['Free', 'expired']);
  assert.equal(byId(us, 'expired').storedPlan, 'Premium');
  assert.ok(byId(us, 'expired').premiumExpiresAt);
  assert.deepEqual([byId(us, 'noexp').plan, byId(us, 'noexp').premiumStatus], ['Free', 'no_expiry']);
  assert.deepEqual([byId(us, 'free').plan, byId(us, 'free').premiumStatus], ['Free', 'free']);
  assert.equal(byId(us, 'stale').premiumStatus, 'free');
});

test('plan filter works on effective status: Premium = active only; Expired = lapsed or no expiry; Free = not currently Premium', async () => {
  const ids = async (q) => (await list('&plan=' + q)).map(u => u.id).filter(i => i !== 'adm').sort();
  assert.deepEqual(await ids('Premium'), ['active']);
  assert.deepEqual(await ids('Expired'), ['expired', 'noexp']);
  assert.deepEqual(await ids('Free'), ['expired', 'free', 'noexp', 'stale']);
});

test('user detail also reports status; the admin routes still reject non-admins', async () => {
  const d = await srv.call('GET', '/api/admin/users/expired', { token: tokenFor({ id: 'adm', role: 'ADMIN' }) });
  assert.equal(d.body.user.premiumStatus, 'expired');
  assert.equal(d.body.user.plan, 'Free');
  assert.equal(d.body.user.storedPlan, 'Premium');
  assert.equal(d.body.user.password, undefined);
  assert.equal((await srv.call('GET', '/api/admin/users', { token: tokenFor({ id: 'active', role: 'USER' }) })).status, 403);
});
