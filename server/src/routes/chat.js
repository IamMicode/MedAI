const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const prisma = require('../db');

router.use(requireAuth);

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

// POST /api/chat/conversations/:id/messages — patient sends a message
router.post('/conversations/:id/messages', async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ message: 'Message content is required.' });

    const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id } });
    if (!conversation || conversation.patientId !== req.user.id) {
      return res.status(404).json({ message: 'Conversation not found.' });
    }

    const message = await prisma.message.create({
      data: {
        conversationId: req.params.id,
        senderId: req.user.id,
        senderRole: 'USER',
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
