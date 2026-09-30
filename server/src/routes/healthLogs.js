const express = require('express');
const router = express.Router();
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

const DAILY_TYPES = new Set(['water', 'sleep']);
const VALID_TYPES = new Set(['water', 'sleep', 'food', 'medicine', 'bmi', 'stress']);

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD, UTC — consistent regardless of server/client timezone drift
}

// GET /api/health-logs/summary — everything the Health Tools tab needs in one
// round trip on page load, instead of five separate fetches.
router.get('/summary', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const today = todayKey();

    const [waterToday, sleepToday, recentFood, recentMedicine, latestBmi, latestStress] = await Promise.all([
      prisma.healthLog.findUnique({ where: { userId_type_dateKey: { userId, type: 'water', dateKey: today } } }),
      prisma.healthLog.findUnique({ where: { userId_type_dateKey: { userId, type: 'sleep', dateKey: today } } }),
      prisma.healthLog.findMany({ where: { userId, type: 'food' }, orderBy: { createdAt: 'desc' }, take: 20 }),
      prisma.healthLog.findMany({ where: { userId, type: 'medicine' }, orderBy: { createdAt: 'desc' }, take: 20 }),
      prisma.healthLog.findFirst({ where: { userId, type: 'bmi' }, orderBy: { createdAt: 'desc' } }),
      prisma.healthLog.findFirst({ where: { userId, type: 'stress' }, orderBy: { createdAt: 'desc' } })
    ]);

    return res.json({
      water: waterToday?.data || null,
      sleep: sleepToday?.data || null,
      food: recentFood,
      medicine: recentMedicine,
      bmi: latestBmi,
      stress: latestStress
    });
  } catch (error) {
    return next(error);
  }
});

// POST /api/health-logs — create an entry. Water/sleep upsert today's single
// row (data REPLACES the previous value, since the frontend sends the new
// running total after each +/- tap); everything else creates a fresh row.
router.post('/', async (req, res, next) => {
  try {
    const { type, data } = req.body;
    if (!VALID_TYPES.has(type)) {
      return res.status(400).json({ message: 'Unknown health log type.' });
    }
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ message: 'data must be an object.' });
    }

    const userId = req.user.id;

    if (DAILY_TYPES.has(type)) {
      const dateKey = todayKey();
      const log = await prisma.healthLog.upsert({
        where: { userId_type_dateKey: { userId, type, dateKey } },
        update: { data },
        create: { userId, type, dateKey, data }
      });
      return res.json({ log });
    }

    const log = await prisma.healthLog.create({ data: { userId, type, data } });
    return res.json({ log });
  } catch (error) {
    return next(error);
  }
});

// PATCH /api/health-logs/:id — partial update to an entry's data (used for
// marking a medicine reminder as Taken without resending the whole record).
router.patch('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.healthLog.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.user.id) {
      return res.status(404).json({ message: 'Entry not found.' });
    }
    const mergedData = { ...existing.data, ...(req.body.data || {}) };
    const log = await prisma.healthLog.update({ where: { id: req.params.id }, data: { data: mergedData } });
    return res.json({ log });
  } catch (error) {
    return next(error);
  }
});

// DELETE /api/health-logs/:id — remove one entry (e.g. a mis-logged meal).
router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.healthLog.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.user.id) {
      return res.status(404).json({ message: 'Entry not found.' });
    }
    await prisma.healthLog.delete({ where: { id: req.params.id } });
    return res.json({ message: 'Deleted.' });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
