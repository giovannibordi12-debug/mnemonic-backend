// File: api/brainpour-clarify.js
// Updated: better question rules - no time scheduling questions

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, wakeHour, wakeMinute, windDownHour, windDownMinute, energyPattern, goals, currentHour, currentMinute } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'No brain dump text provided' });
    }

    const systemPrompt = `You are BrainPour's planning AI. The user just did a brain dump. Ask 2-3 SHORT clarifying questions to help schedule their day better.

CURRENT TIME: ${currentHour !== undefined ? currentHour : 9}:${String(currentMinute !== undefined ? currentMinute : 0).padStart(2, '0')}
ENERGY PATTERN: ${energyPattern || 'morning'}
GOALS: ${(goals || []).join(', ') || 'not specified'}

STRICT RULES FOR QUESTIONS:
1. Ask 2-3 questions MAX. Each with 2-4 short tappable options.
2. NEVER ask what TIME to schedule something. You decide the time — that's your job.
3. NEVER ask "when" questions with hour numbers as options (like "7am", "8am", "9am"). The AI scheduler picks the optimal time.
4. GOOD questions to ask:
   - PRIORITY: "Which task matters most today?" → list the tasks as options
   - DURATION: "How long do you want to study?" → "30 min" / "1 hour" / "2 hours"
   - ENERGY: "How's your energy right now?" → "Tired" / "Okay" / "Energized"
   - STRESS: "Anything stressing you out on this list?" → list tasks as options + "Nothing"
   - FLEXIBILITY: "Is [task] urgent today or can it wait?" → "Must do today" / "Can wait"
5. BAD questions (NEVER ask these):
   - "What time do you want to do X?" ← NO
   - "When should I schedule X?" ← NO
   - "Morning or evening for X?" ← NO (you figure this out from their energy pattern)
6. Keep questions conversational and friendly.
7. Options should be SHORT (2-5 words each).
8. If the brain dump is very simple (1-2 clear tasks), return an EMPTY array — no questions needed.

Return ONLY a valid JSON array. No explanation, no markdown, no code fences.
[
  {"question": "Which matters most today?", "options": ["Finance revision", "Grocery shopping"]},
  {"question": "How long for studying?", "options": ["30 min", "1 hour", "2 hours"]}
]`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 512,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Here is my brain dump:\n\n${text}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Anthropic API error:', errorData);
      return res.status(500).json({ error: 'AI service error' });
    }

    const data = await response.json();
    const content = data.content?.[0]?.text;

    if (!content) {
      return res.status(500).json({ error: 'No response from AI' });
    }

    let cleanContent = content.trim();
    if (cleanContent.startsWith('```json')) cleanContent = cleanContent.slice(7);
    if (cleanContent.startsWith('```')) cleanContent = cleanContent.slice(3);
    if (cleanContent.endsWith('```')) cleanContent = cleanContent.slice(0, -3);
    cleanContent = cleanContent.trim();

    const questions = JSON.parse(cleanContent);

    if (!Array.isArray(questions)) {
      return res.status(500).json({ error: 'Invalid response format' });
    }

    const validated = questions.slice(0, 3).map(q => ({
      question: String(q.question || ''),
      options: Array.isArray(q.options) ? q.options.map(String).slice(0, 4) : [],
    })).filter(q => q.question.length > 0 && q.options.length >= 2);

    return res.status(200).json(validated);
  } catch (error) {
    console.error('Clarify error:', error);
    return res.status(500).json({ error: 'Failed to generate questions', details: error.message });
  }
}
