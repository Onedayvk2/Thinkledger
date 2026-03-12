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

  let payload = null;

  // Try Upstash first
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      const kvRes = await fetch(
        `${UPSTASH_URL}/get/profile:${id}`,
        { headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` } }
      );
      const body = await kvRes.text();
      const json = JSON.parse(body);
      if (json.result) {
        payload = JSON.parse(decodeURIComponent(json.result));
      }
    } catch (err) {
      console.error('Upstash get error:', err.message);
    }
  }

  // Fallback: in-memory
  if (!payload) {
    payload = global._profiles?.[id] || null;
  }

  if (!payload) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  // payload shape: { id, profile: {...profileData}, metadata: {...}, createdAt }
  // profile.html reads: data.profile.profileName, data.profile.meta
  // So flatten: spread profile fields and attach metadata as .meta
  const out = {
    ...payload.profile,
    meta: payload.metadata
  };

  return res.status(200).json({ profile: out });
}
