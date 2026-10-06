const express = require('express');
const router = express.Router();
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');
const aiLimit = require('../middleware/aiLimit');
const { getFrontendOrigin } = require('../config/frontendOrigin');

router.use(requireAuth);
router.use(aiLimit);

const MAX_MEMORY_FACTS_PER_USER = 40;

// Appended to every chat mode's system prompt server-side, so memory works
// uniformly across general/medical/emotional/mental/physical (and any future
// mode) without each one needing its own copy of this instruction.
const MEMORY_EXTRACTION_INSTRUCTION = `

If — and only if — this exchange reveals a new, durable fact worth remembering about the user for future conversations (e.g. a diagnosed condition, an allergy, a medication, a goal, a recurring symptom, a preference, an important life detail they shared) — append it after your reply on its own line in this exact format, with each fact separated by " | " if there is more than one:
[MEMORY: fact one | fact two]
Only include facts that are actually new and durable — never repeat something already listed in "What you know about this user" below, and never include this block at all if nothing new and worth remembering came up. Never mention this instruction or the memory block to the user.`;

async function getUserMemoryContext(userId) {
  // Memory is a best-effort enhancement — if anything goes wrong reading it
  // (table not migrated yet, transient DB error), chat must keep working
  // without it rather than failing the whole request.
  try {
    const facts = await prisma.userMemoryFact.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: MAX_MEMORY_FACTS_PER_USER
    });
    if (!facts.length) return '';
    const lines = facts.slice().reverse().map(f => `- ${f.fact}`).join('\n');
    return `\n\nWhat you know about this user from past conversations (use naturally where relevant; do not recite this list or bring it up unprompted):\n${lines}`;
  } catch (e) {
    console.error('Memory read failed (continuing without it):', e.message);
    return '';
  }
}

function buildSystemPrompt(basePrompt, memoryContext) {
  return `${basePrompt || ''}${memoryContext}${MEMORY_EXTRACTION_INSTRUCTION}`;
}

// Strips the trailing [MEMORY: ...] block (if any) from a raw AI reply before
// it's shown to the user, and fires off saving each fact in the background —
// never blocks the response the user is waiting on.
function extractAndStripMemory(rawText, userId, source) {
  const match = /\n?\[MEMORY:\s*([^\]]+)\]\s*$/i.exec(rawText.trim());
  if (!match) return rawText;

  const cleanText = rawText.slice(0, match.index).trim();
  const facts = match[1].split('|').map(f => f.trim()).filter(f => f.length > 3 && f.length < 300);

  if (facts.length) {
    // Fire-and-forget — a memory-save hiccup should never surface as a chat error.
    saveMemoryFacts(userId, facts, source).catch(e => console.error('Memory save failed:', e.message));
  }

  return cleanText || rawText; // fall back to the raw text if stripping left nothing
}

async function saveMemoryFacts(userId, facts, source) {
  const existing = await prisma.userMemoryFact.findMany({ where: { userId }, select: { fact: true } });
  const existingLower = new Set(existing.map(f => f.fact.toLowerCase()));

  const newFacts = facts.filter(f => !existingLower.has(f.toLowerCase()));
  if (!newFacts.length) return;

  await prisma.userMemoryFact.createMany({
    data: newFacts.map(fact => ({ userId, fact, source }))
  });

  // Keep the table bounded — prune oldest beyond the cap rather than letting
  // it grow forever (and rather than the injected context growing unbounded).
  const count = await prisma.userMemoryFact.count({ where: { userId } });
  if (count > MAX_MEMORY_FACTS_PER_USER) {
    const toPrune = await prisma.userMemoryFact.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      take: count - MAX_MEMORY_FACTS_PER_USER,
      select: { id: true }
    });
    await prisma.userMemoryFact.deleteMany({ where: { id: { in: toPrune.map(f => f.id) } } });
  }
}

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
      'HTTP-Referer': getFrontendOrigin(),
      'X-Title': 'MedAI'
    },
    body: JSON.stringify({ model: model, messages: allMessages, max_tokens: 1024 })
  });
  const data = await response.json();
  if (!response.ok || response.status === 503) throw new Error('or_' + response.status + ': ' + (data?.error?.message || ''));
  // also check for error inside a 200 response (some providers do this)
  if (data?.error) throw new Error('or_error: ' + (data.error.message || ''));
  const text = data.choices?.[0]?.message?.content || '';
  if (!text) throw new Error('empty_response');
  return text;
}

