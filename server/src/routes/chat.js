const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const prisma = require('../db');

router.use(requireAuth);

// POST /api/chat/appointments — patient books an appointment with an approved doctor
router.post('/appointments', async (req, res, next) => {
  try {
    const { doctorId, scheduledDate, scheduledTime, reason, urgency } = req.body;
    if (!doctorId || !scheduledDate || !scheduledTime) {
      return res.status(400).json({ message: 'doctorId, scheduledDate, and scheduledTime are required.' });
    }

    const doctorProfile = await prisma.doctorProfile.findUnique({ where: { userId: doctorId } });
    if (!doctorProfile || doctorProfile.verificationStatus !== 'APPROVED') {
      return res.status(404).json({ message: 'Doctor not found or not available.' });
    }

    const appointment = await prisma.appointment.create({
      data: {
        doctorId,
        patientId: req.user.id,
        scheduledDate,
        scheduledTime,
        reason: reason || null,
        urgency: urgency || 'Routine',
        status: 'PENDING'
      }
    });

    return res.json({ appointment });
  } catch (error) {
    return next(error);
  }
});

// GET /api/chat/appointments — patient's own appointments, most recent first
router.get('/appointments', async (req, res, next) => {
  try {
    const appointments = await prisma.appointment.findMany({
      where: { patientId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        doctor: { select: { id: true, doctorProfile: { select: { fullName: true, specialty: true } } } }
      }
    });

    return res.json({
      appointments: appointments.map(a => ({
        id: a.id,
        doctorName: a.doctor.doctorProfile?.fullName || 'Doctor',
        specialty: a.doctor.doctorProfile?.specialty || '',
        scheduledDate: a.scheduledDate,
        scheduledTime: a.scheduledTime,
        reason: a.reason,
        urgency: a.urgency,
        status: a.status,
        declineReason: a.declineReason,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt
      }))
    });
  } catch (error) {
    return next(error);
  }
});

// POST /api/chat/conversations — patient starts (or resumes) a conversation with an approved doctor
router.post('/conversations', async (req, res, next) => {
  try {
    const { doctorId } = req.body;
    if (!doctorId) return res.status(400).json({ message: 'doctorId is required.' });

    const doctorProfile = await prisma.doctorProfile.findUnique({ where: { userId: doctorId } });
    if (!doctorProfile || doctorProfile.verificationStatus !== 'APPROVED') {
      return res.status(404).json({ message: 'Doctor not found or not available.' });
    }

    let conversation = await prisma.conversation.findUnique({
      where: { doctorId_patientId: { doctorId, patientId: req.user.id } }
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { doctorId, patientId: req.user.id }
      });
    }

    return res.json({ conversation });
  } catch (error) {
    return next(error);
  }
});

// GET /api/chat/conversations — list this patient's conversations with doctors
router.get('/conversations', async (req, res, next) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: { patientId: req.user.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        doctor: {
          select: {
            id: true,
            firstname: true,
            lastname: true,
            username: true,
            doctorProfile: { select: { fullName: true, specialty: true } }
          }
        },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 }
      }
    });

    const formatted = conversations.map(c => ({
      id: c.id,
      doctorId: c.doctor.id,
      doctorName: c.doctor.doctorProfile?.fullName
        || `${c.doctor.firstname || ''} ${c.doctor.lastname || ''}`.trim()
        || c.doctor.username,
      doctorSpecialty: c.doctor.doctorProfile?.specialty || null,
      lastMessage: c.messages[0]?.content || null,
      lastMessageAt: c.messages[0]?.createdAt || c.createdAt,
      updatedAt: c.updatedAt
    }));

    return res.json({ conversations: formatted });
  } catch (error) {
    return next(error);
  }
});

// GET /api/chat/conversations/:id/messages — fetch messages (patient must own this conversation)
router.get('/conversations/:id/messages', async (req, res, next) => {
  try {
    const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id } });
    if (!conversation || conversation.patientId !== req.user.id) {
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

// POST /api/chat/conversations/:id/messages — patient sends a message (text and/or image)
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
    if (!conversation || conversation.patientId !== req.user.id) {
      return res.status(404).json({ message: 'Conversation not found.' });
    }

    const message = await prisma.message.create({
      data: {
        conversationId: req.params.id,
        senderId: req.user.id,
        senderRole: 'USER',
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
