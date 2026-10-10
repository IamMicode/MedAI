const express = require('express');
const prisma = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const sanitizeUser = require('../utils/sanitizeUser');
const notify = require('../utils/notify');

const router = express.Router();

router.use(requireAuth, requireAdmin);

// GET /api/admin/me — lets the admin page ask the SERVER "is this session a
// real admin?" before showing anything, instead of trusting browser storage.
router.get('/me', async (req, res, next) => {
  try {
    const admin = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, username: true }
    });
    return res.json({ admin });
  } catch (error) {
    return next(error);
  }
});

// Shared pagination helper — clamps page/pageSize to sane bounds so a typo'd
// query param (or a scripted abuse attempt) can't force an unbounded fetch.
function parsePagination(query, defaultPageSize = 25, maxPageSize = 100) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(maxPageSize, Math.max(1, parseInt(query.pageSize, 10) || defaultPageSize));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

// GET /api/admin/users — paginated, searchable, and only selects the columns
// the admin UI actually renders (never the full row — no password hashes,
// 2FA secrets, or reset tokens leave the database here).
router.get('/users', async (req, res, next) => {
  try {
    const { search, plan } = req.query;
    const where = {
      AND: [
        plan && plan !== 'all' ? { plan } : {},
        search ? {
          OR: [
            { username: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { firstname: { contains: search, mode: 'insensitive' } },
            { lastname: { contains: search, mode: 'insensitive' } }
          ]
        } : {}
      ]
    };

    const select = {
      id: true, username: true, email: true, firstname: true, lastname: true,
      phone: true, dob: true, gender: true, height: true, weight: true,
      bloodGroup: true, conditions: true, otherConditions: true, allergies: true,
      medications: true, smokes: true, alcohol: true, exercises: true,
      emergName: true, emergPhone: true, plan: true, role: true, createdAt: true
    };

    // A few other admin views (Overview stats, Health Profiles, Emergency
    // Alerts, the user-detail modal) genuinely need the complete dataset to
    // compute their own aggregates client-side, not one page of it. Rather
    // than force every consumer through the same page size, `all=true` is an
    // explicit, admin-only escape hatch for those internal callers — the
    // Users TABLE view itself never sends it, so the table stays paginated.
    if (req.query.all === 'true') {
      const users = await prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, select });
      return res.json({ users, total: users.length });
    }

    const { page, pageSize, skip, take } = parsePagination(req.query);
    const [users, total] = await Promise.all([
      prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take, select }),
      prisma.user.count({ where })
    ]);

    return res.json({ users, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
  } catch (error) {
    return next(error);
  }
});

router.get('/users/:id', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: { triageRecords: true, achievements: true }
    });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    return res.json({ user: sanitizeUser(user) });
  } catch (error) {
    return next(error);
  }
});

router.delete('/users/:id', async (req, res, next) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    return res.json({ message: 'User deleted.' });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ message: 'User not found — it may already be deleted.' });
    return next(error);
  }
});

// GET /api/admin/triage — paginated, searchable (by symptoms text or username),
// filterable by triage level.
router.get('/triage', async (req, res, next) => {
  try {
    const { search, level } = req.query;
    const where = {
      AND: [
        level && level !== 'all' ? { triageLevel: level } : {},
        search ? {
          OR: [
            { symptoms: { contains: search, mode: 'insensitive' } },
            { user: { username: { contains: search, mode: 'insensitive' } } }
          ]
        } : {}
      ]
    };
    const include = { user: { select: { username: true, firstname: true, lastname: true, email: true } } };

    // Same escape hatch as /users above, for the same reason — Overview,
    // Emergency Alerts, and the user-detail modal need the full history.
    if (req.query.all === 'true') {
      const records = await prisma.triageRecord.findMany({ where, orderBy: { createdAt: 'desc' }, include });
      const formatted = records.map(r => ({
        ...r,
        username: r.user?.username,
        userFullName: `${r.user?.firstname || ''} ${r.user?.lastname || ''}`.trim(),
        date: r.createdAt
      }));
      return res.json({ records: formatted, total: formatted.length });
    }

    const { page, pageSize, skip, take } = parsePagination(req.query);
    const [records, total] = await Promise.all([
      prisma.triageRecord.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take, include }),
      prisma.triageRecord.count({ where })
    ]);

    const formatted = records.map(r => ({
      ...r,
      username: r.user?.username,
      userFullName: `${r.user?.firstname || ''} ${r.user?.lastname || ''}`.trim(),
      date: r.createdAt
    }));

    return res.json({ records: formatted, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
  } catch (error) {
    return next(error);
  }
});

