export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API not configured' });

  const { metadata } = req.body;
  if (!metadata) return res.status(400).json({ error: 'No metadata provided' });

  const prompt = `You are generating a ThinkLedger cognitive profile. Based ONLY on these anonymised thinking metrics (no conversation content), generate a professional cognitive profile.

Metrics:
- Total conversations: ${metadata.totalConversations}
- User messages: ${metadata.userMessages}
- Average words per message: ${metadata.avgWordsPerMessage}
- Question frequency: ${metadata.questionRatio}% of messages contain questions
- Pushback rate: ${metadata.pushbackRatio}% (challenges AI responses)
- Deep dive rate: ${metadata.deepDiveRatio}%
- Vocabulary richness: ${metadata.vocabRichness}/100
- Depth score: ${metadata.depthScore}/100
- Long messages (100+ words): ${metadata.longMessagePct}%
- Peak thinking hours: ${metadata.peakHours}
- Profile span: ${metadata.spanMonths} months
- Integrity score: ${metadata.integrityScore}/100

Return ONLY valid JSON, no markdown, no preamble:
{
  "profileName": "2-3 word title that captures their thinking style precisely",
  "thinkerType": "2-3 word archetype",
  "summary": "4 sentences. Specific to THESE signals. First person narrative about how this person thinks. No generic praise. Reference the actual numbers.",
  "signals": [
    {"name": "Critical Independence", "score": 0-100, "label": "brief specific observation"},
    {"name": "Depth of Engagement", "score": 0-100, "label": "brief specific observation"},
    {"name": "Intellectual Assertion", "score": 0-100, "label": "brief specific observation"},
    {"name": "Human Intelligence", "score": 0-100, "label": "brief specific observation"},
    {"name": "Cross-Domain Fluency", "score": 0-100, "label": "brief specific observation"},
    {"name": "Cognitive Stamina", "score": 0-100, "label": "brief specific observation"}
  ],
  "traits": ["8 specific traits derived from the data, not generic"],
  "careerFits": [
    {"title": "Role Title", "why": "2-3 sentences grounded in the signals only, no biographical assumptions", "score": 0-100, "tags": ["signal match 1", "signal match 2"]},
    {"title": "Role Title", "why": "2-3 sentences", "score": 0-100, "tags": ["tag1", "tag2"]},
    {"title": "Role Title", "why": "2-3 sentences", "score": 0-100, "tags": ["tag1", "tag2"]}
  ],
  "employerQuote": "One sentence. Specific to these signals. Makes an employer feel they understand something real.",
  "hiddenInsight": "One honest observation — something surprising or counterintuitive the data reveals."
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    const text = data.content?.map(c => c.text || '').join('') || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const profile = JSON.parse(clean);

    return res.status(200).json({ profile });
  } catch (err) {
    return res.status(500).json({ error: 'Profile generation failed', detail: err.message });
  }
}
