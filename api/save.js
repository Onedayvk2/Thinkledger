export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { profile, metadata } = req.body;
  if (!profile || !metadata) return res.status(400).json({ error: 'Missing data' });

  // Generate a short unique ID
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
    createdAt: new Date().toISOString(),
    views: 0
  };

  try {
    // Use Vercel KV if available, otherwise use in-memory store
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const kvRes = await fetch(`${process.env.KV_REST_API_URL}/set/profile:${id}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ value: JSON.stringify(payload), ex: 60 * 60 * 24 * 365 }) // 1 year TTL
      });
      if (!kvRes.ok) throw new Error('KV save failed');
    } else {
      // Fallback: store in a simple global (works for demo, resets on cold start)
      global._profiles = global._profiles || {};
      global._profiles[id] = payload;
    }

    return res.status(200).json({ id, url: `/profile/${id}` });
  } catch (err) {
    // Still return the ID even if storage fails — profile was generated
    global._profiles = global._profiles || {};
    global._profiles[id] = payload;
    return res.status(200).json({ id, url: `/profile/${id}`, warning: 'Saved in memory only' });
  }
}
