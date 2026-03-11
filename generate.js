export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API not configured' });

  const { metadata, dimScores } = req.body;
  if (!metadata) return res.status(400).json({ error: 'No metadata provided' });

  const m = metadata;

  // ── SIGNAL FLAGS ──
  const isNightOwl       = m.nightPct > 30;
  const isHighVolume     = m.userMessages > 500;
  const isVeryHighVolume = m.userMessages > 1200;
  const isLowVolume      = m.userMessages < 100;
  const isHighPushback   = m.pushbackRatio > 28;
  const isMedPushback    = m.pushbackRatio >= 12 && m.pushbackRatio <= 28;
  const isLowPushback    = m.pushbackRatio < 12;
  const isDeep           = m.depthScore > 65 || m.avgWordsPerMessage > 55;
  const isVeryDeep       = m.avgWordsPerMessage > 90;
  const isHighQuestions  = m.questionRatio > 18;
  const isMedQuestions   = m.questionRatio >= 8 && m.questionRatio <= 18;
  const isLowQuestions   = m.questionRatio < 8;
  const isLongSpan       = m.spanMonths > 8;
  const isVeryLongSpan   = m.spanMonths > 14;
  const isShortMessages  = m.avgWordsPerMessage < 30;
  const isVeryShort      = m.avgWordsPerMessage < 18;
  const isLongMessages   = m.longMessagePct > 25;
  const isHighDeepDive   = m.deepDiveRatio > 20;
  const isHighVocab      = m.vocabRichness > 70;
  const platformCount    = m.platformCount || 1;
  const isMultiPlatform  = platformCount > 1;

  // ── 16 ARCHETYPES WITH SCORING ──
  const archetypes = [
    {
      name: 'The Debugger',
      group: 'Builder',
      description: 'Coder and iterative builder. Thinks by doing — short precise messages, high volume, repetitive loops on the same problem until it breaks correctly.',
      signalNames: ['Iteration Velocity', 'Precision Density', 'Problem Persistence', 'Task Clarity', 'Build Rhythm', 'Execution Focus'],
      careerDomain: 'engineering, technical roles, product development',
      score: (isVeryShort ? 4 : isShortMessages ? 2 : 0) + (isHighVolume ? 3 : 0) + (isLowPushback ? 1 : 0) + (isLowQuestions ? 2 : 0) + (!isNightOwl ? 1 : 0)
    },
    {
      name: 'The Architect',
      group: 'Builder',
      description: 'Senior builder and systems thinker. Designs before touching. Thinks in structures and abstractions. Long deliberate messages, low question ratio — they know what they need.',
      signalNames: ['Systems Thinking', 'Structural Clarity', 'Deliberate Depth', 'Design Precision', 'Abstraction Fluency', 'Build Conviction'],
      careerDomain: 'senior engineering, solution architecture, technical strategy',
      score: (isDeep ? 3 : 0) + (isLongMessages ? 2 : 0) + (isLowPushback ? 2 : 0) + (isLongSpan ? 1 : 0) + (isLowQuestions ? 2 : 0) + (isHighVocab ? 1 : 0)
    },
    {
      name: 'The Craftsman',
      group: 'Builder',
      description: 'Quality over speed. Returns to problems until they are solved correctly, not just solved. Consistent, deliberate, high standards.',
      signalNames: ['Quality Threshold', 'Iterative Refinement', 'Consistency Index', 'Detail Orientation', 'Standard Setting', 'Completion Drive'],
      careerDomain: 'design, engineering, editorial, product quality',
      score: (isLongMessages ? 2 : 0) + (isLongSpan ? 3 : 0) + (isLowPushback ? 1 : 0) + (!isHighVolume ? 2 : 0) + (isMedQuestions ? 1 : 0)
    },
    {
      name: 'The Operator',
      group: 'Builder',
      description: 'Execution-first. High output, low friction. Uses AI as a tool not a thought partner. Gets things done while others are still discussing.',
      signalNames: ['Execution Velocity', 'Task Throughput', 'Friction Tolerance', 'Output Consistency', 'Decision Speed', 'Action Bias'],
      careerDomain: 'operations, project management, growth, logistics',
      score: (isHighVolume ? 3 : 0) + (isShortMessages ? 3 : 0) + (isLowPushback ? 1 : 0) + (isLowQuestions ? 2 : 0) + (!isNightOwl ? 1 : 0)
    },
    {
      name: 'The Strategist',
      group: 'Thinker',
      description: 'Thinks before acting. Long sessions, late nights, high depth. Slow burn with high-quality output when they finally move.',
      signalNames: ['Strategic Depth', 'Long-Range Thinking', 'Deliberation Index', 'Night Cognition', 'Pattern Recognition', 'Output Quality'],
      careerDomain: 'strategy, consulting, business development, advisory',
      score: (isNightOwl ? 4 : 0) + (isDeep ? 2 : 0) + (isLowPushback ? 1 : 0) + (isLongSpan ? 2 : 0) + (!isHighVolume ? 1 : 0)
    },
    {
      name: 'The Analyst',
      group: 'Thinker',
      description: 'Evidence-first. Does not commit until certain. Methodical, structured, precise. Low pushback because they wait until they are sure before they speak.',
      signalNames: ['Evidence Threshold', 'Methodical Precision', 'Structural Logic', 'Certainty Standard', 'Data Fluency', 'Measured Output'],
      careerDomain: 'data, research, finance, policy, intelligence',
      score: (isDeep ? 2 : 0) + (isLowPushback ? 3 : 0) + (isLowQuestions ? 2 : 0) + (isLongMessages ? 1 : 0) + (!isNightOwl ? 1 : 0) + (isLongSpan ? 1 : 0)
    },
    {
      name: 'The Philosopher',
      group: 'Thinker',
      description: 'Thinks for the sake of thinking. Every conversation goes deep. Low volume, high density. Rare. The question is the destination, not an obstacle.',
      signalNames: ['Conceptual Depth', 'Idea Density', 'Abstract Fluency', 'Reflective Capacity', 'Intellectual Patience', 'Insight Generation'],
      careerDomain: 'research, writing, ethics, education, thought leadership',
      score: (isVeryDeep ? 4 : isLongMessages ? 2 : 0) + (isDeep ? 2 : 0) + (isNightOwl ? 2 : 0) + (!isHighVolume ? 2 : 0) + (isHighDeepDive ? 2 : 0) + (isHighVocab ? 1 : 0)
    },
    {
      name: 'The Synthesiser',
      group: 'Thinker',
      description: 'Connects dots others miss. Cross-domain fluency. Comfortable in complexity and ambiguity. The person who reads three books at once and somehow integrates them.',
      signalNames: ['Cross-Domain Fluency', 'Pattern Integration', 'Conceptual Range', 'Ambiguity Tolerance', 'Connection Density', 'Synthesis Speed'],
      careerDomain: 'innovation, strategy, product, editorial, research',
      score: (isHighDeepDive ? 3 : 0) + (isDeep ? 1 : 0) + (isLongSpan ? 2 : 0) + (isMultiPlatform ? 3 : 0) + (isHighVocab ? 1 : 0) + (isMedPushback ? 1 : 0)
    },
    {
      name: 'The Challenger',
      group: 'Explorer',
      description: 'Does not accept the first answer. Pushes until something breaks or holds. Makes every room sharper. High pushback is not aggression — it is intellectual standards.',
      signalNames: ['Challenge Threshold', 'Argument Precision', 'Intellectual Rigour', 'Position Clarity', 'Debate Stamina', 'Critical Independence'],
      careerDomain: 'consulting, law, editorial, product strategy, research',
      score: (isHighPushback ? 5 : 0) + (isDeep ? 2 : 0) + (isHighQuestions ? 1 : 0) + (isHighVocab ? 1 : 0)
    },
    {
      name: 'The Explorer',
      group: 'Explorer',
      description: 'Curiosity-driven. Wide not deep. Questions are the product. Ideas arrive faster than conclusions and that is a feature, not a bug.',
      signalNames: ['Curiosity Velocity', 'Question Quality', 'Domain Range', 'Idea Generation', 'Exploration Stamina', 'Discovery Orientation'],
      careerDomain: 'product, innovation, journalism, venture, creative strategy',
      score: (isHighQuestions ? 4 : 0) + (!isDeep ? 1 : 0) + (!isLowVolume ? 1 : 0) + (!isNightOwl ? 1 : 0) + (isMedPushback ? 1 : 0)
    },
    {
      name: 'The Maverick',
      group: 'Explorer',
      description: 'Contrarian by nature. High pushback, irregular patterns. Resists the consensus frame. Right more often than people expect and wrong more memorably when they are not.',
      signalNames: ['Contrarian Confidence', 'Pattern Disruption', 'Independent Reasoning', 'Unconventional Range', 'Position Conviction', 'Frame Breaking'],
      careerDomain: 'founding, venture, editorial, policy disruption, turnaround leadership',
      score: (isHighPushback ? 3 : 0) + (isNightOwl ? 2 : 0) + (!isHighVolume ? 1 : 0) + (isHighVocab ? 1 : 0) + (!isLongSpan ? 1 : 0)
    },
    {
      name: 'The Catalyst',
      group: 'Explorer',
      description: 'Starts things. Energises rooms. Moves fast, hands off. High question rate, short decisive bursts. The person who makes everyone else move faster.',
      signalNames: ['Activation Energy', 'Question Velocity', 'Momentum Generation', 'Decision Speed', 'Energy Transmission', 'Initiation Drive'],
      careerDomain: 'business development, partnerships, founding, community, growth',
      score: (isHighQuestions ? 3 : 0) + (isShortMessages ? 2 : 0) + (!isNightOwl ? 1 : 0) + (!isLongMessages ? 1 : 0) + (isHighVolume ? 1 : 0)
    },
    {
      name: 'The Absorber',
      group: 'Connector',
      description: 'Takes information in fully before forming a position. Low pushback is not passivity — it is processing. Their real pushback happens in rooms, with people, at the right moment.',
      signalNames: ['Absorption Depth', 'Processing Patience', 'Contextual Awareness', 'Listening Intelligence', 'Deliberate Response', 'Information Integration'],
      careerDomain: 'advisory, diplomacy, coaching, senior management, editorial',
      score: (isLowPushback ? 4 : 0) + (isDeep ? 2 : 0) + (!isShortMessages ? 1 : 0) + (isLongSpan ? 1 : 0) + (isMedQuestions ? 1 : 0)
    },
    {
      name: 'The Precise Asker',
      group: 'Connector',
      description: 'Solves problems through better questions, not debate. Low pushback because precision makes debate unnecessary. Every question is deliberate. The answer either works or they ask a sharper one.',
      signalNames: ['Question Precision', 'Problem Framing', 'Clarity Drive', 'Solution Orientation', 'Iterative Refinement', 'Specification Depth'],
      careerDomain: 'product management, UX research, consulting, law, technical writing',
      score: (isHighQuestions ? 3 : 0) + (isLowPushback ? 3 : 0) + (isShortMessages ? 1 : 0) + (!isLowVolume ? 1 : 0)
    },
    {
      name: 'The Mentor',
      group: 'Connector',
      description: 'Uses AI to develop thinking they will share with others. Explains rather than argues. Long, structured messages. Thinks about how ideas land, not just whether they are true.',
      signalNames: ['Explanatory Depth', 'Structural Clarity', 'Knowledge Transfer', 'Audience Awareness', 'Generous Thinking', 'Framework Building'],
      careerDomain: 'education, leadership, coaching, content, management consulting',
      score: (isDeep ? 2 : 0) + (isLowPushback ? 2 : 0) + (isLongMessages ? 3 : 0) + (!isNightOwl ? 1 : 0) + (isLongSpan ? 1 : 0) + (isMedQuestions ? 1 : 0)
    },
    {
      name: 'The Visionary',
      group: 'Connector',
      description: 'Sees things before they are obvious. Does not need validation from the room. Long-game thinking. Night owl. Vocabulary-rich. Comfortable being early and alone.',
      signalNames: ['Anticipatory Thinking', 'Long-Horizon Vision', 'Independent Conviction', 'Conceptual Originality', 'Night Cognition', 'Pattern Foresight'],
      careerDomain: 'founding, venture, creative direction, research, cultural strategy',
      score: (isNightOwl ? 3 : 0) + (isDeep ? 2 : 0) + (isLowPushback ? 1 : 0) + (isHighDeepDive ? 2 : 0) + (!isHighVolume ? 1 : 0) + (isHighVocab ? 2 : 0) + (isVeryLongSpan ? 1 : 0)
    },
    {
      name: 'The Persuader',
      group: 'Builder',
      description: 'Uses AI to sharpen arguments they will deploy on people, not on AI. High pushback is rehearsal, not debate. Short decisive messages, high volume, daytime. They are not arguing with the AI — they are pressure-testing ideas before the room.',
      signalNames: ['Argument Precision', 'Position Stress-Testing', 'Rhetorical Clarity', 'Conviction Velocity', 'Objection Mapping', 'Persuasion Architecture'],
      careerDomain: 'sales, negotiation, law, advocacy, fundraising, policy',
      score: (isHighPushback ? 3 : 0) + (isHighVolume ? 2 : 0) + (isShortMessages ? 2 : 0) + (!isNightOwl ? 2 : 0) + (isLowQuestions ? 1 : 0)
    },
    {
      name: 'The Expert',
      group: 'Thinker',
      description: 'Deep domain authority. Does not ask questions — directs. Treats AI as a capable junior, not a teacher. Long precise messages that assume shared context. Low question ratio is not incuriosity — it is confidence. They already know the landscape; they need execution.',
      signalNames: ['Domain Authority', 'Directive Precision', 'Knowledge Density', 'Context Economy', 'Instructional Clarity', 'Expertise Depth'],
      careerDomain: 'senior technical roles, specialist consulting, research leadership, clinical, legal',
      score: (isLowQuestions ? 4 : 0) + (isLongMessages ? 2 : 0) + (isLowPushback ? 2 : 0) + (isLongSpan ? 2 : 0) + (isHighVocab ? 2 : 0) + (!isNightOwl ? 1 : 0)
    },
    {
      name: 'The Translator',
      group: 'Connector',
      description: 'Converts complex thinking for different audiences. High vocabulary, high deep-dive rate, multi-platform. Not just synthesising — rendering. Makes hard things legible without making them simple. The person everyone sends the draft to before it goes out.',
      signalNames: ['Conceptual Translation', 'Audience Modelling', 'Complexity Reduction', 'Vocabulary Range', 'Register Fluency', 'Clarity Architecture'],
      careerDomain: 'editorial, communications, science writing, product marketing, policy translation, executive comms',
      score: (isHighVocab ? 3 : 0) + (isHighDeepDive ? 2 : 0) + (isMultiPlatform ? 2 : 0) + (isDeep ? 1 : 0) + (!isShortMessages ? 1 : 0) + (isMedPushback ? 1 : 0)
    }
  ];

  archetypes.sort((a, b) => b.score - a.score);
  const primary = archetypes[0];
  const secondary = archetypes[1];
  const tertiary = archetypes[2];

  // ── PUSHBACK INTERPRETATION ──
  const pushbackContext = isLowPushback
    ? `LOW pushback (${m.pushbackRatio}%) — IMPORTANT: Do NOT frame this negatively. This person processes before debating. They are likely an ${primary.name} type who reserves real challenges for real rooms. Their agreement with AI is not compliance — it is efficiency. They already know what they think.`
    : isHighPushback
    ? `HIGH pushback (${m.pushbackRatio}%) — This person uses AI as a sparring partner. They test ideas by challenging them. Disagreement is their quality filter.`
    : `MODERATE pushback (${m.pushbackRatio}%) — Selective challenger. Pushes back when it genuinely matters, not as a reflex.`;

  const prompt = `You are generating a ThinkLedger cognitive profile. This is a precise cognitive fingerprint — like a blood test for how someone thinks, derived entirely from the structure of their AI conversations, not the content.

CRITICAL RULES — violate any of these and the profile fails:
1. MATCH VOCABULARY TO ARCHETYPE — each archetype has its own precise vocabulary drawn from cognitive psychology research. Use 3-4 terms from the assigned archetype's pool, woven naturally into prose — never listed. Banned universally: "collaborative", "dynamic", "innovative", "problem solver", "self-starter", "synergy", "team player", "results-driven", "passionate about", "dedicated to"

ARCHETYPE VOCABULARY (psychology-grounded — use these, not generic words):
The Debugger: serialist cognition · micro-closure seeking · procedural fluency · error-signal sensitivity · tight feedback loops · task-state awareness
The Architect: holistic cognition · schema-first processing · structural empathy · pre-mortem orientation · load-bearing thinking · second-order consideration · cognitive scaffolding
The Challenger: epistemic vigilance · argumentative reasoning · belief revision threshold · adversarial collaboration · steelmanning instinct · modus tollens cognition · position-staking
The Absorber: integrative complexity · suspended judgment · low epistemic impatience · conclusion latency · non-reactive updating · cognitive hospitality · internal deliberation
The Strategist: temporal depth perception · chronobiological alignment · anticipatory schema building · low action urgency · strategic patience · information stacking · consequence mapping
The Explorer: diversive curiosity · epistemic appetite · associative breadth · question generativity · trail-following cognition · tolerance for open loops · wonder retention
The Synthesiser: structural mapping · boundary-spanning cognition · analogical transfer · relational reasoning · semantic bridging · cross-domain priming · connective intelligence
The Visionary: defocused attention · remote associative thinking · high-level construal · low validation seeking · pre-consensus detection · temporal abstraction · signal-to-noise sensitivity · originality preference
The Philosopher: reflective equilibrium · depth-first cognition · conceptual perfectionism · ontological curiosity · recursive self-examination · epistemic rigour · thought experiment affinity · categorical precision
The Maverick: need for cognitive uniqueness · contrarian updating · social proof immunity · asymmetric evidence weighting · heretical hypothesis preference · pattern disruption instinct · unconventional solution bias
The Operator: action orientation · pragmatic epistemology · implementation intention dominance · friction sensitivity · low abstraction patience · execution confidence · cognitive economy · workflow cognition
The Mentor: generative concern · pedagogical orientation · scaffolded explanation · cognitive generosity · Socratic patience · conceptual translation · guided discovery preference
The Precise Asker: metacognitive precision · question calibration · epistemic humility as strategy · Socratic inquiry · gap identification · reductive questioning · knowledge triangulation
The Catalyst: ideation fluency · approach motivation dominance · low perseveration · social activation · momentum cognition · possibility orientation · infectious framing
The Analyst: evidence accumulation threshold · system 2 dominance · prevention focus · false positive sensitivity · analytical patience · deductive preference · confidence calibration
The Craftsman: mastery orientation · quality threshold sensitivity · intrinsic motivation dominance · flow accessibility · iterative refinement · craft identity · standard internalisation · long feedback loop tolerance
2. Every sentence must be grounded in the specific numbers. If you can't point to a metric that supports it, cut it.
3. Each profile must feel written for THIS person alone. Different numbers = different story. Same archetype ≠ same profile.
4. Low pushback (under 12%) is NEVER framed negatively. It signals efficiency, processing depth, or precision — not passivity.
5. Write like a sharp journalist profiling someone for a magazine. Precise. Specific. One surprising observation per section.
6. Signal names must match the archetype — a Debugger gets "Iteration Velocity", an Absorber gets "Processing Patience". Never cross-contaminate.
7. Zero LinkedIn language. If a sentence could appear in a cover letter, rewrite it completely.
8. The summary must have a tension — something unexpected or slightly counterintuitive about this combination of signals.
9. Career fits must be specific job titles, not categories. "Head of Technical Partnerships at a Series B startup" not "leadership role".
10. The hidden insight must feel like something the person recognises as true but has never said out loud. Not flattery. Truth.

ASSIGNED ARCHETYPE: ${primary.name} (${primary.group} group)
What this means: ${primary.description}
Career domain: ${primary.careerDomain}

SECONDARY TENDENCY: ${secondary.name}
What this adds: ${secondary.description}

TERTIARY SIGNAL: ${tertiary.name} (weaker but present)

PUSHBACK INTERPRETATION: ${pushbackContext}

CULTURE DIMENSION SCORES (0=left pole, 100=right pole — use these to write cultureNarrative):
- Thinking Mode: ${dimScores?.thinkingMode ?? 50} → ${(dimScores?.thinkingMode??50) < 40 ? 'Solo Processor' : (dimScores?.thinkingMode??50) > 60 ? 'Social Thinker' : 'Balanced'}
- Ambiguity Response: ${dimScores?.ambiguityResponse ?? 50} → ${(dimScores?.ambiguityResponse??50) < 40 ? 'Needs Clarity First' : (dimScores?.ambiguityResponse??50) > 60 ? 'Moves Into Fog' : 'Adaptive'}
- Feedback Orientation: ${dimScores?.feedbackOrientation ?? 50} → ${(dimScores?.feedbackOrientation??50) < 40 ? 'Seeks Confirmation' : (dimScores?.feedbackOrientation??50) > 60 ? 'Seeks Friction' : 'Selective challenger'}
- Time Horizon: ${dimScores?.timeHorizon ?? 50} → ${(dimScores?.timeHorizon??50) < 40 ? 'Present-Focused' : (dimScores?.timeHorizon??50) > 60 ? 'Long-Game Thinker' : 'Balanced horizon'}
- Knowledge Mode: ${dimScores?.knowledgeMode ?? 50} → ${(dimScores?.knowledgeMode??50) < 40 ? 'Breadth Collector' : (dimScores?.knowledgeMode??50) > 60 ? 'Depth Miner' : 'Range with depth'}
- Pressure Response: ${dimScores?.pressureResponse ?? 50} → ${(dimScores?.pressureResponse??50) < 40 ? 'Needs Space to Think' : (dimScores?.pressureResponse??50) > 60 ? 'Sharpens Under Pressure' : 'Situational'}
- Communication Register: ${dimScores?.communicationRegister ?? 50} → ${(dimScores?.communicationRegister??50) < 40 ? 'Shows the Working' : (dimScores?.communicationRegister??50) > 60 ? 'Delivers the Answer' : 'Context-aware'}


DEEP PSYCHOLOGICAL VOCABULARY — drawn from cognitive psychology, neuroscience, and behavioural science.
Use 3-4 terms from the ASSIGNED ARCHETYPE's list naturally in the profile.
Never define them explicitly — let the meaning carry through context.
Never use terms from a different archetype's list.

THE DEBUGGER: enactive cognition · procedural intelligence · kinesthetic reasoning · tight feedback loops · error-tolerance · residual problem state · iteration as hypothesis · build to think
THE ARCHITECT: mental model fidelity · structural intuition · hierarchical compression · latency tolerance · schematic thinking · anticipatory cognition · system coherence drive · abstraction ceiling
THE CHALLENGER: epistemic vigilance · argumentative reasoning · belief revision threshold · dissonance tolerance · steelmanning instinct · intellectual friction · position crystallisation · commitment consistency
THE ABSORBER: somatic integration · incubation dependency · default mode dominance · threshold cognition · deliberate latency · belief sedimentation · pre-commitment processing · quiet confidence architecture
THE STRATEGIST: prospective cognition · mental time travel · temporal discounting resistance · scenario fluency · anticipatory regret avoidance · strategic patience · consequence chaining · pre-mortem thinking
THE ANALYST: need for cognition · elaboration drive · evidence weighting · premature closure resistance · Bayesian updating · epistemic humility as practice · signal-to-noise discrimination · cognitive completionism
THE PHILOSOPHER: existential intelligence · idea aesthetics · apophenia sensitivity · conceptual appetite · abstraction affinity · philosophical temperament · wonder retention · conceptual restlessness
THE SYNTHESISER: remote associative capacity · conceptual bridge-building · schema flexibility · analogical transfer · semantic distance tolerance · integrative complexity · cross-domain pattern matching · conceptual arbitrage
THE EXPLORER: neophilia · epistemic curiosity · diversive exploration · tolerance for ambiguity · question generation rate · intellectual stretch · novelty sensitivity · wonder metabolism
THE MAVERICK: psychological reactance · contrarian cognition · orthodoxy sensitivity · defiance heuristic · nonconformity premium · intellectual independence · provocation tolerance · asymmetric conviction
THE CATALYST: broaden-and-build · social cognition amplifier · ideational fluency · affective priming · activation energy reduction · contagious momentum · divergent velocity · initiation asymmetry
THE PRECISE ASKER: interrogative thinking · question precision · metacognitive awareness · constraint identification · reframe instinct · minimum viable inquiry · epistemic economy · query architecture
THE MENTOR: generativity · protégé effect · explanatory depth · pedagogical patience · conceptual scaffolding · transfer facilitation · knowledge generosity · explanatory empathy
THE OPERATOR: implementation intentions · action identification level · throughput orientation · cognitive pragmatism · decisional efficiency · output anchoring · friction intolerance · execution intelligence
THE VISIONARY: transient hypofrontality · Type T cognition · temporal asymmetry · signal detection advantage · pre-consensus thinking · conviction without validation · predictive cognition · intellectual courage
THE CRAFTSMAN: mastery orientation · deliberate practice · quality threshold · craft consciousness · revision instinct · standard-setting · output pride · refinement drive
THE PERSUADER: epistemic combat readiness · argument stress-testing · rhetorical preloading · objection anticipation · position hardening · persuasion architecture · conviction rehearsal · adversarial preparation
THE EXPERT: domain schema depth · instructional cognition · knowledge chunking · context compression · directed inquiry · authority calibration · precision direction · expertise economy
THE TRANSLATOR: register fluency · conceptual bridging · audience modelling · complexity reduction · semantic layering · clarity orientation · rendering intelligence · linguistic empathy

RAW METRICS — use ALL of these, not just the obvious ones:
- Total conversations: ${m.totalConversations}
- User messages: ${m.userMessages} (${isVeryHighVolume ? 'exceptionally high — power user' : isHighVolume ? 'high volume user' : isLowVolume ? 'low volume — quality over quantity' : 'moderate'})
- Avg message length: ${m.avgWordsPerMessage} words (${isVeryShort ? 'very short — coder/executor pattern' : isShortMessages ? 'short — task-focused' : isVeryDeep ? 'very long — rare depth' : isDeep ? 'long — deep thinker' : 'medium'})
- Long messages (100+ words): ${m.longMessagePct}% (${m.longMessagePct > 40 ? 'extremely high — thinks in paragraphs' : m.longMessagePct > 20 ? 'high — extended reasoning' : m.longMessagePct < 5 ? 'very low — terse and precise' : 'moderate'})
- Question frequency: ${m.questionRatio}% (${isHighQuestions ? 'high — curiosity-led' : isLowQuestions ? 'low — directive, already knows what they want' : 'selective'})
- Deep dive requests: ${m.deepDiveRatio}% (${m.deepDiveRatio > 25 ? 'high — never satisfied with surface answers' : m.deepDiveRatio < 8 ? 'low — extracts what is needed and moves on' : 'moderate'})
- Vocabulary richness: ${m.vocabRichness}/100 (${m.vocabRichness > 75 ? 'high — wide conceptual range' : m.vocabRichness < 40 ? 'low — functional, domain-specific language' : 'moderate'})
- Depth score: ${m.depthScore}/100
- Peak hours: ${m.peakHours} (${isNightOwl ? 'night owl — ideas arrive when distractions disappear' : 'daytime — structured, disciplined, consistent'})
- Night activity: ${m.nightPct}% of messages 10pm–2am (${m.nightPct > 50 ? 'extreme night thinker' : m.nightPct < 10 ? 'almost entirely daytime — disciplined schedule' : 'mixed'})
- Data span: ${m.spanMonths} months (${m.spanMonths > 18 ? 'very long — deeply embedded habit' : m.spanMonths < 4 ? 'short span — recent adopter' : 'established'})
- Conversations per month avg: ${Math.round(m.totalConversations / Math.max(m.spanMonths, 1))} (usage intensity)
- Messages per conversation avg: ${Math.round(m.userMessages / Math.max(m.totalConversations, 1))} (session depth — ${Math.round(m.userMessages / Math.max(m.totalConversations, 1)) > 15 ? 'long sessions, goes deep' : Math.round(m.userMessages / Math.max(m.totalConversations, 1)) < 5 ? 'short sessions, task-focused' : 'moderate sessions'})
- Platforms: ${platformCount}${isMultiPlatform ? ' — multi-platform user, patterns cross-verified across sources' : ' — single platform'}
- Integrity score: ${m.integrityScore}/100

  // ── INDEPENDENT CAREER SCORING ──
  // 60 roles across 8 domains, scored directly from metadata signals
  // Completely decoupled from archetype — same signals, different output layer

  const ROLE_LIBRARY = [

    // ── TECHNICAL & ENGINEERING ──
    { title: 'Inference Infrastructure Engineer', domain: 'technical',
      score: (isVeryShort?4:isShortMessages?2:0)+(isHighVolume?3:0)+(isLowPushback?2:0)+(isLowQuestions?2:0)+(!isNightOwl?1:0) },
    { title: 'Staff Engineer (Systems)', domain: 'technical',
      score: (isDeep?3:0)+(isLongMessages?2:0)+(isLowQuestions?3:0)+(isLowPushback?1:0)+(isHighVocab?1:0)+(isLongSpan?1:0) },
    { title: 'Technical Founder (0-to-1)', domain: 'technical',
      score: (isNightOwl?3:0)+(isHighVolume?2:0)+(isDeep?2:0)+(isLongSpan?2:0)+(isHighVocab?1:0)+(isHighPushback?1:0) },
    { title: 'Head of Inference & ML Platform', domain: 'technical',
      score: (isDeep?3:0)+(isLowQuestions?2:0)+(isHighVocab?2:0)+(isLongSpan?2:0)+(isNightOwl?1:0) },
    { title: 'Principal Security Engineer', domain: 'technical',
      score: (isLowPushback?2:0)+(isDeep?2:0)+(isLowQuestions?3:0)+(isHighVocab?2:0)+(!isNightOwl?1:0) },
    { title: 'Developer Advocate / Technical Evangelist', domain: 'technical',
      score: (isHighQuestions?2:0)+(isShortMessages?2:0)+(isHighVolume?2:0)+(!isNightOwl?2:0)+(isMedPushback?1:0) },
    { title: 'CTO (Series A–B)', domain: 'technical',
      score: (isNightOwl?2:0)+(isDeep?2:0)+(isLongSpan?3:0)+(isHighVocab?2:0)+(isLowPushback?1:0) },
    { title: 'Founding Engineer', domain: 'technical',
      score: (isVeryShort?3:isShortMessages?1:0)+(isHighVolume?3:0)+(isNightOwl?2:0)+(isHighPushback?1:0)+(isLongSpan?1:0) },

    // ── RESEARCH & ANALYSIS ──
    { title: 'Quantitative Research Analyst (HF/AM)', domain: 'research',
      score: (isLowPushback?3:0)+(isDeep?2:0)+(isLowQuestions?3:0)+(!isNightOwl?1:0)+(isLongSpan?1:0)+(isHighVocab?1:0) },
    { title: 'Intelligence Analyst (Government/Defence)', domain: 'research',
      score: (isLowPushback?2:0)+(isDeep?3:0)+(isLowQuestions?2:0)+(isLongSpan?2:0)+(!isNightOwl?1:0) },
    { title: 'UX Research Lead', domain: 'research',
      score: (isHighQuestions?3:0)+(isLowPushback?3:0)+(!isHighVolume?1:0)+(!isLongMessages?1:0)+(isMedPushback?1:0) },
    { title: 'Epidemiologist / Clinical Researcher', domain: 'research',
      score: (isDeep?3:0)+(isLowPushback?2:0)+(isLongMessages?2:0)+(isHighVocab?2:0)+(isLongSpan?2:0) },
    { title: 'Competitive Intelligence Lead', domain: 'research',
      score: (isDeep?2:0)+(isHighQuestions?2:0)+(isHighVocab?2:0)+(isLongSpan?2:0)+(isMedPushback?1:0) },
    { title: 'Director of People Analytics', domain: 'research',
      score: (isLowPushback?2:0)+(isDeep?2:0)+(!isNightOwl?2:0)+(isMedQuestions?2:0)+(isLongSpan?1:0) },
    { title: 'Independent Research Scientist', domain: 'research',
      score: (isNightOwl?2:0)+(isDeep?3:0)+(isHighVocab?2:0)+(isHighDeepDive?2:0)+(!isHighVolume?1:0) },
    { title: 'Head of Market Research', domain: 'research',
      score: (isHighQuestions?2:0)+(isDeep?2:0)+(!isNightOwl?2:0)+(isMedPushback?1:0)+(isLongSpan?1:0) },

    // ── STRATEGY & ADVISORY ──
    { title: 'Management Consultant (McKinsey/BCG tier)', domain: 'strategy',
      score: (isNightOwl?2:0)+(isDeep?3:0)+(isLongSpan?2:0)+(!isHighVolume?1:0)+(isHighVocab?2:0)+(isLowPushback?1:0) },
    { title: 'Chief of Staff (Hypergrowth Company)', domain: 'strategy',
      score: (isLongSpan?3:0)+(isDeep?1:0)+(isLowPushback?2:0)+(isMedPushback?1:0)+(isMedQuestions?2:0)+(!isNightOwl?1:0) },
    { title: 'Corporate Development Director (M&A)', domain: 'strategy',
      score: (isHighPushback?2:0)+(isDeep?2:0)+(isLowQuestions?2:0)+(isLongSpan?2:0)+(isHighVocab?2:0) },
    { title: 'Venture Capital Analyst (Pre-Seed/Seed)', domain: 'strategy',
      score: (isNightOwl?2:0)+(isHighQuestions?2:0)+(isDeep?2:0)+(isHighVocab?2:0)+(isLongSpan?1:0)+(isMedPushback?1:0) },
    { title: 'Strategic Finance Lead', domain: 'strategy',
      score: (isDeep?2:0)+(isLowPushback?3:0)+(isLowQuestions?2:0)+(!isNightOwl?2:0)+(isHighVocab?1:0) },
    { title: 'Think Tank Director / Policy Strategist', domain: 'strategy',
      score: (isNightOwl?2:0)+(isDeep?3:0)+(isHighVocab?3:0)+(isLongSpan?2:0)+(isLowPushback?1:0) },
    { title: 'Chief Strategy Officer', domain: 'strategy',
      score: (isNightOwl?3:0)+(isDeep?2:0)+(isLongSpan?3:0)+(isHighVocab?2:0)+(isLowPushback?1:0) },
    { title: 'Foresight & Scenario Planning Lead', domain: 'strategy',
      score: (isNightOwl?3:0)+(isDeep?2:0)+(isHighVocab?2:0)+(isHighDeepDive?2:0)+(isLongSpan?2:0) },

    // ── COMMERCIAL & SALES ──
    { title: 'Enterprise Account Executive (Complex Sales)', domain: 'commercial',
      score: (isHighPushback?3:0)+(isHighVolume?2:0)+(isShortMessages?2:0)+(!isNightOwl?2:0)+(isLowQuestions?1:0) },
    { title: 'Chief Revenue Officer', domain: 'commercial',
      score: (isHighPushback?3:0)+(isHighVolume?2:0)+(!isNightOwl?2:0)+(isLongSpan?2:0)+(isLowPushback?0:1) },
    { title: 'VC-Backed Fundraising Lead', domain: 'commercial',
      score: (isHighPushback?3:0)+(isDeep?2:0)+(isNightOwl?1:0)+(isHighVocab?2:0)+(isLongSpan?1:0) },
    { title: 'Head of Partnerships (Platform/Ecosystem)', domain: 'commercial',
      score: (isHighQuestions?2:0)+(isShortMessages?2:0)+(!isNightOwl?2:0)+(isMedPushback?2:0)+(isHighVolume?1:0) },
    { title: 'Growth Lead (PLG/B2C)', domain: 'commercial',
      score: (isHighVolume?3:0)+(isShortMessages?2:0)+(!isNightOwl?2:0)+(isHighQuestions?1:0)+(isLowPushback?1:0) },
    { title: 'Founder (Pre-Seed, Commercial Thesis)', domain: 'commercial',
      score: (isHighPushback?2:0)+(isHighVolume?2:0)+(isNightOwl?2:0)+(isHighVocab?1:0)+(isLongSpan?1:0) },
    { title: 'Business Development Director', domain: 'commercial',
      score: (isHighQuestions?3:0)+(isShortMessages?2:0)+(!isNightOwl?1:0)+(isMedPushback?2:0)+(isHighVolume?1:0) },
    { title: 'Category Manager (Consumer/Retail)', domain: 'commercial',
      score: (isLowPushback?2:0)+(!isNightOwl?2:0)+(isHighVolume?2:0)+(isShortMessages?2:0)+(isLowQuestions?1:0) },

    // ── LEGAL & POLICY ──
    { title: 'Litigation Partner (Commercial Law)', domain: 'legal',
      score: (isHighPushback?4:0)+(isDeep?2:0)+(isLowQuestions?2:0)+(isLongMessages?2:0)+(isHighVocab?1:0) },
    { title: 'Regulatory Affairs Director', domain: 'legal',
      score: (isDeep?2:0)+(isLowPushback?2:0)+(isLongMessages?2:0)+(isHighVocab?3:0)+(isLongSpan?2:0) },
    { title: 'Chief Privacy / AI Governance Officer', domain: 'legal',
      score: (isDeep?3:0)+(isHighVocab?3:0)+(isLongSpan?2:0)+(isLowPushback?1:0)+(isNightOwl?1:0) },
    { title: 'Policy Lead (Tech / AI / Health)', domain: 'legal',
      score: (isDeep?2:0)+(isLongMessages?2:0)+(isHighVocab?3:0)+(isLongSpan?2:0)+(isMedPushback?1:0) },
    { title: 'Transactional Lawyer (M&A / VC)', domain: 'legal',
      score: (isHighPushback?2:0)+(isDeep?2:0)+(isLowQuestions?2:0)+(isHighVocab?2:0)+(!isNightOwl?2:0) },
    { title: 'Public Interest Lawyer / Advocate', domain: 'legal',
      score: (isHighPushback?3:0)+(isDeep?2:0)+(isHighVocab?2:0)+(isLongSpan?2:0)+(isHighDeepDive?1:0) },
    { title: 'Compliance & Ethics Lead', domain: 'legal',
      score: (isLowPushback?3:0)+(isDeep?2:0)+(isHighVocab?2:0)+(!isNightOwl?2:0)+(isLongSpan?1:0) },
    { title: 'Parliamentary / Legislative Advisor', domain: 'legal',
      score: (isDeep?2:0)+(isHighVocab?3:0)+(isLongMessages?2:0)+(isMedPushback?2:0)+(isLongSpan?1:0) },

    // ── CREATIVE & EDITORIAL ──
    { title: 'Editorial Director (Long-Form / Magazine)', domain: 'creative',
      score: (isHighVocab?3:0)+(isHighDeepDive?2:0)+(isLongMessages?2:0)+(isMultiPlatform?2:0)+(isNightOwl?1:0) },
    { title: 'Science Communicator / Journalist', domain: 'creative',
      score: (isHighVocab?3:0)+(isHighDeepDive?2:0)+(isLowPushback?2:0)+(!isHighVolume?1:0)+(isHighQuestions?1:0) },
    { title: 'Narrative Designer (Games / Interactive)', domain: 'creative',
      score: (isNightOwl?2:0)+(isDeep?2:0)+(isHighVocab?2:0)+(isLongMessages?2:0)+(isLowPushback?2:0) },
    { title: 'Creative Director (Brand / Campaign)', domain: 'creative',
      score: (isNightOwl?2:0)+(isHighVocab?2:0)+(isDeep?2:0)+(isHighDeepDive?2:0)+(isMedPushback?1:0) },
    { title: 'Speechwriter / Executive Ghostwriter', domain: 'creative',
      score: (isDeep?2:0)+(isHighVocab?3:0)+(isLongMessages?2:0)+(isLowPushback?2:0)+(isLongSpan?1:0) },
    { title: 'Head of Content Strategy', domain: 'creative',
      score: (isHighVocab?2:0)+(isHighDeepDive?2:0)+(isMedPushback?2:0)+(!isNightOwl?1:0)+(isLongSpan?2:0) },
    { title: 'Staff Writer / Culture Critic', domain: 'creative',
      score: (isNightOwl?2:0)+(isHighVocab?3:0)+(isLongMessages?2:0)+(isHighPushback?2:0)+(!isHighVolume?1:0) },
    { title: 'Documentary Researcher / Producer', domain: 'creative',
      score: (isHighQuestions?2:0)+(isDeep?2:0)+(isHighVocab?2:0)+(isLongSpan?2:0)+(isMedPushback?1:0) },

    // ── LEADERSHIP & OPERATIONS ──
    { title: 'Founder / CEO (Venture-Backed)', domain: 'leadership',
      score: (isNightOwl?3:0)+(isDeep?2:0)+(isLongSpan?3:0)+(isHighVocab?2:0)+(isMultiPlatform?1:0)+(isHighPushback?1:0) },
    { title: 'COO (Scaling Startup)', domain: 'leadership',
      score: (isHighVolume?3:0)+(isShortMessages?2:0)+(!isNightOwl?2:0)+(isLowPushback?2:0)+(isLongSpan?1:0) },
    { title: 'General Manager (P&L Ownership)', domain: 'leadership',
      score: (isHighVolume?2:0)+(!isNightOwl?2:0)+(isLowPushback?2:0)+(isLongSpan?2:0)+(isMedPushback?1:0) },
    { title: 'VP of Product', domain: 'leadership',
      score: (isDeep?2:0)+(isHighQuestions?2:0)+(isMedPushback?2:0)+(isLongSpan?2:0)+(!isNightOwl?1:0) },
    { title: 'Head of Operations (Series B+)', domain: 'leadership',
      score: (isHighVolume?3:0)+(isShortMessages?3:0)+(!isNightOwl?1:0)+(isLowPushback?2:0)+(isLowQuestions?1:0) },
    { title: 'Chief People Officer / CHRO', domain: 'leadership',
      score: (isLowPushback?3:0)+(isDeep?1:0)+(!isNightOwl?2:0)+(isMedQuestions?2:0)+(isLongSpan?2:0) },
    { title: 'Managing Director (Consulting/Professional Services)', domain: 'leadership',
      score: (isDeep?2:0)+(isLowPushback?2:0)+(isLongSpan?3:0)+(isHighVocab?2:0)+(!isNightOwl?1:0) },
    { title: 'Venture Partner (Early-Stage Fund)', domain: 'leadership',
      score: (isNightOwl?3:0)+(isHighVocab?2:0)+(!isHighVolume?2:0)+(isLongSpan?2:0)+(isDeep?1:0) },

    // ── EDUCATION & COACHING ──
    { title: 'Executive Coach (C-Suite)', domain: 'education',
      score: (isLowPushback?3:0)+(isDeep?2:0)+(isLongSpan?2:0)+(!isNightOwl?2:0)+(isMedQuestions?1:0) },
    { title: 'Head of Learning & Development', domain: 'education',
      score: (isLongMessages?3:0)+(isLowPushback?2:0)+(!isNightOwl?2:0)+(isHighDeepDive?2:0)+(isMedQuestions?1:0) },
    { title: 'Professor / Research Academic', domain: 'education',
      score: (isVeryDeep?4:isLongMessages?2:0)+(isDeep?2:0)+(isHighVocab?2:0)+(isNightOwl?2:0)+(isHighDeepDive?1:0) },
    { title: 'Curriculum Designer (Professional / HE)', domain: 'education',
      score: (isLongMessages?2:0)+(isLowPushback?2:0)+(isDeep?2:0)+(isMedQuestions?2:0)+(!isNightOwl?2:0) },
    { title: 'Instructional Designer (Corporate)', domain: 'education',
      score: (isLongMessages?2:0)+(isLowPushback?3:0)+(!isNightOwl?2:0)+(isMedQuestions?2:0)+(isLowPushback?1:0) },
    { title: 'Organisational Psychologist', domain: 'education',
      score: (isDeep?2:0)+(isLowPushback?3:0)+(isHighVocab?2:0)+(isLongSpan?2:0)+(isMedQuestions?1:0) },
    { title: 'Community College Dean / Academic Director', domain: 'education',
      score: (isDeep?1:0)+(isLowPushback?2:0)+(!isNightOwl?3:0)+(isLongMessages?2:0)+(isLongSpan?2:0) },
    { title: 'Learning Experience Designer (EdTech)', domain: 'education',
      score: (isHighQuestions?2:0)+(isLowPushback?2:0)+(isDeep?1:0)+(!isNightOwl?2:0)+(isMedPushback?1:0)+(isLongMessages?1:0) }
  ];

  // ── Score, sort, pick top 4 with domain diversity for unexpected slot ──
  const scoredRoles = ROLE_LIBRARY.map(r => ({ ...r, computed: r.score }))
    .sort((a, b) => b.computed - a.computed);

  // Top 3 from highest scores
  const top3 = scoredRoles.slice(0, 3);
  const top3Domains = new Set(top3.map(r => r.domain));

  // 4th must be from a different domain than the top scorer's domain
  const primaryDomain = top3[0].domain;
  const unexpected = scoredRoles.find(r => r.domain !== primaryDomain && !top3.includes(r));

  const selectedRoles = [
    ...top3,
    unexpected || scoredRoles[3]
  ];

  // Format for prompt injection — Claude writes the why text only
  const rolesForPrompt = selectedRoles.map((r, i) => ({
    title: r.title,
    domain: r.domain,
    signalScore: r.computed,
    unexpected: i === 3
  }));

SUGGESTED signal names for this archetype: ${primary.signalNames.join(', ')}
You may use these or derive better ones from the data. They must be specific to the archetype.

Return ONLY valid JSON. No markdown. No preamble. No trailing commas. No explanation.

{
  "profileName": "2-3 word evocative title. Must reflect THIS archetype and THESE numbers. Examples: Debugger+highVolume→'The Relentless Iterator', Debugger+nightOwl→'The Midnight Fixer', Philosopher+longMessages→'The Deep Current', Analyst+lowVolume→'The Quiet Certainty', Absorber+longSpan→'The Patient Architect', Visionary+multiPlatform→'The Long Signal', Operator+veryShort→'The Precision Machine', Catalyst+highQuestions→'The Fast Spark'. Make it feel like a magazine profile title.",
  "thinkerType": "${primary.name}${secondary.score >= primary.score - 2 ? ' · ' + secondary.name + ' tendency' : ''}",
  "summary": "4 sentences. First: the core truth about this mind in one sharp sentence. Second: the evidence — cite specific numbers. Third: the tension or surprise — something unexpected about this combination. Fourth: the implication — what this means for how they should work or be worked with. NO generic statements.",
  "signals": [
    {
      "name": "USE the archetype-specific signal names above — not generic ones",
      "score": "number 40-97",
      "label": "one specific observation grounded in the actual data numbers",
      "growth": "1-2 sentences of honest, specific personal growth guidance for THIS signal at THIS score. Not generic. Reference the actual number. Example: 'At 36% pushback over 16 months, the pattern is consistent — but consistency at this level can mean missing friction that would sharpen the thinking. Once a month, argue the opposite position before committing.'",
      "managerNote": "1 sentence telling a manager exactly how to work with this signal. Concrete and actionable. Example: 'Give this person a clear brief and get out of the way — micromanagement will cost you their best thinking and their trust.'"
    },
    {"name": "signal 2", "score": "number", "label": "observation", "growth": "personal guidance", "managerNote": "manager instruction"},
    {"name": "signal 3", "score": "number", "label": "observation", "growth": "personal guidance", "managerNote": "manager instruction"},
    {"name": "signal 4", "score": "number", "label": "observation", "growth": "personal guidance", "managerNote": "manager instruction"},
    {"name": "signal 5", "score": "number", "label": "observation", "growth": "personal guidance", "managerNote": "manager instruction"},
    {"name": "signal 6", "score": "number", "label": "observation", "growth": "personal guidance", "managerNote": "manager instruction"}
  ],
  "traits": ["8 behavioural observations specific to ${primary.name} + these numbers. Format: verb phrase or specific behaviour. GOOD: 'resolves ambiguity through iteration not debate', 'asks one precise question instead of three vague ones', 'moves at 1am when everyone else has gone quiet'. BAD: 'analytical', 'strategic', 'curious', 'driven'. Every trait must be something a colleague could observe."],
  "careerFits": [
    {"title": "${rolesForPrompt[0]?.title}", "why": "2 sentences connecting THIS person's specific metrics to why this role fits. Reference actual numbers. Not generic.", "score": ${Math.min(97, Math.max(78, rolesForPrompt[0]?.signalScore * 8 + 50))}, "tags": ["derive 2 tags from the signals that make this fit"], "unexpected": false},
    {"title": "${rolesForPrompt[1]?.title}", "why": "2 sentences", "score": ${Math.min(94, Math.max(75, rolesForPrompt[1]?.signalScore * 7 + 45))}, "tags": ["tag1", "tag2"], "unexpected": false},
    {"title": "${rolesForPrompt[2]?.title}", "why": "2 sentences", "score": ${Math.min(91, Math.max(72, rolesForPrompt[2]?.signalScore * 7 + 40))}, "tags": ["tag1", "tag2"], "unexpected": false},
    {"title": "${rolesForPrompt[3]?.title}", "why": "explain the non-obvious connection — why do this person's signals lead here despite it being outside their primary domain", "score": ${Math.min(86, Math.max(68, rolesForPrompt[3]?.signalScore * 6 + 38))}, "tags": ["tag1"], "unexpected": true}
  ],
  "employerQuote": "One sentence an employer would say after reviewing this profile. Specific. Surprising. Makes them want to meet this person.",
  "hiddenInsight": "One honest observation this person probably has not articulated about themselves. The thing the data reveals that they might recognise as true but have never said out loud.",
  "cultureNarrative": "One paragraph — 3 to 5 sentences. Where this person does their best work and what environment brings out their worst. Must be grounded in the 7 culture dimension scores above, not generic. Include a specific observation about their ideal manager or team dynamic. No bullet points. Write like a sharp talent advisor briefing a founder before a hire."
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
        max_tokens: 3000,
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
