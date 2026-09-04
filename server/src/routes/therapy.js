const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// Search for therapists/mental health clinics/counsellors near a location using
// OpenStreetMap's Overpass API — free, no API key required (matches the rest of
// the app's map stack, which moved off Google Maps/Places for the same reason).
router.get('/search', async (req, res, next) => {
  try {
    const { lat, lng, radius = 20000 } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ message: 'lat and lng are required.' });
    }

    const r = Math.min(Number(radius) || 20000, 50000); // cap at 50km to keep queries reasonable

    const query = `[out:json][timeout:20];
(
  node["healthcare"~"psychotherapist|counselling|counseling|psychiatrist"](around:${r},${lat},${lng});
  way["healthcare"~"psychotherapist|counselling|counseling|psychiatrist"](around:${r},${lat},${lng});
  node["office"="therapist"](around:${r},${lat},${lng});
  node["amenity"="clinic"]["healthcare:speciality"~"psychiatry|psychotherapy"](around:${r},${lat},${lng});
);
out center tags;`;

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
          type: tags.healthcare || tags.office || 'therapist'
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
