const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const aiLimit = require('../middleware/aiLimit');

router.use(requireAuth);
router.use(aiLimit);

// helper: call Gemini
async function geminiCall(messages, systemPrompt) {
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) throw new Error('no_gemini_key');
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));
  const body = { contents, generationConfig: { maxOutputTokens: 1024, temperature: 0.7 } };
  if (systemPrompt) body.systemInstruction = { parts: [{ text: systemPrompt }] };
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + GEMINI_KEY;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) {
    const isQuota = data?.error?.status === 'RESOURCE_EXHAUSTED';
    throw new Error(isQuota ? 'quota' : 'gemini_error');
  }
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// helper: call OpenRouter
async function openrouterCall(messages, systemPrompt, model) {
  const OR_KEY = process.env.OPENROUTER_API_KEY;
  if (!OR_KEY) throw new Error('no_or_key');
  const allMessages = [];
  if (systemPrompt) allMessages.push({ role: 'system', content: systemPrompt });
  allMessages.push(...messages);
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + OR_KEY,
      'HTTP-Referer': process.env.FRONTEND_ORIGIN || 'https://medai.app',
      'X-Title': 'MedAI'
    },
    body: JSON.stringify({
      model: model || 'meta-llama/llama-3.3-70b-instruct:free',
      messages: allMessages,
      max_tokens: 1024
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error('or_error: ' + (data?.error?.message || response.status));
  return data.choices?.[0]?.message?.content || '';
}

// Gemini route — falls back to OpenRouter if Gemini is rate limited
router.post('/gemini', async (req, res, next) => {
  try {
    const { messages, systemPrompt } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ message: 'messages array required.' });
    }
    let text = '';
    try {
      text = await geminiCall(messages, systemPrompt);
    } catch (e) {
      if (e.message === 'quota' || e.message === 'gemini_error' || e.message === 'no_gemini_key') {
        // fallback to OpenRouter
        text = await openrouterCall(messages, systemPrompt, 'meta-llama/llama-3.3-70b-instruct:free');
      } else {
        throw e;
      }
    }
    return res.json({ text, usage: res.locals.aiUsage });
  } catch (error) {
    return next(error);
  }
});

// OpenRouter route — tries primary model, falls back to openrouter/auto
router.post('/openrouter', async (req, res, next) => {
  try {
    const { messages, systemPrompt } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ message: 'messages array required.' });
    }
    let text = '';
    try {
      text = await openrouterCall(messages, systemPrompt, 'meta-llama/llama-3.3-70b-instruct:free');
    } catch (e) {
      // try the auto-free-model router as fallback
      text = await openrouterCall(messages, systemPrompt, 'openrouter/auto');
    }
    return res.json({ text, usage: res.locals.aiUsage });
  } catch (error) {
    return next(error);
  }
});

// Get today's usage
router.get('/usage', async (req, res, next) => {
  try {
    const prisma = require('../db');
    const today = new Date().toISOString().slice(0, 10);
    const usage = await prisma.aIUsage.findUnique({
      where: { userId_date: { userId: req.user.id, date: today } }
    });
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { plan: true }
    });
    const isPremium = user && user.plan && user.plan !== 'FREE';
    return res.json({
      used: usage ? usage.count : 0,
      limit: isPremium ? null : 10,
      isPremium
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
