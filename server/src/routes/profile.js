const express = require('express');
const bcrypt = require('bcrypt');
const { z } = require('zod');
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const sanitizeUser = require('../utils/sanitizeUser');

const router = express.Router();

const optionalString = z.preprocess(
  (value) => (value === '' || value === undefined ? undefined : value),
  z.string().optional()
);

const optionalBoolean = z.preprocess((value) => {
  if (value === undefined || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true';
  return value;
}, z.boolean().optional());

const profileSchema = z.object({
  firstname: optionalString,
  lastname: optionalString,
  dob: optionalString,
  gender: optionalString,
  height: optionalString,
  weight: optionalString,
  bloodGroup: optionalString,
  country: optionalString,
  phone: optionalString,
  conditions: z.array(z.string()).optional(),
  otherConditions: optionalString,
  allergies: z.array(z.string()).optional(),
  medications: optionalString,
  smokes: optionalBoolean,
  alcohol: optionalBoolean,
  exercises: optionalBoolean,
  emergName: optionalString,
  emergPhone: optionalString
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(100)
});

router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    return res.json({ user: sanitizeUser(user) });
  } catch (error) {
    return next(error);
  }
});

router.put('/', validate(profileSchema), async (req, res, next) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: req.body
    });
    return res.json({ user: sanitizeUser(user) });
  } catch (error) {
    return next(error);
  }
});

router.delete('/', async (req, res, next) => {
  try {
    await prisma.user.delete({ where: { id: req.user.id } });
    return res.json({ message: 'Account deleted.' });
  } catch (error) {
    return next(error);
  }
});

router.put('/password', validate(passwordSchema), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user?.password) {
      return res.status(400).json({ message: 'This account does not have a password yet.' });
    }

    const currentOk = await bcrypt.compare(req.body.currentPassword, user.password);
    if (!currentOk) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }

    const password = await bcrypt.hash(req.body.newPassword, 12);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password }
    });

    return res.json({ message: 'Password updated.' });
  } catch (error) {
    return next(error);
  }
});

const vitalSchema = z.object({
  heartRate: optionalString,
  spo2: optionalString,
  temp: optionalString,
  bp: optionalString,
  glucose: optionalString,
  weight: optionalString,
  source: z.enum(['manual', 'camera']).optional()
});

// POST /api/profile/vitals — log a new vital reading (manual entry or camera scan)
router.post('/vitals', validate(vitalSchema), async (req, res, next) => {
  try {
    const { heartRate, spo2, temp, bp, glucose, weight, source } = req.body;
    if (!heartRate && !spo2 && !temp && !bp && !glucose && !weight) {
      return res.status(400).json({ message: 'At least one vital reading is required.' });
    }
    const reading = await prisma.vitalReading.create({
      data: {
        userId: req.user.id,
        heartRate: heartRate || null,
        spo2: spo2 || null,
        temp: temp || null,
        bp: bp || null,
        glucose: glucose || null,
        weight: weight || null,
        source: source || 'manual'
      }
    });
    return res.json({ reading });
  } catch (error) {
    return next(error);
  }
});

// GET /api/profile/vitals — this patient's own vitals history, most recent first
router.get('/vitals', async (req, res, next) => {
  try {
    const readings = await prisma.vitalReading.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    return res.json({ readings });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
