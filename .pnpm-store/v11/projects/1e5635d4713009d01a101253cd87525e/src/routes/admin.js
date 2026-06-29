const express = require('express');
const prisma = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const sanitizeUser = require('../utils/sanitizeUser');

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
