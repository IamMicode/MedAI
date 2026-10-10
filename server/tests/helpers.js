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
    authLimiter: noLimit, aiLimiter: noLimit, paymentInitLimiter: noLimit,
    paymentStatusLimiter: noLimit, healthLogLimiter: noLimit
  });
}

const express = require('express');
const jwt = require('jsonwebtoken');

function sign(payload, opts = { expiresIn: '1h' }) {
  return jwt.sign(payload, process.env.JWT_SECRET, opts);
}
const tokenFor = (user) => sign({ id: user.id, email: user.email, username: user.username, role: user.role });

async function serve(mounts, { raw = false } = {}) {
  const app = express();
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
function match(row, where) {
  return Object.entries(where || {}).every(([k, v]) => {
    if (k === 'AND') return v.every(w => match(row, w));
    if (k === 'OR') return v.some(w => match(row, w));
    if (v && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v)) {
      if ('in' in v) return v.in.includes(row[k]);
      if ('lt' in v) return row[k] != null && row[k] < v.lt;
      if ('gt' in v) return row[k] != null && row[k] > v.gt;
      if ('not' in v) return v.not === null ? row[k] != null : row[k] !== v.not;
      if ('equals' in v) return String(row[k]).toLowerCase() === String(v.equals).toLowerCase();
      // compound unique key, e.g. doctorId_patientId: { doctorId, patientId }
      return match(row, v);
    }
    return row[k] === v;
  });
}
let seq = 0;
function table(rows = [], defaults = {}) {
  const t = {
    rows,
    findUnique: async ({ where, select }) => pick(rows.find(r => match(r, where)), select),
    findFirst: async ({ where, select }) => pick(rows.find(r => match(r, where)), select),
    findMany: async ({ where } = {}) => rows.filter(r => match(r, where)),
    create: async ({ data }) => { const r = { id: 'id' + (++seq), createdAt: new Date(), ...defaults, ...data }; rows.push(r); return { ...r }; },
    update: async ({ where, data }) => { const r = rows.find(x => match(x, where)); if (!r) throw new Error('not found'); Object.assign(r, data); return { ...r }; },
    updateMany: async ({ where, data }) => { const m = rows.filter(r => match(r, where)); m.forEach(r => Object.assign(r, data)); return { count: m.length }; },
    deleteMany: async ({ where }) => { const keep = rows.filter(r => !match(r, where)); const n = rows.length - keep.length; rows.length = 0; rows.push(...keep); return { count: n }; },
    count: async ({ where } = {}) => rows.filter(r => match(r, where)).length
  };
  return t;
}
function pick(row, select) {
  if (!row) return null;
  if (!select) return { ...row };
  return Object.fromEntries(Object.keys(select).filter(k => select[k]).map(k => [k, row[k]]));
}
module.exports.table = table;
module.exports.match = match;
