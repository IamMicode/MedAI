const express = require('express');
const { z } = require('zod');
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const router = express.Router();
const panicSchema = z.object({ started_at: z.string().min(1), duration_seconds: z.number().int().nonnegative().optional(), grounding_complete: z.boolean().optional(), used_calming_sound: z.boolean().optional(), note: z.string().max(500).optional() });
router.use(requireAuth);
router.post('/', validate(panicSchema), async (req, res, next) => {
  try {
    const startedAt = new Date(req.body.started_at);
    if (Number.isNaN(startedAt.getTime())) return res.status(400).json({ message: 'Invalid started_at timestamp.' });
    const endedAt = new Date();
    const durationSeconds = req.body.duration_seconds ?? Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000));
    const event = await prisma.panicEvent.create({ data: { userId: req.user.id, startedAt, endedAt, durationSeconds, groundingComplete: req.body.grounding_complete || false, usedCalmingSound: req.body.used_calming_sound || false, note: req.body.note } });
    return res.status(201).json({ event });
  } catch (error) { return next(error); }
});
router.get('/', async (req, res, next) => {
  try {
    const events = await prisma.panicEvent.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 50 });
    return res.json({ events });
  } catch (error) { return next(error); }
});
module.exports = router;
