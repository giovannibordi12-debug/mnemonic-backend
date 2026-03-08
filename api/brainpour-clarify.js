export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, wakeHour, wakeMinute, windDownHour, windDownMinute, energyPattern, goals, currentHour, currentMinute } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'No brain dump text provided' });
    }

    const systemPrompt = `You are BrainPour's planning AI. The user just did a brain dump. Your job is to decide WHETHER to ask clarifying questions, and if so, ask ONLY the ones that would meaningfully change how the day gets scheduled.

CURRENT TIME: ${currentHour !== undefined ? currentHour : 9}:${String(currentMinute !== undefined ? currentMinute : 0).padStart(2, '0')}
ENERGY PATTERN: ${energyPattern || 'morning'}
GOALS: ${(goals || []).join(', ') || 'not specified'}

WHEN TO RETURN AN EMPTY ARRAY []:
- The dump is short and clear (1-3 tasks with obvious timing and effort)
- All tasks already have specific times mentioned
- The tasks are simple errands or leisure with no ambiguity
- You already have enough info to schedule confidently
- Example: "dinner at 8, then watch a movie" → return []
- Example: "going to the gym then cooking" → return []

WHEN TO ASK (maximum 2 questions, never 3):
Only ask when the ANSWER would directly change the schedule in a meaningful way.

VALID question triggers:
1. STUDY/WORK DEPTH: A vague study or work task appears with no duration or deadline. Ask how long or how urgent.
   - Good: "How long do you want to study for the exam?" → "30 min", "1 hour", "2 hours", "Until I'm done"
   - Bad: never ask about cooking, leisure, errands, or anything self-explanatory

2. COMPETING PRIORITIES: There are 4+ tasks with no clear priority and limited time in the day. Ask which matters most.
   - Good: "Which is your top priority today?" → list the 2-3 most ambiguous important tasks
   - Bad: don't ask this if the tasks are obviously ordered or if there are only 2-3 tasks

3. DEADLINE URGENCY: A task sounds potentially urgent but isn't clearly time-sensitive. Ask if it needs to be done today.
   - Good: "Does the report need to be submitted today?" → "Yes, today", "Tomorrow is fine", "No deadline yet"
   - Bad: never ask this about leisure or personal tasks

4. ENERGY CHECK: Only ask if the dump contains multiple demanding tasks AND no time clues at all. Ask energy level to decide pacing.
   - Good: "How's your energy today?" → "Low — go easy", "Normal", "High — push hard"
   - Bad: don't ask this if the dump is light or if times are already specified

NEVER ASK ABOUT:
- Food choices ("cooking or eating out?")
- Leisure preferences ("gaming or reading?")
- Tasks that already have a specific time
- Anything that wouldn't change the schedule
- Duration of gym, walks, or physical tasks (use standard estimates)
- Anything obvious from context

OPTIONS FORMAT:
- 2-4 options maximum
- Keep each option under 5 words
- Make them feel like natural taps, not form fields

Return ONLY a valid JSON array. If no questions are needed return [].
No markdown, no explanation, no code fences.

Example outputs:

Dump: "gym then dinner with friends at 8"
Output: []

Dump: "need to study economics, call dentist, gym, maybe read"
Output: [{"question": "How long for economics?", "options": ["30 min", "1 hour", "2 hours"]}]

Dump: "finish the project report, study for two exams, call mom, gym, groceries, need to sort finances, want to game"
Output: [
  {"question": "What's your top priority today?", "options": ["Project report", "Exam studying", "Finances"]},
  {"question": "How's your energy?", "options": ["Low — go easy", "Normal", "High — push hard"]}
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
        messages: [{
          role: 'user',
          content: `Here is my brain dump:\n\n${text}`,
        }],
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Anthropic API error:', errorData);
      return res.status(500).json({ error: 'AI service error' });
    }

    const data = await response.json();
    const content = data.content?.[0]?.text;
    if (!content) return res.status(500).json({ error: 'No response from AI' });

    let cleanContent = content.trim();
    if (cleanContent.startsWith('```json')) cleanContent = cleanContent.slice(7);
    if (cleanContent.startsWith('```')) cleanContent = cleanContent.slice(3);
    if (cleanContent.endsWith('```')) cleanContent = cleanContent.slice(0, -3);
    cleanContent = cleanContent.trim();

    const questions = JSON.parse(cleanContent);
    if (!Array.isArray(questions)) return res.status(500).json({ error: 'Invalid response format' });

    // Max 2, must have 2+ options
    const validated = questions.slice(0, 2).map(q => ({
      question: String(q.question || ''),
      options: Array.isArray(q.options) ? q.options.map(String).slice(0, 4) : [],
    })).filter(q => q.question.length > 0 && q.options.length >= 2);

    return res.status(200).json(validated);

  } catch (error) {
    console.error('Clarify error:', error);
    return res.status(500).json({ error: 'Failed to generate questions', details: error.message });
  }
}
