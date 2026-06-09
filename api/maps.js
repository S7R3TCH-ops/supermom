// Proxy for Google Maps APIs. Route via ?type=distance or ?type=geocode.
export default async function handler(req, res) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Google Maps API key not configured' });

  const { type } = req.query;

  if (type === 'geocode') {
    const { address } = req.query;
    if (!address) return res.status(400).json({ error: 'Missing address' });
    try {
      const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`);
      return res.status(200).json(await r.json());
    } catch {
      return res.status(500).json({ error: 'Failed to geocode address' });
    }
  }

  if (type === 'distance') {
    const { origins, destinations, departure_time, avoid } = req.query;
    if (!origins || !destinations) return res.status(400).json({ error: 'Missing origins or destinations' });
    let url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origins)}&destinations=${encodeURIComponent(destinations)}&key=${apiKey}`;
    if (departure_time) url += `&departure_time=${encodeURIComponent(departure_time)}`;
    if (avoid) url += `&avoid=${encodeURIComponent(avoid)}`;
    try {
      const r = await fetch(url);
      return res.status(200).json(await r.json());
    } catch {
      return res.status(500).json({ error: 'Failed to fetch distance matrix' });
    }
  }

  return res.status(400).json({ error: 'Missing or invalid type param. Use type=distance or type=geocode.' });
}
