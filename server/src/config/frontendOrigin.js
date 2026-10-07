// Single source of truth for the Med AI frontend's origin — used for CORS,
// Google OAuth redirects, Bachs payment success/cancel URLs, and the
// OpenRouter Referer header.
//
// Before this file existed, each of those five call sites read
// process.env.FRONTEND_ORIGIN directly with its own independently-guessed
// fallback: 'http://localhost:3000' in two places, 'https://medai.app' in
// two others, and an empty string in a fifth (which produced a redirect
// relative to the BACKEND's own Render domain — a dead 404, not even a
// wrong domain). A missing env var therefore sent different features to
// different wrong places instead of one clear, consistent signal that
// something's misconfigured.
//
// PRODUCTION_FRONTEND_ORIGIN below is this project's actual deployed
// frontend. Confirm this is still correct for your current deployment —
// this fallback exists as a safety net, not a substitute for setting the
// real FRONTEND_ORIGIN env var in Render.
const PRODUCTION_FRONTEND_ORIGIN = 'https://med-ai-3.vercel.app';

// Origins the frontend is actually served from during local development
// (Forget_Password.html, dashboard.js, and doctor-dashboard.html each point
// their own API_BASE_URL at one of these two when running on localhost).
const LOCAL_DEV_ORIGINS = ['http://localhost:5500', 'http://127.0.0.1:5500'];

// The one origin to use when building a URL (OAuth redirect, payment
// success/cancel URL, Referer header) — always a single, real origin, never
// a wildcard and never a list.
function getFrontendOrigin() {
  return process.env.FRONTEND_ORIGIN || PRODUCTION_FRONTEND_ORIGIN;
}

// The full set of origins CORS should accept. FRONTEND_ORIGIN may contain
// more than one, comma-separated, for a project that's legitimately served
// from multiple domains (e.g. a custom domain alongside the Vercel one).
function getAllowedOrigins() {
  const configured = (process.env.FRONTEND_ORIGIN || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);
  return [...new Set([...configured, PRODUCTION_FRONTEND_ORIGIN, ...LOCAL_DEV_ORIGINS])];
}

module.exports = { getFrontendOrigin, getAllowedOrigins };
