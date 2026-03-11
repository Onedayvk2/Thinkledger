export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { profile, metadata } = req.body;
  if (!profile || !metadata) return res.status(400).json({ error: 'Missing data' });

  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 10; i++) id += chars[Math.floor(Math.random() * chars.length)];

  const payload = {
    id,
    profileName:      profile.profileName      || '',
    thinkerType:      profile.thinkerType      || '',
    summary:          profile.summary          || '',
    signals:          profile.signals          || [],
    traits:           profile.traits           || [],
    careerFits:       profile.careerFits       || [],
    employerQuote:    profile.employerQuote    || '',
    hiddenInsight:    profile.hiddenInsight    || '',
    cultureNarrative: profile.cultureNarrative || '',
    meta: {
      totalConversations: metadata.totalConversations || 0,
      userMessages:       metadata.userMessages       || 0,
      spanMonths:         metadata.spanMonths         || 0,
      integrityScore:     metadata.integrityScore     || 0,
      avgWordsPerMessage: metadata.avgWordsPerMessage || 0,
      peakHours:          metadata.peakHours          || '',
      nightPct:           metadata.nightPct           || 0,
      pushbackRatio:      metadata.pushbackRatio      || 0,
      questionRatio:      metadata.questionRatio      || 0,
      firstDate:          metadata.firstDate          || null,
      lastDate:           metadata.lastDate           || null,
      monthChart:         metadata.monthChart         || [],
      hourCount:          metadata.hourCount          || {}
    },
    savedAt: new Date().toISOString()
  };

  const UPSTASH_URL   = process.env.UPSTASH_REDIS_REST_URL;
  const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    return res.status(500).json({ error: 'Storage not configured. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to Vercel environment variables.' });
  }

  try {
    const upstashRes = await fetch(`${UPSTASH_URL}/set/profile:${id}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([JSON.stringify(payload), 'EX', 31536000])
    });

    if (!upstashRes.ok) throw new Error(await upstashRes.text());
    return res.status(200).json({ id, url: `/profile/${id}` });
  } catch (err) {
    return res.status(500).json({ error: 'Could not save profile: ' + err.message });
  }
}
