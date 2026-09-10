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
  optometrist: ['node["healthcare"="optometrist"]', 'node["shop"="optician"]']
};

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

    const overpassRes = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(query)
    });

    if (!overpassRes.ok) {
      // Overpass's public instance is known to be occasionally slow/unstable —
      // degrade gracefully rather than error, so the frontend can fall back to
      // the curated organizations list instead of showing a broken state.
      return res.json({ results: [], degraded: true });
    }

    const data = await overpassRes.json();
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
