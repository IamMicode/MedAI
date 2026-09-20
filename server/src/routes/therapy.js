const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// Category → Overpass OSM tag filters. Only categories with well-established,
// reliable OSM tagging conventions are included — accuracy over coverage.
const CATEGORY_FILTERS = {
  hospital: ['node["amenity"="hospital"]', 'way["amenity"="hospital"]'],
  clinic: ['node["amenity"="clinic"]', 'way["amenity"="clinic"]', 'node["amenity"="doctors"]'],
  pharmacy: ['node["amenity"="pharmacy"]'],
  dentist: ['node["amenity"="dentist"]'],
  mental_health: [
    'node["healthcare"~"psychotherapist|counselling|counseling|psychiatrist"]',
    'way["healthcare"~"psychotherapist|counselling|counseling|psychiatrist"]',
    'node["office"="therapist"]',
    'node["amenity"="clinic"]["healthcare:speciality"~"psychiatry|psychotherapy"]'
  ],
  physiotherapy: ['node["healthcare"="physiotherapist"]', 'way["healthcare"="physiotherapist"]'],
  optometrist: ['node["healthcare"="optometrist"]', 'node["shop"="optician"]'],
  // "Diagnostic Centers" doesn't have its own widely-adopted OSM tag distinct from
  // laboratory, so the two are combined here rather than adding a category that
  // would reliably return nothing.
  laboratory: ['node["healthcare"="laboratory"]', 'way["healthcare"="laboratory"]'],
  // Broad catch-all for any other tagged healthcare facility not covered above.
  other_healthcare: ['node["healthcare"]', 'way["healthcare"]']
};

// Public Overpass endpoints, raced in parallel (see queryOverpass below).
// overpass-api.de is the biggest/most complete mirror; private.coffee (formerly
// kumi.systems) and maps.mail.ru are independent instances on separate
// infrastructure, so a single provider's outage or policy change can't take
// down all three at once.
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
];

// The Overpass query itself declares [timeout:20] below — the server is told
// it has up to 20s to execute. The HTTP-level timeout here MUST be longer than
// that, or a legitimately-slow-but-valid query gets aborted client-side before
// the server even finishes, which then misreports as a network/timeout failure
// rather than what it actually is. 18s (query timeout) + 7s network/queueing
// buffer = 25s per mirror.
const OVERPASS_QUERY_TIMEOUT_S = 18;
const FETCH_TIMEOUT_MS = 25000;

// Identify this app to a shared public resource rather than sending Node's
// generic default (`User-Agent: node`, no Referer at all) — overpass-api.de in
// particular has been reported (OSM community forum, 2026) to reject
// unidentified-looking requests with HTTP 406. FRONTEND_ORIGIN is the same env
// var already used for this exact purpose elsewhere in this codebase (see the
// OpenRouter HTTP-Referer header in ai.js) — reused here rather than inventing
// a new config value or a fake contact address.
const APP_ORIGIN = process.env.FRONTEND_ORIGIN || 'https://medai.app';
const OVERPASS_REQUEST_HEADERS = {
  'Content-Type': 'application/x-www-form-urlencoded',
  'User-Agent': `MedAI-Locator/1.0 (+${APP_ORIGIN})`,
  'Referer': APP_ORIGIN,
  'Accept': 'application/json'
};

// Classifies a failure so it can be logged and, when every mirror fails,
// reported to the frontend distinctly rather than one generic message —
// a 406 (request rejected), a 429 (rate-limited), a 5xx (provider failure),
// and a genuine timeout/network error all mean different things and call for
// different next steps.
function classifyFailure(status, error) {
  if (status === 406) return 'rejected';
  if (status === 429) return 'rate_limited';
  if (status === 400) return 'bad_query';
  if (status >= 500) return 'provider_error';
  if (error?.name === 'AbortError') return 'timeout';
  return 'network_error';
}

async function queryOverpassSingle(endpoint, query, timeoutMs, sharedController) {
  const timeoutId = setTimeout(() => sharedController.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: OVERPASS_REQUEST_HEADERS,
      body: 'data=' + encodeURIComponent(query),
      signal: sharedController.signal
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      const reason = classifyFailure(response.status, null);
      console.error(`Overpass endpoint ${endpoint} returned ${response.status} (${reason})`);
      const err = new Error(`overpass_${reason}_${response.status}`);
      err.reason = reason;
      err.status = response.status;
      err.endpoint = endpoint;
      throw err;
    }
    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.reason) throw error; // already classified above
    const reason = classifyFailure(null, error);
    console.error(`Overpass endpoint ${endpoint} failed (${reason}):`, error.message);
    const wrapped = new Error(`overpass_${reason}`);
    wrapped.reason = reason;
    wrapped.endpoint = endpoint;
    throw wrapped;
  }
}

