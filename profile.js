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
    return res.status(500).json({ error: 'Storage not configured.' });
  }

  try {
    const upstashRes = await fetch(`${UPSTASH_URL}/get/profile:${id}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
    });

    if (!upstashRes.ok) throw new Error(await upstashRes.text());

    const data = await upstashRes.json();
    if (!data.result) return res.status(404).json({ error: 'Profile not found' });

    const profile = JSON.parse(data.result);
    return res.status(200).json({ profile });
  } catch (err) {
    return res.status(500).json({ error: 'Could not retrieve profile: ' + err.message });
  }
}
