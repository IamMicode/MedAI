const express = require('express');
const router = express.Router();
const { requireAuth, requireApprovedDoctor } = require('../middleware/auth');
const prisma = require('../db');
const notify = require('../utils/notify');

router.use(requireAuth);

function requireDoctor(req, res, next) {
  if (req.user.role !== 'DOCTOR') {
    return res.status(403).json({ message: 'Doctor access only.' });
  }
  next();
}

router.use(requireDoctor);

// Everything in the portal except the doctor's own status check requires an
// APPROVED account. GET /me stays reachable for pending/rejected doctors
// because that is how their dashboard learns (and shows) their status; it
// returns 403 + the status itself for anyone not approved.
router.use((req, res, next) => {
  if (req.method === 'GET' && req.path === '/me') return next();
  return requireApprovedDoctor(req, res, next);
});

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

    const doctorProfile = await prisma.doctorProfile.findUnique({ where: { userId: req.user.id }, select: { fullName: true } });
    const doctorName = doctorProfile?.fullName || 'Your doctor';
    if (status === 'ACCEPTED') {
      await notify(appointment.patientId, {
        type: 'appointment_accepted',
        title: 'Appointment accepted',
        body: `Dr. ${doctorName} accepted your appointment for ${appointment.scheduledDate} at ${appointment.scheduledTime}.`,
        link: 'appointments'
      });
    } else {
      await notify(appointment.patientId, {
        type: 'appointment_declined',
        title: 'Appointment declined',
        body: `Dr. ${doctorName} declined your appointment request${declineReason ? ': ' + declineReason : '.'}`,
        link: 'appointments'
      });
    }

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
    const patientIds = conversations.filter(c => c.profileShared).map(c => c.patient.id);
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

    // Share Profile is enforced HERE too, not just on /patients/:id. Until the
    // patient turns sharing on for this conversation, the doctor gets only the
    // patient's name — no email, blood group, allergies, conditions, emergency
    // contact or triage details.
    const patients = conversations
      .map(c => {
        const lastMessage = c.messages[0] || null;
        const shared = c.profileShared === true;
        const triage = shared ? (latestTriageByPatient[c.patient.id] || null) : null;
        return {
          id: c.patient.id,
          conversationId: c.id,
          name: `${c.patient.firstname || ''} ${c.patient.lastname || ''}`.trim() || c.patient.username,
          profileShared: shared,
          email: shared ? c.patient.email : null,
          bloodGroup: shared ? c.patient.bloodGroup : null,
          allergies: shared ? c.patient.allergies : [],
          conditions: shared ? c.patient.conditions : [],
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

    if (!conversation.profileShared) {
      const basicInfo = await prisma.user.findUnique({
        where: { id: req.params.id },
        select: { firstname: true, lastname: true, username: true }
      });
      return res.json({
        accessGranted: false,
        patient: {
          firstname: basicInfo?.firstname,
          lastname: basicInfo?.lastname,
          username: basicInfo?.username
        },
        triageHistory: [],
        vitalReadings: []
      });
    }

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

    return res.json({ accessGranted: true, patient, triageHistory, vitalReadings });
  } catch (error) {
    return next(error);
  }
});

// POST /api/doctor-portal/conversations — start or get existing conversation with a patient
// POST /api/doctor-portal/conversations — open (get-or-create) a chat with a patient.
// A doctor can NOT start a conversation with an arbitrary user id. There must
// already be a connection the PATIENT created: an existing conversation, or an
// appointment the patient requested with this doctor (which is the patient's
// consent to be contacted by them). The target must also be an ordinary
// patient account, never another doctor or an admin.
router.post('/conversations', async (req, res, next) => {
  try {
    const { patientId } = req.body;
    if (!patientId || typeof patientId !== 'string') {
      return res.status(400).json({ message: 'patientId is required.' });
    }

    const existing = await prisma.conversation.findUnique({
      where: { doctorId_patientId: { doctorId: req.user.id, patientId } }
    });
    if (existing) return res.json({ conversation: existing });

    const patient = await prisma.user.findUnique({ where: { id: patientId }, select: { id: true, role: true } });
    if (!patient || patient.role !== 'USER') {
      return res.status(404).json({ message: 'Patient not found.' });
    }

    const connection = await prisma.appointment.findFirst({
      where: { doctorId: req.user.id, patientId, status: { in: ['PENDING', 'ACCEPTED'] } },
      select: { id: true }
    });
    if (!connection) {
      return res.status(403).json({
        message: 'You can only message patients who have booked an appointment with you or started a conversation with you.'
      });
    }

    const conversation = await prisma.conversation.create({
      data: { doctorId: req.user.id, patientId }
    });
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

    const doctorProfile = await prisma.doctorProfile.findUnique({ where: { userId: req.user.id }, select: { fullName: true } });
    await notify(conversation.patientId, {
      type: 'message',
      title: `New message from Dr. ${doctorProfile?.fullName || 'your doctor'}`,
      body: imageData ? '📷 Sent an image' : trimmedContent.slice(0, 100),
      link: `messages:${req.params.id}`
    });

    return res.status(201).json({ message });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
