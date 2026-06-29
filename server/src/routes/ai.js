const express = require('express');
const { z } = require('zod');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { aiLimiter } = require('../middleware/rateLimits');

const router = express.Router();

const chatSchema = z.object({
  aiType: z.enum(['chatbot', 'emotional', 'mental', 'physical']),
  message: z.string().min(1),
  history: z.array(z.any()).optional().default([])
});

const triageAiSchema = z.object({
  symptoms: z.string().min(1),
  context: z.string().optional()
});

router.use(requireAuth, aiLimiter);

router.post('/triage', validate(triageAiSchema), async (req, res) => {
  return res.status(501).json({
    message: 'AI triage proxy is ready for wiring, but GEMINI_API_KEY/provider call still needs to be connected.'
  });
});

router.post('/chat', validate(chatSchema), async (req, res) => {
  if (req.body.aiType === 'physical') {
    return res.status(409).json({
      message: 'Physical Health AI needs a decision: switch it to Gemini/OpenRouter or keep Ollama with a fallback.'
    });
  }

  return res.status(501).json({
    message: 'AI chat proxy is ready for wiring, but provider calls still need to be connected.'
  });
});

module.exports = router;
