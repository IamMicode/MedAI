const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const aiLimit = require('../middleware/aiLimit');

router.use(requireAuth);
router.use(aiLimit);

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
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) {
    const status = data?.error?.status || '';
    if (status === 'RESOURCE_EXHAUSTED' || response.status === 429) throw new Error('quota');
    throw new Error('gemini_' + response.status);
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!text) throw new Error('empty_response');
  return text;
}

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
    body: JSON.stringify({ model: model, messages: allMessages, max_tokens: 1024 })
  });
  const data = await response.json();
  if (!response.ok) throw new Error('or_' + response.status + ': ' + (data?.error?.message || ''));
  const text = data.choices?.[0]?.message?.content || '';
  if (!text) throw new Error('empty_response');
  return text;
}

// Gemini route — falls back to OpenRouter auto if Gemini fails
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
      console.log('Gemini failed:', e.message, '— falling back to OpenRouter');
      try {
        text = await openrouterCall(messages, systemPrompt, 'openrouter/auto');
      } catch (e2) {
        console.log('OpenRouter auto also failed:', e2.message);
        throw new Error('all_providers_failed');
      }
    }
    return res.json({ text, usage: res.locals.aiUsage });
  } catch (error) {
    if (error.message === 'all_providers_failed') {
      return res.status(503).json({ message: 'AI temporarily unavailable. Please try again in a moment.' });
    }
    return next(error);
  }
});

// OpenRouter route — tries auto model which picks best available free model
router.post('/openrouter', async (req, res, next) => {
  try {
    const { messages, systemPrompt } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ message: 'messages array required.' });
    }
    let text = '';
    try {
      // try auto first (picks best available free model)
      text = await openrouterCall(messages, systemPrompt, 'openrouter/auto');
    } catch (e) {
      console.log('OpenRouter auto failed:', e.message, '— falling back to Gemini');
      try {
        text = await geminiCall(messages, systemPrompt);
      } catch (e2) {
        console.log('Gemini fallback also failed:', e2.message);
        throw new Error('all_providers_failed');
      }
    }
    return res.json({ text, usage: res.locals.aiUsage });
  } catch (error) {
    if (error.message === 'all_providers_failed') {
      return res.status(503).json({ message: 'AI temporarily unavailable. Please try again in a moment.' });
    }
    return next(error);
  }
});

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
    return res.json({ used: usage ? usage.count : 0, limit: isPremium ? null : 10, isPremium });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
