const jwt = require('jsonwebtoken');
const prisma = require('../db');

// ───────────────────────── access-token typing ─────────────────────────
// Every token we sign uses the same secret, so the TYPE is what keeps a
// mid-login token (2FA pendingToken, date-of-birth step token) from being used
// as a session. Full sessions carry `typ: 'access'`, and ONLY that is accepted.
//
// Rollout (no secret rotation, no mass logout): tokens issued before this code
// shipped have no `typ`. They are accepted only while ALL of these hold:
//   - no `typ`, and not a pending2FA / purpose token,
//   - they carry the id + role claims a session token always had,
//   - they were issued BEFORE the legacy cutoff.
// The cutoff defaults to this process's start time, i.e. the moment this version
// went live: nothing this version signs is untyped, so the exception can only
// ever cover tokens minted by the previous deployment, and it disappears on its
// own as they expire (JWT_EXPIRES_IN, 7 days by default). Set
// ACCESS_TOKEN_LEGACY_CUTOFF to an ISO date to pin it, or to a past date such as
// 1970-01-01 to refuse all untyped tokens immediately (forces re-login).
const PROCESS_START_MS = Date.now();
function legacyCutoffMs() {
  const raw = process.env.ACCESS_TOKEN_LEGACY_CUTOFF;
  if (!raw) return PROCESS_START_MS;
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? 0 : parsed;   // unparseable → fail closed
}

// Verifies the bearer token and its TYPE. Returns { payload } or { error }.
function authenticateAccessToken(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return { error: 'Login required.' };
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return { error: 'Invalid or expired login token.' };
  }
  const invalid = { error: 'Invalid or expired login token.' };
  // Mid-login tokens are never sessions, whatever else they claim.
  if (payload.pending2FA || payload.purpose) return invalid;
  if (payload.typ !== undefined) {
    return payload.typ === 'access' ? { payload } : invalid;
  }
  const legacyOk = payload.id && payload.role && typeof payload.iat === 'number' && payload.iat < Math.floor(legacyCutoffMs() / 1000);   // iat has 1-second resolution
  return legacyOk ? { payload } : invalid;
}

// Full session check: valid typed token, PLUS the 18+ completion rule — a
// patient (role USER) with no date of birth on file may not use any protected
// route until they supply one. Tokens issued by this version after the DOB was
// confirmed carry `dobOk` and skip the lookup; older tokens (and any token that
// lacks the claim) are checked against the database, so a legacy session cannot
// outlive the policy. Doctors and admins are not patients and are not gated.
// Only the date-of-birth completion endpoint uses authenticateAccessToken()
// directly, so it is the one thing a no-DOB patient can still reach.
async function requireAuth(req, res, next) {
  const auth = authenticateAccessToken(req);
  if (auth.error) return res.status(401).json({ message: auth.error });
  req.user = auth.payload;
  if (req.user.role !== 'USER' || req.user.dobOk === true) return next();
  try {
    const row = await prisma.user.findUnique({ where: { id: req.user.id }, select: { dob: true } });
    if (!row) return res.status(401).json({ message: 'Invalid or expired login token.' });
    if (!row.dob) {
      return res.status(403).json({
        code: 'DOB_REQUIRED',
        message: 'Please enter your date of birth to continue. MedAI is for adults aged 18 or over.'
      });
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

// Admin access is decided by the role currently stored in the DATABASE, not
// just the role claim inside the token. A token is valid for days; checking
// the DB means a demoted or deleted admin loses access immediately instead of
// at token expiry. (requireAuth must run first.)
async function requireAdmin(req, res, next) {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Admin access required.' });
    }
    const current = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { role: true }
    });
    if (!current || current.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Admin access required.' });
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

// Doctor-portal access requires an APPROVED doctor, checked against the
// database on every request (not a claim in the token): a doctor who is still
// PENDING, was REJECTED, or is later un-approved cannot use the portal even
// with a valid, unexpired token. (requireAuth must run first.)
async function requireApprovedDoctor(req, res, next) {
  try {
    if (req.user?.role !== 'DOCTOR') {
      return res.status(403).json({ message: 'Doctor access only.' });
    }
    const [user, profile] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.user.id }, select: { role: true } }),
      prisma.doctorProfile.findUnique({ where: { userId: req.user.id }, select: { verificationStatus: true } })
    ]);
    if (!user || user.role !== 'DOCTOR' || !profile) {
      return res.status(403).json({ message: 'Doctor access only.' });
    }
    if (profile.verificationStatus !== 'APPROVED') {
      return res.status(403).json({
        message: 'Your doctor account is not approved yet.',
        status: profile.verificationStatus
      });
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = { requireAuth, authenticateAccessToken, requireAdmin, requireApprovedDoctor };