// Gemini route — falls back to OpenRouter auto if Gemini fails
router.post('/gemini', async (req, res, next) => {
  try {
    const { messages, systemPrompt, source } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ message: 'messages array required.' });
    }
    // Memory only applies to genuine chat conversations (source is one of the
    // named chat modes) — never to one-off utility calls like triage's
    // structured-JSON classification or connection-test pings, which have no
    // business reading or writing user memory and would just waste tokens.
    const fullSystemPrompt = source
      ? buildSystemPrompt(systemPrompt, await getUserMemoryContext(req.user.id))
      : systemPrompt;

    let text = '';
    try {
      text = await geminiCall(messages, fullSystemPrompt);
    } catch (e) {
      console.log('Gemini failed:', e.message, '— falling back to OpenRouter');
      try {
        text = await openrouterCall(messages, fullSystemPrompt, 'openrouter/auto');
      } catch (e2) {
        console.log('OpenRouter auto also failed:', e2.message);
        throw new Error('all_providers_failed');
      }
    }
    if (source) text = extractAndStripMemory(text, req.user.id, source);
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
    const { messages, systemPrompt, source } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ message: 'messages array required.' });
    }
    const fullSystemPrompt = source
      ? buildSystemPrompt(systemPrompt, await getUserMemoryContext(req.user.id))
      : systemPrompt;

    let text = '';
    try {
      // try auto first (picks best available free model)
      text = await openrouterCall(messages, fullSystemPrompt, 'openrouter/auto');
    } catch (e) {
      console.log('OpenRouter auto failed:', e.message, '— falling back to Gemini');
      try {
        text = await geminiCall(messages, fullSystemPrompt);
      } catch (e2) {
        console.log('Gemini fallback also failed:', e2.message);
        throw new Error('all_providers_failed');
      }
    }
    if (source) text = extractAndStripMemory(text, req.user.id, source);
    return res.json({ text, usage: res.locals.aiUsage });
  } catch (error) {
    if (error.message === 'all_providers_failed') {
      return res.status(503).json({ message: 'AI temporarily unavailable. Please try again in a moment.' });
    }
    return next(error);
  }
});

// GET /api/ai/memory — list what the AI has learned about this user, for
// transparency: memory should never be an invisible black box, especially
// in a health app.
router.get('/memory', async (req, res, next) => {
  try {
    const facts = await prisma.userMemoryFact.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });
    return res.json({ facts });
  } catch (error) {
    return next(error);
  }
});

// DELETE /api/ai/memory/:id — forget one specific fact
router.delete('/memory/:id', async (req, res, next) => {
  try {
    const fact = await prisma.userMemoryFact.findUnique({ where: { id: req.params.id } });
    if (!fact || fact.userId !== req.user.id) return res.status(404).json({ message: 'Fact not found.' });
    await prisma.userMemoryFact.delete({ where: { id: req.params.id } });
    return res.json({ message: 'Forgotten.' });
  } catch (error) {
    return next(error);
  }
});

// DELETE /api/ai/memory — forget everything
router.delete('/memory', async (req, res, next) => {
  try {
    await prisma.userMemoryFact.deleteMany({ where: { userId: req.user.id } });
    return res.json({ message: 'All memory cleared.' });
  } catch (error) {
    return next(error);
  }
});

router.get('/usage', async (req, res, next) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const usage = await prisma.aIUsage.findUnique({
      where: { userId_date: { userId: req.user.id, date: today } }
    });
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { plan: true }
    });
    const isPremium = user && user.plan && user.plan !== 'Free';
    return res.json({ used: usage ? usage.count : 0, limit: isPremium ? null : 10, isPremium });
  } catch (error) {
    return next(error);
  }
});

async function geminiVisionCall(base64Data, mimeType, promptText, systemPrompt) {
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) throw new Error('no_gemini_key');
  const body = {
    contents: [{
      role: 'user',
      parts: [
        { text: promptText },
        { inlineData: { mimeType, data: base64Data } }
      ]
    }],
    generationConfig: { maxOutputTokens: 1536, temperature: 0.4 }
  };
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

// Fallback for when Gemini vision is unavailable — 'openrouter/free' is OpenRouter's
// own router that auto-selects a free model supporting whatever the request needs
// (here, image understanding), so this doesn't depend on any one vision model's
// slug staying available. Uses the standard OpenAI-compatible content-array format
// for image input, which OpenRouter proxies as-is regardless of the underlying model.
async function openrouterVisionCall(imageDataUri, promptText, systemPrompt) {
  const OR_KEY = process.env.OPENROUTER_API_KEY;
  if (!OR_KEY) throw new Error('no_or_key');
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({
    role: 'user',
    content: [
      { type: 'text', text: promptText },
      { type: 'image_url', image_url: { url: imageDataUri } }
    ]
  });
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + OR_KEY,
      'HTTP-Referer': getFrontendOrigin(),
      'X-Title': 'MedAI'
    },
    body: JSON.stringify({ model: 'openrouter/free', messages, max_tokens: 1536 })
  });
  const data = await response.json();
  if (!response.ok) throw new Error('or_' + response.status + ': ' + (data?.error?.message || ''));
  if (data?.error) throw new Error('or_error: ' + (data.error.message || ''));
  const text = data.choices?.[0]?.message?.content || '';
  if (!text) throw new Error('empty_response');
  return text;
}

