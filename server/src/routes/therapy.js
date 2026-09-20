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

// Public Overpass endpoints to try in order. overpass-api.de is the biggest/most
// complete, but has been actively blocking cloud-provider IP ranges (AWS/Azure)
// due to abuse from other users — and Render's infrastructure runs on AWS, so
// requests from this backend can get blocked there even though nothing is wrong
// with the query itself. private.coffee (formerly kumi.systems) is a second,
// independent instance, but small volunteer-run mirrors like this do go down or
// stall on their own. maps.mail.ru is a third, genuinely separate mirror run on
// different infrastructure, added so a single provider's block/outage doesn't
// take down both fallbacks at once.
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
];

async function queryOverpassSingle(endpoint, query, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(query),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      console.error(`Overpass endpoint ${endpoint} returned ${response.status}`);
      throw new Error(`overpass_status_${response.status}`);
    }
    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    console.error(`Overpass endpoint ${endpoint} failed:`, error.message);
    throw error;
  }
}

async function queryOverpass(query) {
  // Trying mirrors one after another meant the worst case was the SUM of every
  // mirror's timeout (previously ~60s, then ~24s) — long enough that a mirror
  // which is simply always blocked for this backend (see the AWS/Azure note
  // below) wastes its full timeout on every single request before the next
  // mirror even gets a chance. Racing all mirrors in parallel instead means
  // the worst case is just ONE timeout period, and a permanently-dead mirror
  // costs nothing beyond that — it simply loses the race every time.
  const TIMEOUT_MS = 12000;
  try {
    return await Promise.any(
      OVERPASS_ENDPOINTS.map(endpoint => queryOverpassSingle(endpoint, query, TIMEOUT_MS))
    );
  } catch (aggregateError) {
    return null; // every endpoint failed
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
    const r = Math.min(Number(radius) || 20000, 50000); // cap at 50km to keep queries reasonable
    const clauses = filters.map(f => `${f}(around:${r},${lat},${lng});`).join('\n  ');
    const query = `[out:json][timeout:20];\n(\n  ${clauses}\n);\nout center tags;`;

    const data = await queryOverpass(query);
    if (!data) {
      // Every mirror failed — degrade gracefully rather than error, so the frontend
      // can fall back to the curated organizations list instead of a broken state.
      return res.json({ results: [], degraded: true });
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

    return res.json({ results, degraded: false });
  } catch (error) {
    // Same graceful-degradation principle — a flaky third-party API shouldn't 500 the page.
    return res.json({ results: [], degraded: true });
  }
});

module.exports = router;
