const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// Search for therapists/mental health clinics near a location
router.get('/search', async (req, res, next) => {
  try {
    const { query, location, lat, lng, radius = 10000 } = req.query;
    const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY;
    if (!PLACES_KEY) return res.status(503).json({ message: 'Search service unavailable.' });

    let searchUrl;

    if (lat && lng) {
      const searchQuery = encodeURIComponent(query || 'therapist mental health counselor psychologist');
      searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${searchQuery}&location=${lat},${lng}&radius=${radius}&type=health&key=${PLACES_KEY}`;
    } else if (location) {
      const searchQuery = encodeURIComponent(`therapist mental health counselor ${location}`);
      searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${searchQuery}&type=health&key=${PLACES_KEY}`;
    } else {
      return res.status(400).json({ message: 'Provide location or lat/lng coordinates.' });
    }

    const response = await fetch(searchUrl);
    const data = await response.json();

    if (!response.ok || data.status === 'REQUEST_DENIED') {
      return res.status(502).json({ message: 'Places search failed.', detail: data.error_message });
    }

    const results = (data.results || []).slice(0, 12).map(place => ({
      id: place.place_id,
      name: place.name,
      address: place.formatted_address || place.vicinity || '',
      lat: place.geometry?.location?.lat,
      lng: place.geometry?.location?.lng,
      rating: place.rating || null,
      totalRatings: place.user_ratings_total || 0,
      open: place.opening_hours?.open_now ?? null,
      types: place.types || [],
      mapsUrl: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`
    }));

    return res.json({ results, total: results.length, status: data.status });
  } catch (error) {
    return next(error);
  }
});

// Get place details (phone number, website, hours)
router.get('/details/:placeId', async (req, res, next) => {
  try {
    const { placeId } = req.params;
    const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY;
    if (!PLACES_KEY) return res.status(503).json({ message: 'Search service unavailable.' });

    const fields = 'name,formatted_phone_number,website,opening_hours,formatted_address,rating,url';
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${PLACES_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || data.status === 'REQUEST_DENIED') {
      return res.status(502).json({ message: 'Place details failed.', detail: data.error_message });
    }

    const r = data.result || {};
    return res.json({
      phone: r.formatted_phone_number || null,
      website: r.website || null,
      hours: r.opening_hours?.weekday_text || null,
      address: r.formatted_address || null,
      rating: r.rating || null,
      mapsUrl: r.url || null
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
