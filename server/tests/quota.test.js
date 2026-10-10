const test = require('node:test');
const assert = require('node:assert/strict');
const { stub, serve, tokenFor, SRC } = require('./helpers');

const users = { free: { id: 'free', plan: 'Free' }, prem: { id: 'prem', plan: 'Premium' }, legacy: { id: 'legacy', plan: 'FREE' } };
let usage = {};
const key = (w) => `${w.userId_date.userId}|${w.userId_date.date}`;
stub('db', {
  user: { findUnique: async ({ where }) => users[where.id] },
  aIUsage: {
    upsert: async ({ where, update, create }) => {
      await null;
      const k = key(where);
      if (usage[k]) usage[k].count += update.count.increment; else usage[k] = { ...create };
      return { ...usage[k] };
    },
    update: async ({ where, data }) => { usage[key(where)].count -= data.count.decrement; }
  }
});
const aiLimit = require(`${SRC}/middleware/aiLimit`);

async function hit(id) {
  const out = {};
  const res = { locals: {}, status(c) { out.status = c; return this; }, json(b) { out.body = b; } };
  await aiLimit({ user: { id } }, res, () => { out.next = true; });
  return out;
}

test('free user: 10 allowed, then 429, counter never exceeds the limit', async () => {
  usage = {};
  const r = []; for (let i = 0; i < 12; i++) r.push(await hit('free'));
  assert.equal(r.filter(x => x.next).length, 10);
  assert.equal(r.filter(x => x.status === 429).length, 2);
  assert.equal(r[11].body.upgradeRequired, true);
  assert.equal(Object.values(usage)[0].count, 10);
});

test('concurrent requests cannot slip past the cap', async () => {
  usage = {};
  const r = await Promise.all(Array.from({ length: 25 }, () => hit('free')));
  assert.equal(r.filter(x => x.next).length, 10);
});

test('premium users are not limited', async () => {
  usage = {};
  const r = await Promise.all(Array.from({ length: 15 }, () => hit('prem')));
  assert.equal(r.filter(x => x.next).length, 15);
});

test("legacy upper-case 'FREE' plan value is still treated as free", async () => {
  usage = {};
  const r = []; for (let i = 0; i < 11; i++) r.push(await hit('legacy'));
  assert.equal(r.filter(x => x.next).length, 10);
});
