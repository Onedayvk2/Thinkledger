export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'No profile ID' });

  const UPSTASH_URL   = process.env.UPSTASH_REDIS_REST_URL;
  const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  try {
    const kvRes = await fetch(`${UPSTASH_URL}/get/profile:${id}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
    });
    const result = await kvRes.json();

    if (!result.result) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // result.result is the raw stored string — parse it
    let payload;
    try {
      payload = JSON.parse(result.result);
    } catch(e) {
      payload = result.result; // already an object
    }

    // payload = { id, profile: {...}, metadata: {...} }
    // profile.html expects: data.profile.profileName, data.profile.meta
    const out = {
      ...payload.profile,
      meta: payload.metadata
    };

    return res.status(200).json({ profile: out });

  } catch (err) {
    console.error('profile fetch error:', err.message);
    return res.status(500).json({ error: 'Could not retrieve profile' });
  }
}
