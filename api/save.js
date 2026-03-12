export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { profile, metadata } = req.body;
  if (!profile || !metadata) return res.status(400).json({ error: 'Missing data' });

  const id = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);

  const payload = {
    id,
    profile,
    metadata: {
      totalConversations: metadata.totalConversations,
      userMessages: metadata.userMessages,
      spanMonths: metadata.spanMonths,
      integrityScore: metadata.integrityScore,
      avgWordsPerMessage: metadata.avgWordsPerMessage,
      peakHours: metadata.peakHours,
      firstDate: metadata.firstDate,
      lastDate: metadata.lastDate,
      monthChart: metadata.monthChart,
      nightPct: metadata.nightPct,
      hourCount: metadata.hourCount,
      pushbackRatio: metadata.pushbackRatio,
      questionRatio: metadata.questionRatio,
    },
    createdAt: new Date().toISOString()
  };

  const UPSTASH_URL   = process.env.UPSTASH_REDIS_REST_URL;
  const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      const value = encodeURIComponent(JSON.stringify(payload));
      const ttl   = 60 * 60 * 24 * 365; // 1 year
      const kvRes = await fetch(
        `${UPSTASH_URL}/set/profile:${id}/${value}/ex/${ttl}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
        }
      );
      const body = await kvRes.text();
      if (!kvRes.ok) throw new Error('Upstash error: ' + body);
    } catch (err) {
      console.error('Upstash save error:', err.message);
      // Fall through to in-memory fallback
    }
  }

  // Always keep in-memory copy as fallback
  global._profiles = global._profiles || {};
  global._profiles[id] = payload;

  return res.status(200).json({ id, url: `/profile/${id}` });
}
