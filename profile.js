import { kv } from '@vercel/kv';

function generateId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'No profile ID' });
    try {
      const profile = await kv.get(`profile:${id}`);
      if (!profile) return res.status(404).json({ error: 'Profile not found' });
      return res.status(200).json({ profile });
    } catch (err) {
      return res.status(500).json({ error: 'Could not retrieve profile' });
    }
  }

  if (req.method === 'POST') {
    const { profile, meta } = req.body;
    if (!profile) return res.status(400).json({ error: 'No profile data' });

    const safeProfile = {
      profileName: profile.profileName || '',
      thinkerType: profile.thinkerType || '',
      summary: profile.summary || '',
      signals: profile.signals || [],
      traits: profile.traits || [],
      careerFits: profile.careerFits || [],
      employerQuote: profile.employerQuote || '',
      hiddenInsight: profile.hiddenInsight || '',
      meta: {
        totalConversations: meta?.totalConversations || 0,
        userMessages: meta?.userMessages || 0,
        spanMonths: meta?.spanMonths || 0,
        integrityScore: meta?.integrityScore || 0,
        peakHours: meta?.peakHours || '',
        nightPct: meta?.nightPct || 0,
        monthChart: meta?.monthChart || [],
        hourCount: meta?.hourCount || {},
        firstDate: meta?.firstDate || null,
        lastDate: meta?.lastDate || null,
      },
      savedAt: new Date().toISOString()
    };

    try {
      const id = generateId();
      await kv.set(`profile:${id}`, safeProfile, { ex: 365 * 24 * 60 * 60 });
      return res.status(200).json({ id, url: `/profile/${id}` });
    } catch (err) {
      return res.status(500).json({ error: 'Could not save profile' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