async function queryOverpass(query) {
  // Racing all mirrors in parallel means the worst case is one timeout period
  // total, not the sum of all three — and a mirror that's permanently
  // unreachable for this backend costs nothing beyond that, it just loses the
  // race every time. Each attempt shares one AbortController per *other*
  // attempt so that once any mirror wins, the still-in-flight losers are
  // actively cancelled instead of being left to run to completion in the
  // background for no reason. The winning index is tracked explicitly so its
  // own controller is never touched (aborting an already-completed request is
  // harmless, but there's no reason to call it either).
  const controllers = OVERPASS_ENDPOINTS.map(() => new AbortController());
  const attempts = OVERPASS_ENDPOINTS.map((endpoint, i) =>
    queryOverpassSingle(endpoint, query, FETCH_TIMEOUT_MS, controllers[i]).then(data => ({ i, data }))
  );

  try {
    const { i: winnerIndex, data } = await Promise.any(attempts);
    controllers.forEach((c, idx) => { if (idx !== winnerIndex && !c.signal.aborted) c.abort(); });
    return { data, failures: [] };
  } catch (aggregateError) {
    // Every mirror failed — collect what each one actually said, so the caller
    // (and Render's logs) can tell a 406 apart from a timeout apart from a 5xx,
    // instead of a single opaque "degraded" flag.
    const failures = (aggregateError.errors || []).map(e => ({
      endpoint: e.endpoint,
      reason: e.reason || 'unknown'
    }));
    return { data: null, failures };
  }
}

// Search for medical facilities near a location using OpenStreetMap's Overpass
// API — free, no API key required (matches the rest of the app's map stack,
// which moved off Google Maps/Places for the same reason).
router.get('/search', async (req, res, next) => {
  try {
    const { lat, lng, radius = 20000, category = 'mental_health' } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ message: 'lat and lng are required.' });
    }

    const filters = CATEGORY_FILTERS[category] || CATEGORY_FILTERS.mental_health;
    const r = Math.min(Number(radius) || 20000, 50000); // cap at 50km to keep queries reasonable and responsible toward a shared free resource
    const clauses = filters.map(f => `${f}(around:${r},${lat},${lng});`).join('\n  ');
    const query = `[out:json][timeout:${OVERPASS_QUERY_TIMEOUT_S}];\n(\n  ${clauses}\n);\nout center tags;`;

    const { data, failures } = await queryOverpass(query);
    if (!data) {
      // Every mirror failed. This is a genuine search failure, not "no
      // facilities found" — the frontend must not present these the same way.
      // failureReason lets the frontend show a specific message; Render's own
      // logs already have the per-mirror detail via the console.error calls above.
      const primaryReason = failures[0]?.reason || 'unknown';
      return res.json({ results: [], degraded: true, failureReason: primaryReason, failures });
    }
    const seen = new Set();

    const results = (data.elements || [])
      .map(el => {
        const tags = el.tags || {};
        const name = tags.name;
        if (!name) return null; // skip unnamed entries — not useful to show

        const elLat = el.lat ?? el.center?.lat;
        const elLng = el.lon ?? el.center?.lon;
        if (!elLat || !elLng) return null;

        const addressParts = [tags['addr:housenumber'], tags['addr:street'], tags['addr:city']].filter(Boolean);
        const address = tags['addr:full'] || (addressParts.length ? addressParts.join(', ') : null);

        return {
          id: `${el.type}/${el.id}`,
          name,
          address,
          lat: elLat,
          lng: elLng,
          phone: tags.phone || tags['contact:phone'] || null,
          website: tags.website || tags['contact:website'] || null,
          type: tags.amenity || tags.healthcare || tags.office || tags.shop || category
        };
      })
      .filter(item => {
        if (!item) return false;
        if (seen.has(item.name + item.lat)) return false; // de-dupe node+way pairs for the same place
        seen.add(item.name + item.lat);
        return true;
      })
      .slice(0, 30);

    // A successful request with zero matching facilities is NOT a failure —
    // it's a legitimate empty result, and must be distinguishable from the
    // degraded:true case above so the frontend never says "no hospitals here"
    // when the real story is "the search couldn't be completed."
    return res.json({ results, degraded: false });
  } catch (error) {
    console.error('Unexpected error in /therapy/search:', error.message);
    return res.json({ results: [], degraded: true, failureReason: 'unexpected_error', failures: [] });
  }
});

module.exports = router;

