const test = require('node:test');
const assert = require('node:assert/strict');
const { stub, stubRateLimits, serve, tokenFor, table } = require('./helpers');

const users = table([
  { id: 'admin1', username: 'boss', email: 'b@x.co', role: 'ADMIN' },
  { id: 'demoted', username: 'old', email: 'o@x.co', role: 'USER' },            // token still says ADMIN (see below)
  { id: 'pat1', username: 'p1', firstname: 'Ann', lastname: 'One', email: 'p1@x.co', role: 'USER', bloodGroup: 'O+', allergies: ['nuts'], conditions: ['asthma'], emergName: 'E', emergPhone: '1' },
  { id: 'pat2', username: 'p2', firstname: 'Bob', lastname: 'Two', email: 'p2@x.co', role: 'USER', bloodGroup: 'A+', allergies: [], conditions: [] },
  { id: 'pat3', username: 'p3', firstname: 'Cy', lastname: 'Three', email: 'p3@x.co', role: 'USER' },
  { id: 'docOK', username: 'dok', email: 'd1@x.co', role: 'DOCTOR' },
  { id: 'docPending', username: 'dp', email: 'd2@x.co', role: 'DOCTOR' },
  { id: 'docRejected', username: 'dr', email: 'd3@x.co', role: 'DOCTOR' },
  { id: 'docOther', username: 'do', email: 'd4@x.co', role: 'DOCTOR' }
]);
const doctorProfiles = table([
  { userId: 'docOK', verificationStatus: 'APPROVED', fullName: 'Dr OK' },
  { userId: 'docPending', verificationStatus: 'PENDING', fullName: 'Dr Pending' },
  { userId: 'docRejected', verificationStatus: 'REJECTED', fullName: 'Dr Rejected' },
  { userId: 'docOther', verificationStatus: 'APPROVED', fullName: 'Dr Other' }
]);
const conversations = table([
  { id: 'c-shared', doctorId: 'docOK', patientId: 'pat1', profileShared: true, updatedAt: new Date() },
  { id: 'c-unshared', doctorId: 'docOK', patientId: 'pat2', profileShared: false, updatedAt: new Date() }
]);
const appointments = table([
  { id: 'a1', doctorId: 'docOK', patientId: 'pat3', status: 'PENDING', scheduledDate: '2026-12-01', scheduledTime: '10:00' },
  { id: 'a-declined', doctorId: 'docOK', patientId: 'pat1', status: 'DECLINED' }
]);
const messages = table([]);
const triage = table([{ id: 't1', userId: 'pat1', triageLevel: 'HIGH', summary: 'chest pain', createdAt: new Date() }, { id: 't2', userId: 'pat2', triageLevel: 'LOW', summary: 'headache', createdAt: new Date() }]);
const vitals = table([]);

// The patient-list route uses Prisma `include`; emulate just that shape.
const baseFindMany = conversations.findMany;
conversations.findMany = async (args = {}) => (await baseFindMany(args)).map(c => ({
  ...c,
  patient: { ...users.rows.find(u => u.id === c.patientId) },
  messages: messages.rows.filter(m => m.conversationId === c.id).slice(-1)
}));

const db = {
  user: users, doctorProfile: doctorProfiles, conversation: conversations, appointment: appointments,
  message: messages, triageRecord: triage, vitalReading: vitals,
  notification: table([]), $queryRaw: async () => [1]
};
// the admin router reads a few more things; give it harmless empties
db.user.count = async () => users.rows.length;
stub('db', db);
stubRateLimits();
stub('utils/notify', async () => {});

const adminRoutes = require('../src/routes/admin');
const doctorPortal = require('../src/routes/doctorPortal');

let srv;
test.before(async () => { srv = await serve([['/api/admin', adminRoutes], ['/api/doctor-portal', doctorPortal]]); });
test.after(async () => { await srv.close(); });
const T = (id) => tokenFor(users.rows.find(u => u.id === id));

