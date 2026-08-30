const express = require('express');
const prisma = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const sanitizeUser = require('../utils/sanitizeUser');
const notify = require('../utils/notify');

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get('/users', async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
    return res.json({ users: users.map(sanitizeUser) });
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
    return next(error);
  }
});

router.get('/triage', async (req, res, next) => {
  try {
    const records = await prisma.triageRecord.findMany({
      include: { user: { select: { id: true, username: true, email: true } } },
      orderBy: { createdAt: 'desc' }
    });
    return res.json({ records });
  } catch (error) {
    return next(error);
  }
});

router.get('/analytics', async (req, res, next) => {
  try {
    const [userCount, triageCount, waitlistCount, users, triageLevels] = await Promise.all([
      prisma.user.count(),
      prisma.triageRecord.count(),
      prisma.waitlistEmail.count(),
      prisma.user.findMany({ select: { gender: true, conditions: true } }),
      prisma.triageRecord.groupBy({ by: ['triageLevel'], _count: true })
    ]);

    const genderDistribution = countValues(users.map((user) => user.gender).filter(Boolean));
    const conditionsBreakdown = countValues(users.flatMap((user) => user.conditions || []));
    const triageLevelBreakdown = Object.fromEntries(
      triageLevels.map((row) => [row.triageLevel, row._count])
    );

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

router.get('/waitlist', async (req, res, next) => {
  try {
    const emails = await prisma.waitlistEmail.findMany({ orderBy: { createdAt: 'desc' } });
    return res.json({ emails });
  } catch (error) {
    return next(error);
  }
});

function countValues(values) {
  return values.reduce((acc, value) => {
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

module.exports = router;

router.get('/users', async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, username: true, email: true, firstname: true, lastname: true,
        phone: true, dob: true, gender: true, height: true, weight: true,
        bloodGroup: true, conditions: true, otherConditions: true, allergies: true,
        medications: true, smokes: true, alcohol: true, exercises: true,
        emergName: true, emergPhone: true, plan: true, role: true, createdAt: true
      }
    });
    return res.json({ users });
  } catch (error) {
    return next(error);
  }
});

// GET /api/admin/doctors — list all doctor applications, optionally filtered by status
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

router.get('/triage', async (req, res, next) => {
  try {
    const records = await prisma.triageRecord.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        user: {
          select: { username: true, firstname: true, lastname: true, email: true }
        }
      }
    });

    const formatted = records.map(r => ({
      ...r,
      username: r.user?.username,
      userFullName: `${r.user?.firstname || ''} ${r.user?.lastname || ''}`.trim(),
      date: r.createdAt
    }));

    return res.json({ records: formatted });
  } catch (error) {
    return next(error);
  }
});
