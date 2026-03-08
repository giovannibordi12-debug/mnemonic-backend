export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { tasks, moodScore, motivationScore, moodLabel, motivationLabel, userName } = req.body;

    if (!tasks || tasks.length === 0) {
      return res.status(400).json({ error: 'No tasks provided' });
    }

    // Build a readable task list for Claude
    const taskSummary = tasks.map(t => {
      let line = `- "${t.title}" [${t.category}] → ${t.status}`;
      if (t.feedback) line += ` (feedback: ${t.feedback})`;
      return line;
    }).join('\n');

    const systemPrompt = `You are BrainPour's end-of-day coach. You receive a user's task list with completion statuses and feedback, plus their mood and motivation scores. You write a short, honest, personalized daily debrief.

Your response must be a JSON object with exactly two fields:
- "reflection": 2-3 sentences. Be specific about what happened today. Reference actual tasks by name. Don't be generically positive or negative — be real. If they skipped gym and marked "didn't feel like it", acknowledge their energy was low. If they crushed their morning tasks, say so specifically.
- "suggestion": 1 specific actionable swap or adjustment for tomorrow. Not a list — just one thing. It should directly respond to a pattern you see in today's data. Example: "Tomorrow, move gym to the evening — you clearly had more energy then based on what you completed." Be concrete, not vague.

Mood scale: 1=exhausted, 2=low, 3=okay, 4=good, 5=great
Motivation scale: 1=dreading tomorrow, 2=low, 3=neutral, 4=looking forward, 5=pumped

Keep the tone warm but direct. No fluff. No "Great job!" unless it's truly warranted. The user wants honesty, not cheerleading.

Return ONLY valid JSON. No markdown, no explanation.`;

    const userMessage = `User: ${userName || 'the user'}
Mood today: ${moodScore}/5 (${moodLabel})
Motivation for tomorrow: ${motivationScore}/5 (${motivationLabel})

Tasks:
${taskSummary}`;

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
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      return res.status(500).json({ error: 'AI service error', details: errorData });
    }

    const data = await response.json();
    const content = data.content?.[0]?.text;
    if (!content) return res.status(500).json({ error: 'No response from AI' });

    let clean = content.trim();
    if (clean.startsWith('```json')) clean = clean.slice(7);
    if (clean.startsWith('```')) clean = clean.slice(3);
    if (clean.endsWith('```')) clean = clean.slice(0, -3);
    clean = clean.trim();

    const parsed = JSON.parse(clean);
    if (!parsed.reflection || !parsed.suggestion) {
      return res.status(500).json({ error: 'Invalid AI response format' });
    }

    return res.status(200).json({
      reflection: String(parsed.reflection),
      suggestion: String(parsed.suggestion),
    });
  } catch (error) {
    console.error('Summary error:', error);
    return res.status(500).json({ error: 'Failed to generate summary', details: error.message });
  }
}
