const jwt = require('jsonwebtoken');
const prisma = require('../db');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Login required.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Short-lived tokens issued mid-flow (the 2FA "pendingToken", the Google
    // date-of-birth step token) are signed with the same secret but are NOT
    // login tokens. Without this check they would be accepted here as full
    // sessions, skipping the very step they exist to enforce.
    if (payload.pending2FA || payload.purpose) {
      return res.status(401).json({ message: 'Invalid or expired login token.' });
    }
    req.user = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired login token.' });
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

module.exports = { requireAuth, requireAdmin, requireApprovedDoctor };
