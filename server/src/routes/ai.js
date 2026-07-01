const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const aiLimit = require('../middleware/aiLimit');

router.use(requireAuth);
router.use(aiLimit);

router.post('/gemini', async (req, res, next) => {
  try {
    const { messages, systemPrompt } = req.body;
    if (!messages || !Array.isArray(messages)) return res.status(400).json({ message: 'messages array required.' });
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_KEY) return res.status(503).json({ message: 'AI service unavailable.' });
    const contents = messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
    const body = { contents, generationConfig: { maxOutputTokens: 1024, temperature: 0.7 } };
    if (systemPrompt) body.systemInstruction = { parts: [{ text: systemPrompt }] };
    const response = await fetch(https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) return res.status(502).json({ message: 'AI request failed.', detail: data });
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return res.json({ text, usage: res.locals.aiUsage });
  } catch (error) { return next(error); }
});

router.post('/openrouter', async (req, res, next) => {
  try {
    const { messages, systemPrompt } = req.body;
    if (!messages || !Array.isArray(messages)) return res.status(400).json({ message: 'messages array required.' });
    const OR_KEY = process.env.OPENROUTER_API_KEY;
    if (!OR_KEY) return res.status(503).json({ message: 'AI service unavailable.' });
    const allMessages = [];
    if (systemPrompt) allMessages.push({ role: 'system', content: systemPrompt });
    allMessages.push(...messages);
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': Bearer , 'HTTP-Referer': process.env.FRONTEND_ORIGIN || 'https://medai.app', 'X-Title': 'MedAI' }, body: JSON.stringify({ model: 'meta-llama/llama-3.1-8b-instruct:free', messages: allMessages, max_tokens: 1024 }) });
    const data = await response.json();
    if (!response.ok) return res.status(502).json({ message: 'AI request failed.', detail: data });
    const text = data.choices?.[0]?.message?.content || '';
    return res.json({ text, usage: res.locals.aiUsage });
  } catch (error) { return next(error); }
});

router.get('/usage', async (req, res, next) => {
  try {
    const prisma = require('../db');
    const today = new Date().toISOString().slice(0, 10);
    const usage = await prisma.aIUsage.findUnique({ where: { userId_date: { userId: req.user.id, date: today } } });
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { plan: true } });
    const isPremium = user?.plan && user.plan !== 'FREE';
    return res.json({ used: usage?.count || 0, limit: isPremium ? null : 10, isPremium });
  } catch (error) { return next(error); }
});

module.exports = router;
