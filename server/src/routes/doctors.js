const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

const specialties = [
  'General Practice', 'Pediatrics', 'Psychiatry', 'Cardiology',
  'Dermatology', 'Internal Medicine', 'Emergency Medicine',
  'Gynecology', 'Neurology', 'Orthopedics', 'Other'
];

const registerSchema = z.object({
  fullName: z.string().trim().min(3).max(100),
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(8).max(100),
  phone: z.string().trim().min(7).max(20),
  licenseNumber: z.string().trim().min(3).max(60),
  issuingAuthority: z.string().trim().min(2).max(120),
  specialty: z.string().trim().min(2).max(60),
  yearsExperience: z.number().int().min(0).max(70),
  hospital: z.string().trim().max(150).optional(),
  bio: z.string().trim().max(600).optional(),
  licenseDocument: z.string().optional(), // base64 string, capped client-side
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  formattedAddress: z.string().trim().max(300).optional()
});

const loginSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(1)
});

function createDoctorToken(user, profile) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      verificationStatus: profile.verificationStatus
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// ── REGISTER ──
router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const {
      fullName, email, password, phone, licenseNumber, issuingAuthority,
      specialty, yearsExperience, hospital, bio, licenseDocument,
      latitude, longitude, formattedAddress
    } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const usernameBase = fullName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'doctor';
    const username = usernameBase + Math.floor(1000 + Math.random() * 9000);

    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        firstname: fullName.split(' ')[0],
        lastname: fullName.split(' ').slice(1).join(' ') || '',
        role: 'DOCTOR',
        doctorProfile: {
          create: {
            fullName,
            phone,
            licenseNumber,
            issuingAuthority,
            specialty,
            yearsExperience,
            hospital: hospital || null,
            bio: bio || null,
            licenseDocument: licenseDocument || null,
            latitude: typeof latitude === 'number' ? latitude : null,
            longitude: typeof longitude === 'number' ? longitude : null,
            formattedAddress: formattedAddress || null,
            verificationStatus: 'PENDING'
          }
        }
      },
      include: { doctorProfile: true }
    });

    return res.status(201).json({
      message: 'Registration received. Your credentials are under manual review — this usually takes 24-48 hours. We will notify you by email once approved.',
      status: 'PENDING'
    });
  } catch (error) {
    return next(error);
  }
});

// ── LOGIN ──
router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { doctorProfile: true }
    });

    if (!user || user.role !== 'DOCTOR' || !user.doctorProfile) {
      return res.status(401).json({ message: 'No doctor account found with this email.' });
    }

    const validPassword = await bcrypt.compare(password, user.password || '');
    if (!validPassword) {
      return res.status(401).json({ message: 'Incorrect password.' });
    }

    const token = createDoctorToken(user, user.doctorProfile);

    return res.json({
      token,
      status: user.doctorProfile.verificationStatus,
      doctor: {
        fullName: user.doctorProfile.fullName,
        specialty: user.doctorProfile.specialty,
        verificationStatus: user.doctorProfile.verificationStatus,
        rejectionReason: user.doctorProfile.rejectionReason
      }
    });
  } catch (error) {
    return next(error);
  }
});

// ── GET OWN PROFILE ──
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'DOCTOR') {
      return res.status(403).json({ message: 'Doctor access only.' });
    }
    const profile = await prisma.doctorProfile.findUnique({
      where: { userId: req.user.id }
    });
    if (!profile) return res.status(404).json({ message: 'Doctor profile not found.' });
    return res.json({ profile });
  } catch (error) {
    return next(error);
  }
});

// ── LIST SPECIALTIES (for registration dropdown) ──
router.get('/specialties', (req, res) => {
  res.json({ specialties });
});

// ── DIRECTORY: approved doctors with a pinned location, for patients (Therapy Finder / Appointments / Triage routing) ──
router.get('/directory', requireAuth, async (req, res, next) => {
  try {
    const { specialty, availableOnly } = req.query;
    const where = {
      verificationStatus: 'APPROVED',
      latitude: { not: null },
      longitude: { not: null }
    };
    if (specialty) where.specialty = specialty;
    if (availableOnly === 'true') where.isAvailable = true;

    const doctors = await prisma.doctorProfile.findMany({
      where,
      select: {
        id: true,
        userId: true,
        fullName: true,
        specialty: true,
        hospital: true,
        formattedAddress: true,
        latitude: true,
        longitude: true,
        yearsExperience: true,
        bio: true,
        isAvailable: true
      },
      orderBy: { fullName: 'asc' }
    });
    return res.json({ doctors });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
