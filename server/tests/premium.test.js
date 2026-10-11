// Premium expiry — MOCKED services only (in-memory fake Prisma, no live Bachs).
const test = require('node:test');
const assert = require('node:assert/strict');
const { stub, serve, tokenFor, SRC } = require('./helpers');

const DAY = 864e5;
const users = {
  active:  { id: 'active',  plan: 'Premium', premiumExpiresAt: new Date(Date.now() + 5 * DAY) },
  expired: { id: 'expired', plan: 'Premium', premiumExpiresAt: new Date(Date.now() - 1000) },
  nullexp: { id: 'nullexp', plan: 'Premium', premiumExpiresAt: null },
  lower:   { id: 'lower',   plan: 'premium', premiumExpiresAt: new Date(Date.now() + DAY) },
  free:    { id: 'free',    plan: 'Free',    premiumExpiresAt: null },
  freeWithFutureDate: { id: 'freeWithFutureDate', plan: 'Free', premiumExpiresAt: new Date(Date.now() + DAY) }
};
let usage = {};
const key = (w) => `${w.userId_date.userId}|${w.userId_date.date}`;
stub('db', {
  user: { findUnique: async ({ where }) => users[where.id] },
  aIUsage: {
    findUnique: async () => null,
    upsert: async ({ where, update, create }) => {
      const k = key(where);
      if (usage[k]) usage[k].count += update.count.increment; else usage[k] = { ...create };
      return { ...usage[k] };
    },
    update: async ({ where, data }) => { usage[key(where)].count -= data.count.decrement; }
  }
});
const aiLimit = require(`${SRC}/middleware/aiLimit`);
const { isPremiumActive, effectivePlan } = require(`${SRC}/utils/premium`);
const sanitizeUser = require(`${SRC}/utils/sanitizeUser`);

async function burst(id, n = 12) {
  usage = {};
  const out = [];
  for (let i = 0; i < n; i++) {
    const o = {};
    const res = { locals: {}, status(c) { o.status = c; return this; }, json(b) { o.body = b; } };
    await aiLimit({ user: { id } }, res, () => { o.next = true; });
    out.push(o);
  }
  return out;
}

test('helper: active / expired / null / unparseable / casing / missing user', () => {
  assert.equal(isPremiumActive(users.active), true);
  assert.equal(isPremiumActive(users.lower), true);
  assert.equal(isPremiumActive(users.expired), false);
  assert.equal(isPremiumActive(users.nullexp), false, 'null expiry is not permanent Premium');
  assert.equal(isPremiumActive({ plan: 'Premium', premiumExpiresAt: 'garbage' }), false);
  assert.equal(isPremiumActive({ plan: 'Premium' }), false);
  assert.equal(isPremiumActive(users.free), false);
  assert.equal(isPremiumActive(users.freeWithFutureDate), false, 'a date alone never grants Premium');
  assert.equal(isPremiumActive(null), false);
  assert.equal(effectivePlan(users.expired), 'Free');
  assert.equal(effectivePlan(users.active), 'Premium');
});

test('AI limit: active Premium is unlimited', async () => {
  assert.equal((await burst('active')).filter(r => r.next).length, 12);
});
test('AI limit: EXPIRED Premium is capped at the free limit (10) then 429', async () => {
  const r = await burst('expired');
  assert.equal(r.filter(x => x.next).length, 10);
  assert.equal(r.filter(x => x.status === 429).length, 2);
});
test('AI limit: Premium with NULL expiry is treated as Free', async () => {
  assert.equal((await burst('nullexp')).filter(x => x.next).length, 10);
});
test('AI limit: renewal restores access without any other change', async () => {
  assert.equal((await burst('expired')).filter(x => x.next).length, 10);
  users.expired.premiumExpiresAt = new Date(Date.now() + 30 * DAY);   // what the webhook does
  assert.equal((await burst('expired')).filter(x => x.next).length, 12);
  users.expired.premiumExpiresAt = new Date(Date.now() - 1000);
});

test('API output never reports a lapsed plan as Premium (stale stored plan, stale JWT irrelevant)', () => {
  assert.equal(sanitizeUser({ ...users.expired, password: 'x' }).plan, 'Free');
  assert.equal(sanitizeUser({ ...users.active }).plan, 'Premium');
  assert.equal(sanitizeUser({ ...users.expired }).premiumExpiresAt instanceof Date, true);
});

test('/ai/usage reflects expiry server-side even if the token claims Premium', async () => {
  const router = require(`${SRC}/routes/ai`);
  const srv = await serve([['/api/ai', router]]);
  try {
    const t = (id) => tokenFor({ id, role: 'USER', plan: 'Premium' }); // forged/stale plan claim
    const bad = await srv.call('GET', '/api/ai/usage', { token: t('expired') });
    assert.equal(bad.body.isPremium, false);
    assert.equal(bad.body.limit, 10);
    const good = await srv.call('GET', '/api/ai/usage', { token: t('active') });
    assert.equal(good.body.isPremium, true);
    assert.equal(good.body.limit, null);
  } finally { await srv.close(); }
});

test('sanitizeUser never exposes 2FA secrets or the new 2FA counters', () => {
  const out = sanitizeUser({ id: 'x', plan: 'Free', password: 'h', twoFactorSecret: 's', twoFactorPendingSecret: 'p', twoFactorBackupCodes: ['h'], twoFactorLastStep: 5, twoFactorAttempts: 2, twoFactorWindowEndsAt: new Date() });
  for (const k of ['password', 'twoFactorSecret', 'twoFactorPendingSecret', 'twoFactorBackupCodes', 'twoFactorLastStep', 'twoFactorAttempts', 'twoFactorWindowEndsAt']) assert.equal(k in out, false, k);
});
