const express = require('express');
const { z } = require('zod');
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

const triageSchema = z.object({
  symptoms: z.string().min(1),
  triage_level: z.string().min(1),
  triage_title: z.string().optional(),
  summary: z.string().optional(),
  confidence: z.number().optional()
});

router.use(requireAuth);

router.post('/', validate(triageSchema), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    if (user?.plan === 'Free') {
      const count = await prisma.triageRecord.count({
        where: {
          userId: req.user.id,
          createdAt: { gte: todayStart }
        }
      });

      if (count >= 5) {
        return res.status(429).json({ message: 'Free plan limit reached. Please upgrade to continue triage today.' });
      }
    }

    const record = await prisma.triageRecord.create({
      data: {
        userId: req.user.id,
        symptoms: req.body.symptoms,
        triageLevel: req.body.triage_level,
        triageTitle: req.body.triage_title,
        summary: req.body.summary,
        confidence: req.body.confidence
      }
    });

    return res.status(201).json({ record });
  } catch (error) {
    return next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const records = await prisma.triageRecord.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });
    return res.json({ records });
  } catch (error) {
    return next(error);
  }
});

router.delete('/', async (req, res, next) => {
  try {
    await prisma.triageRecord.deleteMany({ where: { userId: req.user.id } });
    return res.json({ message: 'Triage history cleared.' });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
