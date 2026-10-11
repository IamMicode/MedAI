// Shared test helpers. Tests run the REAL route/middleware code; only the
// database module (and, where noted, outbound services) is replaced with an
// in-memory fake. Each *.test.js file runs in its own process (node --test),
// so module stubs never leak between files.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-not-a-real-secret';
process.env.NODE_ENV = 'test';

const path = require('path');
const SRC = path.join(__dirname, '..', 'src');

function stub(relPath, exports) {
  const file = require.resolve(path.join(SRC, relPath));
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
}

// Passes every request through — used so rate limiting doesn't interfere with
// tests that make many calls. (rate-limit behaviour has its own test.)
const noLimit = (req, res, next) => next();
function stubRateLimits() {
  stub('middleware/rateLimits', {
    authLimiter: noLimit, doctorLoginLimiter: noLimit, doctorRegisterLimiter: noLimit, aiLimiter: noLimit, paymentInitLimiter: noLimit,
    paymentStatusLimiter: noLimit, healthLogLimiter: noLimit
  });
}

const express = require('express');
const jwt = require('jsonwebtoken');

function sign(payload, opts = { expiresIn: '1h' }) {
  return jwt.sign(payload, process.env.JWT_SECRET, opts);
}
// A full, current-version session token (typed, DOB confirmed). Tests of the legacy /
// no-DOB paths build their own tokens with sign().
const tokenFor = (user) => sign({ id: user.id, email: user.email, username: user.username, role: user.role, typ: 'access', dobOk: true });

async function serve(mounts, { raw = false, trustProxy } = {}) {
  const app = express();
  if (trustProxy !== undefined) app.set('trust proxy', trustProxy);
  app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));
  for (const [p, router] of mounts) app.use(p, router);
  app.use((err, req, res, next) => res.status(err.status || 500).json({ message: err.message }));
  const server = await new Promise(r => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function call(method, url, { token, body, headers = {}, rawBody } = {}) {
    const h = { ...headers };
    if (token) h.Authorization = `Bearer ${token}`;
    if (body !== undefined) h['Content-Type'] = 'application/json';
    const res = await fetch(base + url, {
      method, headers: h,
      body: rawBody !== undefined ? rawBody : (body !== undefined ? JSON.stringify(body) : undefined),
      redirect: 'manual'
    });
    let json = null;
    try { json = await res.json(); } catch (e) { /* non-JSON (redirects) */ }
    return { status: res.status, body: json, headers: res.headers };
  }
  return { call, close: () => new Promise(r => server.close(r)), base };
}

module.exports = { stub, stubRateLimits, serve, sign, tokenFor, SRC, jwt };