// GET /api/admin/analytics — every count computed at the database level
// (groupBy / aggregate), never by pulling full rows into Node to count in JS.
router.get('/analytics', async (req, res, next) => {
  try {
    const [userCount, triageCount, waitlistCount, genderRows, triageLevels, conditionRows] = await Promise.all([
      prisma.user.count(),
      prisma.triageRecord.count(),
      prisma.waitlistEmail.count(),
      prisma.user.groupBy({ by: ['gender'], _count: true, where: { gender: { not: null } } }),
      prisma.triageRecord.groupBy({ by: ['triageLevel'], _count: true }),
      // `conditions` is a Postgres text[] column — Prisma's groupBy can't unnest
      // an array column, so this is the one count that still needs raw SQL to
      // stay DB-side instead of loading every user's conditions into Node.
      prisma.$queryRaw`
        SELECT unnest("conditions") AS condition, COUNT(*)::int AS count
        FROM "User"
        WHERE "conditions" IS NOT NULL AND "conditions" != '{}'
        GROUP BY condition
        ORDER BY count DESC
      `
    ]);

    const genderDistribution = Object.fromEntries(genderRows.map(row => [row.gender, row._count]));
    const triageLevelBreakdown = Object.fromEntries(triageLevels.map(row => [row.triageLevel, row._count]));
    const conditionsBreakdown = Object.fromEntries(conditionRows.map(row => [row.condition, row.count]));

    return res.json({
      totals: { users: userCount, triageRecords: triageCount, waitlistEmails: waitlistCount },
      genderDistribution,
      conditionsBreakdown,
      triageLevelBreakdown
    });
  } catch (error) {
    return next(error);
  }
});

// GET /api/admin/waitlist — paginated; this list is typically small, but
// pagination costs nothing and keeps behavior consistent with the other tables.
router.get('/waitlist', async (req, res, next) => {
  try {
    const { page, pageSize, skip, take } = parsePagination(req.query, 50);
    const [emails, total] = await Promise.all([
      prisma.waitlistEmail.findMany({ orderBy: { createdAt: 'desc' }, skip, take }),
      prisma.waitlistEmail.count()
    ]);
    return res.json({ emails, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
  } catch (error) {
    return next(error);
  }
});

// GET /api/admin/doctors — list doctor applications, optionally filtered by status.
// Kept unpaginated deliberately: doctor applications are a low-volume,
// review-queue-style list (unlike users/triage), and the admin UI's pending-count
// badge and Approve/Reject flow assume the full set is present at once.
router.get('/doctors', async (req, res, next) => {
  try {
    const { status } = req.query; // PENDING | APPROVED | REJECTED | undefined (all)
    const where = status ? { verificationStatus: status } : {};

    const doctors = await prisma.doctorProfile.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, email: true, username: true, createdAt: true }
        }
      }
    });

    return res.json({ doctors });
  } catch (error) {
    return next(error);
  }
});

// PATCH /api/admin/doctors/:id — approve or reject a doctor application
router.patch('/doctors/:id', async (req, res, next) => {
  try {
    const { id } = req.params; // this is the DoctorProfile id
    const { action, rejectionReason } = req.body; // action: 'approve' | 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Action must be "approve" or "reject".' });
    }

    const profile = await prisma.doctorProfile.findUnique({ where: { id } });
    if (!profile) return res.status(404).json({ message: 'Doctor application not found.' });

    const updated = await prisma.doctorProfile.update({
      where: { id },
      data: {
        verificationStatus: action === 'approve' ? 'APPROVED' : 'REJECTED',
        rejectionReason: action === 'reject' ? (rejectionReason || 'No reason provided.') : null,
        verifiedAt: action === 'approve' ? new Date() : null
      }
    });

    if (action === 'approve') {
      await notify(profile.userId, {
        type: 'doctor_approved',
        title: 'Your account has been approved!',
        body: 'Congratulations — your doctor account is now live. Patients can now find and message you.',
        link: 'dashboard'
      });
    } else {
      await notify(profile.userId, {
        type: 'doctor_rejected',
        title: 'Application update',
        body: `Your doctor application was not approved${rejectionReason ? ': ' + rejectionReason : '.'}`,
        link: null
      });
    }

    return res.json({ message: `Doctor ${action === 'approve' ? 'approved' : 'rejected'}.`, profile: updated });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
