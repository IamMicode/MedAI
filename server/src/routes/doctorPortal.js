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

// GET /api/doctor-portal/appointments — this doctor's incoming appointment requests, pending first
router.get('/appointments', async (req, res, next) => {
  try {
    const appointments = await prisma.appointment.findMany({
      where: { doctorId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        patient: { select: { id: true, firstname: true, lastname: true, username: true, email: true } }
      }
    });

    const statusRank = { PENDING: 0, ACCEPTED: 1, DECLINED: 2, CANCELLED: 3 };
    const sorted = appointments.sort((a, b) => (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9));

    return res.json({
      appointments: sorted.map(a => ({
        id: a.id,
        patientName: `${a.patient.firstname || ''} ${a.patient.lastname || ''}`.trim() || a.patient.username,
        patientEmail: a.patient.email,
        scheduledDate: a.scheduledDate,
        scheduledTime: a.scheduledTime,
        reason: a.reason,
        urgency: a.urgency,
        status: a.status,
        createdAt: a.createdAt
      }))
    });
  } catch (error) {
    return next(error);
  }
});

// PATCH /api/doctor-portal/appointments/:id — accept or decline an appointment request
router.patch('/appointments/:id', async (req, res, next) => {
  try {
    const { status, declineReason } = req.body;
    if (!['ACCEPTED', 'DECLINED'].includes(status)) {
      return res.status(400).json({ message: 'status must be ACCEPTED or DECLINED.' });
    }

    const appointment = await prisma.appointment.findUnique({ where: { id: req.params.id } });
    if (!appointment || appointment.doctorId !== req.user.id) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    const updated = await prisma.appointment.update({
      where: { id: req.params.id },
      data: { status, declineReason: status === 'DECLINED' ? (declineReason || null) : null }
    });

    return res.json({ appointment: updated });
  } catch (error) {
    return next(error);
  }
});

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

// PATCH /api/doctor-portal/me/availability — toggle "available for new patients"
router.patch('/me/availability', async (req, res, next) => {
  try {
    const { isAvailable } = req.body;
    if (typeof isAvailable !== 'boolean') {
      return res.status(400).json({ message: 'isAvailable (boolean) is required.' });
    }
    const profile = await prisma.doctorProfile.update({
      where: { userId: req.user.id },
      data: { isAvailable }
    });
    return res.json({ profile });
  } catch (error) {
    return next(error);
  }
});

// GET /api/doctor-portal/patients — this doctor's patients (from real conversations), most recently active first
router.get('/patients', async (req, res, next) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: { doctorId: req.user.id },
      include: {
        patient: {
          select: {
            id: true, username: true, firstname: true, lastname: true,
            email: true, bloodGroup: true, allergies: true, conditions: true,
            emergName: true, emergPhone: true, createdAt: true
          }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    // pull each patient's most recent triage record too, if any exists, for severity context
    const patientIds = conversations.map(c => c.patient.id);
    const triageRecords = patientIds.length
      ? await prisma.triageRecord.findMany({
          where: { userId: { in: patientIds } },
          orderBy: { createdAt: 'desc' }
        })
      : [];
    const latestTriageByPatient = {};
    for (const t of triageRecords) {
      if (!latestTriageByPatient[t.userId]) latestTriageByPatient[t.userId] = t;
    }

    const patients = conversations
      .map(c => {
        const lastMessage = c.messages[0] || null;
        const triage = latestTriageByPatient[c.patient.id] || null;
        return {
          id: c.patient.id,
          conversationId: c.id,
          name: `${c.patient.firstname || ''} ${c.patient.lastname || ''}`.trim() || c.patient.username,
          email: c.patient.email,
          bloodGroup: c.patient.bloodGroup,
          allergies: c.patient.allergies,
          conditions: c.patient.conditions,
          highestSeverity: triage ? triage.triageLevel : null,
          lastTriageSummary: triage ? (triage.summary || triage.symptoms || null) : null,
          lastMessage: lastMessage ? (lastMessage.content || (lastMessage.imageData ? '📷 Image' : '')) : null,
          lastMessageAt: lastMessage ? lastMessage.createdAt : c.createdAt
        };
      })
      .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));

    return res.json({ patients });
  } catch (error) {
    return next(error);
  }
});

// GET /api/doctor-portal/patients/:id — full patient profile + triage history for chat context
router.get('/patients/:id', async (req, res, next) => {
  try {
    // Only allow viewing a patient's full profile if this doctor actually has a conversation with them
    const conversation = await prisma.conversation.findUnique({
      where: { doctorId_patientId: { doctorId: req.user.id, patientId: req.params.id } }
    });
    if (!conversation) return res.status(403).json({ message: 'You do not have a conversation with this patient.' });

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

    const vitalReadings = await prisma.vitalReading.findMany({
      where: { userId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    return res.json({ patient, triageHistory, vitalReadings });
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

// POST /api/doctor-portal/conversations/:id/messages — send a message (text and/or image)
router.post('/conversations/:id/messages', async (req, res, next) => {
  try {
    const { content, imageData } = req.body;
    const trimmedContent = (content || '').trim();

    if (!trimmedContent && !imageData) {
      return res.status(400).json({ message: 'Message content or image is required.' });
    }
    if (imageData) {
      if (typeof imageData !== 'string' || !imageData.startsWith('data:image/')) {
        return res.status(400).json({ message: 'Invalid image format.' });
      }
      if (imageData.length > 7_000_000) { // ~5MB decoded
        return res.status(400).json({ message: 'Image is too large. Please use an image under 5MB.' });
      }
    }

    const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id } });
    if (!conversation || conversation.doctorId !== req.user.id) {
      return res.status(404).json({ message: 'Conversation not found.' });
    }

    const message = await prisma.message.create({
      data: {
        conversationId: req.params.id,
        senderId: req.user.id,
        senderRole: 'DOCTOR',
        content: trimmedContent,
        imageData: imageData || null
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
