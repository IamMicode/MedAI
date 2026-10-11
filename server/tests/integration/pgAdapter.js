// A minimal stand-in for the slice of the Prisma client API that the webhook and
// 2FA code use, running REAL SQL on a REAL PostgreSQL connection pool with REAL
// transactions (READ COMMITTED, the Postgres default Prisma uses).
//
// What this does and does NOT prove:
//  + the application code under test is the real route code, unmodified;
//  + row locking, WHERE re-evaluation after a lock wait, atomic increments and
//    rollback are real PostgreSQL behaviour;
//  - the SQL is generated HERE, not by Prisma's query engine (which cannot be
//    downloaded in the sandbox this was written in). Prisma's own translation of
//    updateMany/increment/equals is therefore NOT exercised.
let pg;
try { pg = require('pg'); } catch (e) { pg = null; }

const TABLES = { user: 'User', payment: 'Payment' };
const q = (id) => '"' + String(id).replace(/"/g, '""') + '"';

function param(values, v) {
  if (v instanceof Date) { values.push(v.toISOString().replace('Z', '')); return `$${values.length}::timestamp`; }
  if (Array.isArray(v)) { values.push(v); return `$${values.length}::text[]`; }
  values.push(v); return `$${values.length}`;
}

function whereSql(where, values) {
  const parts = [];
  for (const [k, v] of Object.entries(where || {})) {
    if (k === 'AND') { parts.push('(' + v.map(w => whereSql(w, values) || 'TRUE').join(' AND ') + ')'); continue; }
    if (k === 'OR') { parts.push('(' + v.map(w => whereSql(w, values) || 'TRUE').join(' OR ') + ')'); continue; }
    if (k === 'NOT') { parts.push('NOT (' + (whereSql(v, values) || 'TRUE') + ')'); continue; }
    const col = q(k);
    if (v === null) { parts.push(`${col} IS NULL`); continue; }
    if (v && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v)) {
      for (const [op, val] of Object.entries(v)) {
        if (op === 'equals') parts.push(val === null ? `${col} IS NULL` : `${col} = ${param(values, val)}`);
        else if (op === 'not') parts.push(val === null ? `${col} IS NOT NULL` : `${col} <> ${param(values, val)}`);
        else if (op === 'lt') parts.push(`${col} < ${param(values, val)}`);
        else if (op === 'lte') parts.push(`${col} <= ${param(values, val)}`);
        else if (op === 'gt') parts.push(`${col} > ${param(values, val)}`);
        else if (op === 'gte') parts.push(`${col} >= ${param(values, val)}`);
        else if (op === 'in') parts.push(`${col} = ANY(${param(values, val)})`);
        else throw new Error('pgAdapter: unsupported operator ' + op);
      }
      continue;
    }
    parts.push(Array.isArray(v) ? `${col} = ${param(values, v)}` : `${col} = ${param(values, v)}`);
  }
  return parts.join(' AND ');
}

function setSql(data, values) {
  return Object.entries(data).map(([k, v]) => {
    if (v && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v)) {
      if ('increment' in v) return `${q(k)} = COALESCE(${q(k)}, 0) + ${param(values, v.increment)}`;
      if ('decrement' in v) return `${q(k)} = COALESCE(${q(k)}, 0) - ${param(values, v.decrement)}`;
    }
    return `${q(k)} = ${v === null ? 'NULL' : param(values, v)}`;
  }).join(', ');
}
const colsSql = (select) => select ? Object.keys(select).filter(k => select[k]).map(q).join(', ') : '*';

function model(run, table) {
  return {
    async findUnique({ where, select }) {
      const values = []; const w = whereSql(where, values);
      const { rows } = await run(`SELECT ${colsSql(select)} FROM ${q(table)} WHERE ${w || 'TRUE'} LIMIT 1`, values);
      return rows[0] || null;
    },
    async findFirst(args) { return this.findUnique(args); },
    async updateMany({ where, data }) {
      const values = []; const set = setSql(data, values); const w = whereSql(where, values);
      const r = await run(`UPDATE ${q(table)} SET ${set} WHERE ${w || 'TRUE'}`, values);
      return { count: r.rowCount };
    },
    async update({ where, data, select }) {
      const values = []; const set = setSql(data, values); const w = whereSql(where, values);
      const r = await run(`UPDATE ${q(table)} SET ${set} WHERE ${w || 'TRUE'} RETURNING ${colsSql(select)}`, values);
      if (!r.rowCount) throw new Error('pgAdapter: record to update not found');
      return r.rows[0];
    }
  };
}

function makePrisma(connectionString) {
  if (!pg) throw new Error("the 'pg' package is required: npm i --no-save pg");
  pg.types.setTypeParser(1114, (s) => new Date(s.replace(' ', 'T') + 'Z'));   // timestamp (no tz) is stored as UTC
  const pool = new pg.Pool({ connectionString, max: 30 });
  const bind = (runner) => Object.fromEntries(Object.entries(TABLES).map(([m, t]) => [m, model(runner, t)]));
  const db = bind((sql, values) => pool.query(sql, values));
  db.$pool = pool;
  db.$transaction = async (arg) => {
    if (Array.isArray(arg)) return Promise.all(arg);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const tx = bind((sql, values) => client.query(sql, values));
      tx.$client = client;
      const out = await arg(tx);
      await client.query('COMMIT');
      return out;
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch (_) { /* connection already gone */ }
      throw e;
    } finally { client.release(); }
  };
  return db;
}
module.exports = { makePrisma, available: !!pg };