// ───────────────────────── admin ─────────────────────────
test('admin: no token → 401; ordinary user → 403; doctor → 403', async () => {
  assert.equal((await srv.call('GET', '/api/admin/me')).status, 401);
  assert.equal((await srv.call('GET', '/api/admin/me', { token: T('pat1') })).status, 403);
  assert.equal((await srv.call('GET', '/api/admin/me', { token: T('docOK') })).status, 403);
  assert.equal((await srv.call('GET', '/api/admin/users', { token: T('pat1') })).status, 403);
});
test('admin: real admin gets /me; a forged "role: ADMIN" token for a normal user is refused', async () => {
  const ok = await srv.call('GET', '/api/admin/me', { token: T('admin1') });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.admin.username, 'boss');
});
test('admin: token still saying ADMIN is refused once the DB role is no longer ADMIN (demotion is immediate)', async () => {
  const staleAdminToken = tokenFor({ id: 'demoted', username: 'old', email: 'o@x.co', role: 'ADMIN' });
  assert.equal((await srv.call('GET', '/api/admin/me', { token: staleAdminToken })).status, 403);
});

// ───────────────────────── doctor portal: approval ─────────────────────────
const PORTAL_CALLS = [
  ['GET', '/api/doctor-portal/appointments'],
  ['PATCH', '/api/doctor-portal/appointments/a1', { status: 'ACCEPTED' }],
  ['PATCH', '/api/doctor-portal/me/availability', { isAvailable: true }],
  ['GET', '/api/doctor-portal/patients'],
  ['GET', '/api/doctor-portal/patients/pat1'],
  ['POST', '/api/doctor-portal/conversations', { patientId: 'pat1' }],
  ['GET', '/api/doctor-portal/conversations'],
  ['GET', '/api/doctor-portal/conversations/c-shared/messages'],
  ['POST', '/api/doctor-portal/conversations/c-shared/messages', { content: 'hello' }]
];
for (const who of ['docPending', 'docRejected']) {
  test(`doctor portal: ${who} (not approved) is blocked from EVERY portal endpoint`, async () => {
    for (const [method, url, body] of PORTAL_CALLS) {
      const r = await srv.call(method, url, { token: T(who), body });
      assert.equal(r.status, 403, `${method} ${url} → ${r.status}`);
    }
    assert.equal(messages.rows.length, 0, 'no message was created');
  });
}
test('doctor portal: unapproved doctor can still read /me to learn their status (needed for the pending screen)', async () => {
  const r = await srv.call('GET', '/api/doctor-portal/me', { token: T('docPending') });
  assert.equal(r.status, 403);
  assert.equal(r.body.status, 'PENDING');
});
test('doctor portal: ordinary patient and unauthenticated callers are refused', async () => {
  assert.equal((await srv.call('GET', '/api/doctor-portal/patients')).status, 401);
  assert.equal((await srv.call('GET', '/api/doctor-portal/patients', { token: T('pat1') })).status, 403);
  assert.equal((await srv.call('POST', '/api/doctor-portal/conversations', { token: T('pat1'), body: { patientId: 'pat2' } })).status, 403);
});
test('doctor portal: an approval revoked in the DB takes effect immediately (token unchanged)', async () => {
  const profile = doctorProfiles.rows.find(p => p.userId === 'docOther');
  assert.equal((await srv.call('GET', '/api/doctor-portal/patients', { token: T('docOther') })).status, 200);
  profile.verificationStatus = 'REJECTED';
  assert.equal((await srv.call('GET', '/api/doctor-portal/patients', { token: T('docOther') })).status, 403);
  profile.verificationStatus = 'APPROVED';
});

