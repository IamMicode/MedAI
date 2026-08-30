const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const notify = require('../utils/notify');

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

// ── DIRECTORY: approved doctors, for patients (Therapy Finder / Appointments / Triage routing) ──
// Location (latitude/longitude) is only required when the caller needs to plot a map —
// pass requireLocation=true for that. Triage's specialty matching doesn't need a pinned
// location at all, since it just opens a chat, so it omits that filter.
router.get('/directory', requireAuth, async (req, res, next) => {
  try {
    const { specialty, availableOnly, requireLocation } = req.query;
    const where = { verificationStatus: 'APPROVED' };
    if (specialty) where.specialty = specialty;
    if (availableOnly === 'true') where.isAvailable = true;
    if (requireLocation === 'true') {
      where.latitude = { not: null };
      where.longitude = { not: null };
    }

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

    if (!doctors.length) return res.json({ doctors });

    const ratingRows = await prisma.doctorReview.groupBy({
      by: ['doctorId'],
      where: { doctorId: { in: doctors.map(d => d.userId) } },
      _avg: { rating: true },
      _count: { rating: true }
    });
    const ratingMap = Object.fromEntries(
      ratingRows.map(r => [r.doctorId, { avgRating: Math.round(r._avg.rating * 10) / 10, reviewCount: r._count.rating }])
    );

    const withRatings = doctors.map(d => ({
      ...d,
      avgRating: ratingMap[d.userId]?.avgRating ?? null,
      reviewCount: ratingMap[d.userId]?.reviewCount ?? 0
    }));

    return res.json({ doctors: withRatings });
  } catch (error) {
    return next(error);
  }
});

// ── REVIEWS: list a doctor's reviews (public to any authenticated patient) ──
router.get('/:doctorId/reviews', requireAuth, async (req, res, next) => {
  try {
    const { doctorId } = req.params;
    const reviews = await prisma.doctorReview.findMany({
      where: { doctorId },
      orderBy: { createdAt: 'desc' },
      include: { patient: { select: { firstname: true, lastname: true, username: true } } }
    });
    const agg = await prisma.doctorReview.aggregate({
      where: { doctorId },
      _avg: { rating: true },
      _count: { rating: true }
    });

    return res.json({
      reviews: reviews.map(r => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        patientName: (r.patient.firstname ? `${r.patient.firstname} ${r.patient.lastname || ''}`.trim() : r.patient.username)
      })),
      avgRating: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : null,
      reviewCount: agg._count.rating
    });
  } catch (error) {
    return next(error);
  }
});

// ── REVIEWS: submit or update the current patient's review of a doctor ──
// Only allowed if the patient has an existing conversation with this doctor (i.e. they've chatted).
const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional()
});
router.post('/:doctorId/reviews', requireAuth, async (req, res, next) => {
  try {
    const { doctorId } = req.params;
    const parsed = reviewSchema.safeParse({
      rating: Number(req.body.rating),
      comment: req.body.comment
    });
    if (!parsed.success) {
      return res.status(400).json({ message: 'A rating from 1 to 5 is required.' });
    }
    const { rating, comment } = parsed.data;

    const conversation = await prisma.conversation.findUnique({
      where: { doctorId_patientId: { doctorId, patientId: req.user.id } }
    });
    if (!conversation) {
      return res.status(403).json({ message: 'You can only review a doctor after chatting with them.' });
    }

    const existingReview = await prisma.doctorReview.findUnique({
      where: { doctorId_patientId: { doctorId, patientId: req.user.id } }
    });

    const review = await prisma.doctorReview.upsert({
      where: { doctorId_patientId: { doctorId, patientId: req.user.id } },
      create: { doctorId, patientId: req.user.id, rating, comment: comment || null },
      update: { rating, comment: comment || null }
    });

    if (!existingReview) {
      const patientUser = await prisma.user.findUnique({ where: { id: req.user.id }, select: { firstname: true, lastname: true, username: true } });
      const patientName = `${patientUser?.firstname || ''} ${patientUser?.lastname || ''}`.trim() || patientUser?.username || 'A patient';
      await notify(doctorId, {
        type: 'review_received',
        title: `New ${rating}-star review`,
        body: `${patientName} left you a ${rating}-star review${comment ? ': "' + comment.slice(0, 80) + '"' : '.'}`,
        link: 'profile'
      });
    }

    return res.json({ review });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
