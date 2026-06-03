// Vercel Serverless Function: api/distance.js
// Securely proxies requests to Google Maps Distance Matrix API to hide API key.

export default async function handler(req, res) {
  const { origins, destinations } = req.query;

  if (!origins || !destinations) {
    return res.status(400).json({ error: 'Missing origins or destinations' });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Google Maps API key not configured on server' });
  }

  const { departure_time, avoid } = req.query;
  let url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origins)}&destinations=${encodeURIComponent(destinations)}&key=${apiKey}`;
  if (departure_time) url += `&departure_time=${encodeURIComponent(departure_time)}`;
  if (avoid) url += `&avoid=${encodeURIComponent(avoid)}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch distance matrix' });
  }
}