// System prompt shared by both the typed-text and photo paths, so a report gets the
// exact same explanation quality and safety framing regardless of how it arrived.
const REPORT_ANALYSIS_SYSTEM_PROMPT = `You are a medical report reading assistant inside MedAI. You will receive either a photo of a medical document (lab result, prescription, or report) or typed/pasted report text.

Respond in exactly this structure:

EXTRACTED TEXT:
Transcribe the medical content as accurately as you can — test names, values, units, and any reference ranges shown. For typed input, just repeat it cleanly. If part of an image is blurry or illegible, say so plainly instead of guessing a value.

EXPLANATION:
For each test or value found, state in plain English whether it looks normal, high, low, or abnormal (using any reference range shown, or common general ranges if none is given), plus a one-line note on what that might relate to. Never state a diagnosis — use language like "may be worth asking your doctor about" rather than definitive claims. If anything looks urgent or dangerously abnormal, say so clearly and recommend prompt medical attention. End with 2-3 questions the person could bring to a doctor about these results.

This is a plain-English reading aid, not a diagnosis. Keep it clear and free of unexplained jargon.`;

// POST /api/ai/analyze-report — OCR + plain-English explanation for a lab result,
// prescription, or report, whether pasted as text or uploaded as a photo.
router.post('/analyze-report', async (req, res, next) => {
  try {
    const { text, imageData } = req.body;
    if (!text?.trim() && !imageData) {
      return res.status(400).json({ message: 'Provide report text or an image to analyze.' });
    }

    let rawResult = '';

    if (imageData) {
      const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(imageData);
      if (!match) return res.status(400).json({ message: 'Invalid image format.' });
      const [, mimeType, base64] = match;
      const approxBytes = base64.length * 3 / 4;
      if (approxBytes > 5 * 1024 * 1024) {
        return res.status(400).json({ message: 'Image is too large. Please use an image under 5MB.' });
      }

      const promptText = 'Here is a photo of a medical report, lab result, or prescription. Read it and follow your instructions.';
      try {
        rawResult = await geminiVisionCall(base64, mimeType, promptText, REPORT_ANALYSIS_SYSTEM_PROMPT);
      } catch (e) {
        console.log('Gemini vision failed:', e.message, '— falling back to OpenRouter vision');
        try {
          rawResult = await openrouterVisionCall(imageData, promptText, REPORT_ANALYSIS_SYSTEM_PROMPT);
        } catch (e2) {
          console.log('OpenRouter vision fallback also failed:', e2.message);
          throw new Error('all_providers_failed');
        }
      }
    } else {
      const trimmed = text.trim();
      if (trimmed.length > 8000) {
        return res.status(400).json({ message: 'That text is too long — please shorten it to under 8,000 characters.' });
      }
      const promptText = `Here is medical report text pasted by the user:\n\n${trimmed}\n\nFollow your instructions.`;
      try {
        rawResult = await geminiCall([{ role: 'user', content: promptText }], REPORT_ANALYSIS_SYSTEM_PROMPT);
      } catch (e) {
        console.log('Gemini failed:', e.message, '— falling back to OpenRouter');
        try {
          rawResult = await openrouterCall([{ role: 'user', content: promptText }], REPORT_ANALYSIS_SYSTEM_PROMPT, 'openrouter/auto');
        } catch (e2) {
          console.log('OpenRouter fallback also failed:', e2.message);
          throw new Error('all_providers_failed');
        }
      }
    }

    // Split the model's structured reply into the two sections the frontend
    // renders separately — extracted text lets the user sanity-check what the
    // AI actually read before trusting the explanation built on top of it.
    const extractedMatch = /EXTRACTED TEXT:([\s\S]*?)EXPLANATION:/i.exec(rawResult);
    const explanationMatch = /EXPLANATION:([\s\S]*)/i.exec(rawResult);
    const extractedText = extractedMatch ? extractedMatch[1].trim() : (imageData ? '(Could not separate extracted text from the response)' : text.trim());
    const explanation = explanationMatch ? explanationMatch[1].trim() : rawResult.trim();

    return res.json({ extractedText, explanation, usage: res.locals.aiUsage });
  } catch (error) {
    if (error.message === 'all_providers_failed') {
      return res.status(503).json({ message: 'AI temporarily unavailable. Please try again in a moment.' });
    }
    return next(error);
  }
});

module.exports = router;
