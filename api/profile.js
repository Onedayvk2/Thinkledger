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

  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      const kvRes = await fetch(`${UPSTASH_URL}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${UPSTASH_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(['GET', `profile:${id}`])
      });
      const result = await kvRes.json();
      if (result.result) {
        // payload = { id, profile: {...}, metadata: {...} }
        // profile.html expects: data.profile.profileName, data.profile.meta
        // So we return the inner profile object, with meta attached from metadata
        const payload = JSON.parse(result.result);
        const out = {
          ...payload.profile,
          meta: payload.metadata
        };
        return res.status(200).json({ profile: out });
      }
    } catch (err) {
      console.error('Upstash get error:', err.message);
    }
  }

  // Fallback: in-memory
  const mem = global._profiles?.[id];
  if (mem) {
    const out = { ...mem.profile, meta: mem.metadata };
    return res.status(200).json({ profile: out });
  }

  return res.status(404).json({ error: 'Profile not found' });
}