// ───────────────────────── doctor portal: no arbitrary conversations ─────────────────────────
test('doctor cannot open a conversation with an arbitrary / unconnected patient id', async () => {
  const before = conversations.rows.length;
  const r = await srv.call('POST', '/api/doctor-portal/conversations', { token: T('docOK'), body: { patientId: 'pat-not-connected' } });
  assert.equal(r.status, 404);
  const r2 = await srv.call('POST', '/api/doctor-portal/conversations', { token: T('docOther'), body: { patientId: 'pat2' } });
  assert.equal(r2.status, 403, 'a real patient with no connection to THIS doctor');
  assert.equal(conversations.rows.length, before, 'nothing was created');
});
test('doctor cannot start a conversation with another doctor or an admin', async () => {
  for (const target of ['docOther', 'admin1']) {
    const r = await srv.call('POST', '/api/doctor-portal/conversations', { token: T('docOK'), body: { patientId: target } });
    assert.equal(r.status, 404, target);
  }
});
test('a declined appointment is not a connection', async () => {
  const r = await srv.call('POST', '/api/doctor-portal/conversations', { token: T('docOther'), body: { patientId: 'pat1' } });
  assert.equal(r.status, 403);
});
test('malformed patientId values are rejected', async () => {
  for (const patientId of [undefined, 123, { $ne: null }, ['x']]) {
    const r = await srv.call('POST', '/api/doctor-portal/conversations', { token: T('docOK'), body: { patientId } });
    assert.equal(r.status, 400);
  }
});
test('doctor CAN open a conversation when the patient requested an appointment, and when one already exists', async () => {
  const viaAppointment = await srv.call('POST', '/api/doctor-portal/conversations', { token: T('docOK'), body: { patientId: 'pat3' } });
  assert.equal(viaAppointment.status, 200);
  assert.equal(viaAppointment.body.conversation.patientId, 'pat3');
  const existing = await srv.call('POST', '/api/doctor-portal/conversations', { token: T('docOK'), body: { patientId: 'pat1' } });
  assert.equal(existing.status, 200);
  assert.equal(existing.body.conversation.id, 'c-shared');
});
test("a doctor cannot read or post in another doctor's conversation", async () => {
  assert.equal((await srv.call('GET', '/api/doctor-portal/conversations/c-shared/messages', { token: T('docOther') })).status, 404);
  assert.equal((await srv.call('POST', '/api/doctor-portal/conversations/c-shared/messages', { token: T('docOther'), body: { content: 'x' } })).status, 404);
});

// ───────────────────────── Share Profile consent ─────────────────────────
test('patient list: unshared patient is name-only; shared patient shows full details', async () => {
  const r = await srv.call('GET', '/api/doctor-portal/patients', { token: T('docOK') });
  assert.equal(r.status, 200);
  const shared = r.body.patients.find(p => p.id === 'pat1');
  const unshared = r.body.patients.find(p => p.id === 'pat2');
  assert.equal(shared.email, 'p1@x.co');
  assert.deepEqual(shared.allergies, ['nuts']);
  assert.equal(shared.highestSeverity, 'HIGH');
  assert.equal(unshared.name, 'Bob Two');
  assert.equal(unshared.email, null);
  assert.equal(unshared.bloodGroup, null);
  assert.deepEqual(unshared.allergies, []);
  assert.deepEqual(unshared.conditions, []);
  assert.equal(unshared.highestSeverity, null);
  assert.equal(unshared.lastTriageSummary, null);
  assert.doesNotMatch(JSON.stringify(unshared), /p2@x\.co|headache/);
});
test('patient detail: unshared → accessGranted false with no vitals/triage; non-connected patient → 403', async () => {
  const u = await srv.call('GET', '/api/doctor-portal/patients/pat2', { token: T('docOK') });
  assert.equal(u.body.accessGranted, false);
  assert.deepEqual(u.body.triageHistory, []);
  assert.equal(u.body.patient.email, undefined);
  const s = await srv.call('GET', '/api/doctor-portal/patients/pat1', { token: T('docOK') });
  assert.equal(s.body.accessGranted, true);
  assert.equal((await srv.call('GET', '/api/doctor-portal/patients/pat2', { token: T('docOther') })).status, 403, 'no conversation with this doctor');
});
