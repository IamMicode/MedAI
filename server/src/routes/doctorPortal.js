const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const prisma = require('../db');

router.use(requireAuth);

function requireDoctor(req, res, next) {
  if (req.user.role !== 'DOCTOR') {
    return res.status(403).json({ message: 'Doctor access only.' });
  }
  next();
}

router.use(requireDoctor);

// GET /api/doctor-portal/me — doctor's own profile + verification status
router.get('/me', async (req, res, next) => {
  try {
    const profile = await prisma.doctorProfile.findUnique({ where: { userId: req.user.id } });
    if (!profile) return res.status(404).json({ message: 'Doctor profile not found.' });
    if (profile.verificationStatus !== 'APPROVED') {
      return res.status(403).json({ message: 'Your account is not yet approved.', status: profile.verificationStatus });
    }
    return res.json({ profile });
  } catch (error) {
    return next(error);
  }
});

// GET /api/doctor-portal/patients — real patients with triage activity, most recent/severe first
router.get('/patients', async (req, res, next) => {
  try {
    const records = await prisma.triageRecord.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: {
          select: {
            id: true, username: true, firstname: true, lastname: true,
            email: true, bloodGroup: true, allergies: true, conditions: true,
            emergName: true, emergPhone: true, createdAt: true
          }
        }
      }
    });

    // group by patient, keep their most recent + most severe triage
    const byPatient = {};
    for (const r of records) {
      if (!r.user) continue;
      const pid = r.user.id;
      if (!byPatient[pid]) {
        byPatient[pid] = { user: r.user, triageCount: 0, lastTriage: null, highestSeverity: null };
      }
      byPatient[pid].triageCount++;
      if (!byPatient[pid].lastTriage) byPatient[pid].lastTriage = r;
      const severityRank = { LOW: 1, MEDIUM: 2, HIGH: 3, EMERGENCY: 4 };
      const currentRank = severityRank[r.triageLevel] || 0;
      const highestRank = severityRank[byPatient[pid].highestSeverity] || 0;
      if (currentRank > highestRank) byPatient[pid].highestSeverity = r.triageLevel;
    }

    const patients = Object.values(byPatient)
      .sort((a, b) => {
        const sevRank = { EMERGENCY: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        const diff = (sevRank[b.highestSeverity] || 0) - (sevRank[a.highestSeverity] || 0);
        if (diff !== 0) return diff;
        return new Date(b.lastTriage.createdAt) - new Date(a.lastTriage.createdAt);
      })
      .map(p => ({
        id: p.user.id,
        name: `${p.user.firstname || ''} ${p.user.lastname || ''}`.trim() || p.user.username,
        email: p.user.email,
        bloodGroup: p.user.bloodGroup,
        allergies: p.user.allergies,
        conditions: p.user.conditions,
        triageCount: p.triageCount,
        highestSeverity: p.highestSeverity,
        lastTriageDate: p.lastTriage.createdAt,
        lastTriageSummary: p.lastTriage.summary || p.lastTriage.symptoms || null
      }));

    return res.json({ patients });
  } catch (error) {
    return next(error);
  }
});

// GET /api/doctor-portal/patients/:id — full patient profile + triage history for chat context
router.get('/patients/:id', async (req, res, next) => {
  try {
    const patient = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, firstname: true, lastname: true, username: true, email: true,
        dob: true, gender: true, height: true, weight: true, bloodGroup: true,
        conditions: true, otherConditions: true, allergies: true, medications: true,
        smokes: true, alcohol: true, exercises: true, emergName: true, emergPhone: true
      }
    });
    if (!patient) return res.status(404).json({ message: 'Patient not found.' });

    const triageHistory = await prisma.triageRecord.findMany({
      where: { userId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    return res.json({ patient, triageHistory });
  } catch (error) {
    return next(error);
  }
});

// POST /api/doctor-portal/conversations — start or get existing conversation with a patient
router.post('/conversations', async (req, res, next) => {
  try {
    const { patientId } = req.body;
    if (!patientId) return res.status(400).json({ message: 'patientId is required.' });

    let conversation = await prisma.conversation.findUnique({
      where: { doctorId_patientId: { doctorId: req.user.id, patientId } }
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { doctorId: req.user.id, patientId }
      });
    }

    return res.json({ conversation });
  } catch (error) {
    return next(error);
  }
});

// GET /api/doctor-portal/conversations — list this doctor's conversations
router.get('/conversations', async (req, res, next) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: { doctorId: req.user.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        patient: { select: { id: true, firstname: true, lastname: true, username: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 }
      }
    });

    const formatted = conversations.map(c => ({
      id: c.id,
      patientId: c.patient.id,
      patientName: `${c.patient.firstname || ''} ${c.patient.lastname || ''}`.trim() || c.patient.username,
      lastMessage: c.messages[0]?.content || null,
      lastMessageAt: c.messages[0]?.createdAt || c.createdAt,
      updatedAt: c.updatedAt
    }));

    return res.json({ conversations: formatted });
  } catch (error) {
    return next(error);
  }
});

// GET /api/doctor-portal/conversations/:id/messages — fetch messages (for polling)
router.get('/conversations/:id/messages', async (req, res, next) => {
  try {
    const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id } });
    if (!conversation || conversation.doctorId !== req.user.id) {
      return res.status(404).json({ message: 'Conversation not found.' });
    }

    const messages = await prisma.message.findMany({
      where: { conversationId: req.params.id },
      orderBy: { createdAt: 'asc' },
      take: 200
    });

    return res.json({ messages });
  } catch (error) {
    return next(error);
  }
});

// POST /api/doctor-portal/conversations/:id/messages — send a message
router.post('/conversations/:id/messages', async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ message: 'Message content is required.' });

    const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id } });
    if (!conversation || conversation.doctorId !== req.user.id) {
      return res.status(404).json({ message: 'Conversation not found.' });
    }

    const message = await prisma.message.create({
      data: {
        conversationId: req.params.id,
        senderId: req.user.id,
        senderRole: 'DOCTOR',
        content: content.trim()
      }
    });

    await prisma.conversation.update({
      where: { id: req.params.id },
      data: { updatedAt: new Date() }
    });

    return res.status(201).json({ message });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
