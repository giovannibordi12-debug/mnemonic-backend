// File: api/brainpour-clarify.js
// Add this alongside brainpour-parse.js in your Vercel project

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, wakeHour, wakeMinute, windDownHour, windDownMinute, energyPattern, goals, currentHour, currentMinute } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'No brain dump text provided' });
    }

    const systemPrompt = `You are BrainPour's planning AI. The user just did a brain dump of their thoughts for today. Your job is to ask 2-3 SHORT clarifying questions that will help you schedule their day better.

CURRENT TIME: ${currentHour !== undefined ? currentHour : 9}:${String(currentMinute !== undefined ? currentMinute : 0).padStart(2, '0')}
ENERGY PATTERN: ${energyPattern || 'morning'}
GOALS: ${(goals || []).join(', ') || 'not specified'}

Rules for generating questions:
1. Ask 2-3 questions MAXIMUM. Never more than 3.
2. Each question should have 2-4 short tappable options.
3. Questions should be about:
   - PRIORITY: If there are multiple tasks, which matters most today?
   - DURATION: If a task is vague (like "study"), how long do they want to spend?
   - STRESS: Is anything on the list stressing them out? (so you can schedule it first or break it down)
   - ENERGY: Are they feeling energized or tired today? (to adjust the schedule)
   - FLEXIBILITY: Are any "casual" tasks actually time-sensitive today?
4. Keep questions conversational and friendly, not robotic.
5. Options should be SHORT (2-5 words each).
6. Don't ask obvious questions about tasks that are already specific.
7. Only ask about things that would genuinely change how you schedule the day.

Return ONLY a valid JSON array of question objects. No explanation, no markdown, no code fences.

Format:
[
  {
    "question": "Which task matters most today?",
    "options": ["Finance revision", "Call mom", "Grocery shopping"]
  },
  {
    "question": "How long do you want to study?",
    "options": ["30 minutes", "1 hour", "2 hours"]
  },
  {
    "question": "How's your energy right now?",
    "options": ["Tired", "Okay", "Energized", "Wired"]
  }
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

    // Validate and clean questions
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
