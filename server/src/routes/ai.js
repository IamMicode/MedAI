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
      'HTTP-Referer': process.env.FRONTEND_ORIGIN || 'https://medai.app',
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