// ---- tiny in-memory "Prisma table" so tests exercise real query shapes ----
const same = (a, b) => {
  if (a instanceof Date || b instanceof Date) return a != null && b != null && new Date(a).getTime() === new Date(b).getTime();
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]);
  return (a ?? null) === (b ?? null);
};
function match(row, where) {
  return Object.entries(where || {}).every(([k, v]) => {
    if (k === 'AND') return v.every(w => match(row, w));
    if (k === 'OR') return v.some(w => match(row, w));
    if (k === 'NOT') return !match(row, v);
    if (v && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v)) {
      if ('in' in v) return v.in.includes(row[k]);
      if ('lt' in v) return row[k] != null && row[k] < v.lt;
      if ('lte' in v) return row[k] != null && row[k] <= v.lte;
      if ('gt' in v) return row[k] != null && row[k] > v.gt;
      if ('gte' in v) return row[k] != null && row[k] >= v.gte;
      if ('not' in v) return v.not === null ? row[k] != null : !same(row[k], v.not);
      if ('equals' in v) {
        if (Array.isArray(v.equals) || v.equals instanceof Date || row[k] instanceof Date) return same(row[k], v.equals);
        return String(row[k]).toLowerCase() === String(v.equals).toLowerCase();
      }
      // compound unique key, e.g. doctorId_patientId: { doctorId, patientId }
      return match(row, v);
    }
    return same(row[k], v);
  });
}
// Applies a Prisma `data` object, including atomic { increment } / { decrement }.
function applyData(row, data) {
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v) && ('increment' in v || 'decrement' in v)) {
      row[k] = (row[k] || 0) + (v.increment || 0) - (v.decrement || 0);
    } else row[k] = v;
  }
}
const tick = (ms) => new Promise(r => (ms > 1 ? setTimeout(r, ms) : setImmediate(r)));
let seq = 0;
// `opts.yield` makes every operation yield to the event loop first, so two
// "simultaneous" requests really interleave. Each single operation then runs
// atomically (like one SQL statement), which is what Postgres guarantees too.
// `onWrite(row)` is called with a copy of each row BEFORE it is changed — used by
// the transaction fake below to roll writes back.
function table(rows = [], defaults = {}, opts = {}) {
  const y = async () => { if (opts.yield) await tick(opts.yield); };
  const log = (row, ctx) => { if (ctx && ctx.onWrite) ctx.onWrite(t, row, { ...row }); };
  const t = {
    rows,
    findUnique: async ({ where, select }) => { await y(); return pick(rows.find(r => match(r, where)), select); },
    findFirst: async ({ where, select }) => { await y(); return pick(rows.find(r => match(r, where)), select); },
    findMany: async ({ where } = {}) => { await y(); return rows.filter(r => match(r, where)); },
    create: async ({ data }, ctx) => { await y(); const r = { id: 'id' + (++seq), createdAt: new Date(), ...defaults, ...data }; rows.push(r); if (ctx && ctx.onCreate) ctx.onCreate(t, r); return { ...r }; },
    update: async ({ where, data, select }, ctx) => { await y(); const r = rows.find(x => match(x, where)); if (!r) throw new Error('not found'); log(r, ctx); applyData(r, data); return pick(r, select); },
    updateMany: async ({ where, data }, ctx) => { await y(); const m = rows.filter(r => match(r, where)); m.forEach(r => { log(r, ctx); applyData(r, data); }); return { count: m.length }; },
    deleteMany: async ({ where }) => { await y(); const keep = rows.filter(r => !match(r, where)); const n = rows.length - keep.length; rows.length = 0; rows.push(...keep); return { count: n }; },
    count: async ({ where } = {}) => { await y(); return rows.filter(r => match(r, where)).length; }
  };
  return t;
}
function pick(row, select) {
  if (!row) return null;
  if (!select) return { ...row };
  return Object.fromEntries(Object.keys(select).filter(k => select[k]).map(k => [k, row[k]]));
}

// A fake `prisma` with interactive transactions that really ROLL BACK: writes
// made through `tx` are undone if the callback throws. (Array-style
// $transaction([...]) is supported too.) Concurrent transactions are NOT
// serialised, same as Postgres READ COMMITTED — correctness has to come from
// the conditional writes in the code under test, which is the point.
function makeDb(tables) {
  const db = { ...tables };
  db.$transaction = async (arg) => {
    if (Array.isArray(arg)) return Promise.all(arg);
    const undo = [];
    const creates = [];
    const hook = (t, row, before) => undo.push(() => { for (const k of Object.keys(row)) if (!(k in before)) delete row[k]; Object.assign(row, before); });
    const hookCreate = (t, row) => creates.push(() => { const i = t.rows.indexOf(row); if (i >= 0) t.rows.splice(i, 1); });
    const names = Object.keys(tables).filter(k => tables[k] && tables[k].rows);
    const ctx = { onWrite: hook, onCreate: hookCreate };
    const tx = {};
    for (const n of names) {
      const t = tables[n];
      tx[n] = { ...t };
      for (const m of ['update', 'updateMany', 'create']) tx[n][m] = (a) => t[m](a, ctx);
    }
    try {
      return await arg(tx);
    } catch (e) {
      undo.reverse().forEach(f => f());
      creates.forEach(f => f());
      throw e;
    }
  };
  return db;
}
module.exports.table = table;
module.exports.match = match;
module.exports.makeDb = makeDb;
