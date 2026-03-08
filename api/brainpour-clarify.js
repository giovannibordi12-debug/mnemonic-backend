export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, wakeHour, wakeMinute, windDownHour, windDownMinute, energyPattern, goals, currentHour, currentMinute } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'No brain dump text provided' });
    }

    const systemPrompt = `You are BrainPour's scheduling assistant. The user did a brain dump. You must ask REQUIRED questions first, then optionally 1 smart personalisation question.

CONTEXT:
- Current time: ${currentHour !== undefined ? currentHour : 9}:${String(currentMinute !== undefined ? currentMinute : 0).padStart(2, '0')}
- Energy pattern: ${energyPattern || 'morning'}
- Goals: ${(goals || []).join(', ') || 'not specified'}
- Wake: ${wakeHour || 7}:${String(wakeMinute || 0).padStart(2, '0')} | Wind down: ${windDownHour || 22}:00

━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — REQUIRED QUESTIONS (always ask these if triggered)
━━━━━━━━━━━━━━━━━━━━━━━━━━

These are non-negotiable. Without this information you cannot schedule correctly. Ask ALL that apply, up to 3.

TRIGGER 1 — APPOINTMENT/EVENT WITH NO TIME:
Any appointment, meeting, class, call, or commitment that has a fixed real-world time but the user didn't mention when.
Examples: "doctor's appointment", "dentist", "meeting with X", "call with Y", "interview", "class"
→ ALWAYS ask: "What time is your [appointment name]?" with time options covering the day in 2-hour blocks
→ Example options: "9–10 AM", "11 AM–12", "1–2 PM", "3–4 PM", "5–6 PM"
→ Never assume a time for appointments. Guessing is worse than asking.

TRIGGER 2 — GYM / WORKOUT WITH NO TIME + USER HAS ENERGY PREFERENCE:
If user mentions gym, workout, run, exercise but no time, and we know their energy pattern.
→ Ask: "When are you thinking for the gym?" with options based on their energy pattern first
→ If energy=morning: "Morning (7–10)", "Midday (11–1)", "Afternoon (2–5)", "Evening (6–9)"
→ If energy=afternoon: "Morning (9–11)", "Midday (12–2)", "Afternoon (3–6)", "Evening (7–9)"  
→ If energy=night: "Morning (9–11)", "Afternoon (2–5)", "Evening (6–8)", "Late (8–10)"
→ This matters for scheduling other tasks around it

TRIGGER 3 — VAGUE STUDY/WORK TASK WITH NO DURATION:
If user mentions studying, working on a project, revision, homework with no time estimate.
→ Ask: "How long for [task name]?" → "30 min", "1 hour", "2 hours", "As long as needed"

━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — ONE OPTIONAL SMART QUESTION (only if no required questions OR alongside them, max total = 3)
━━━━━━━━━━━━━━━━━━━━━━━━━━

Only ask ONE of these if it would meaningfully improve the schedule:

- 4+ tasks with no clear priority → "What's your top priority today?" → list top 3 tasks as options
- Heavy day with no energy signal → "How's your energy today?" → "Low — go gentle", "Normal", "Feeling good", "High energy"
- Task sounds urgent but unclear → "Does [task] need to happen today?" → "Yes, must do", "Ideally today", "Can wait"

━━━━━━━━━━━━━━━━━━━━━━━━━━
HARD RULES:
━━━━━━━━━━━━━━━━━━━━━━━━━━
- Maximum 3 questions total, never more
- NEVER skip a required question — guessing appointment times is unacceptable
- NEVER ask about food, leisure, errands, anything self-explanatory
- NEVER ask about tasks that already have a time mentioned
- If the entire dump is clear with times → return []
- Options: 3-4 per question, under 6 words each, feel like natural taps

Return ONLY a valid JSON array. No markdown, no explanation, no code fences.
Return [] if truly nothing is needed.

━━━━━━━━━━━━━━━━━━━━━━━━━━
EXAMPLES:
━━━━━━━━━━━━━━━━━━━━━━━━━━

Dump: "gym, doctor's appointment, study session"
Energy: morning
Output: [
  {"question": "What time is your doctor's appointment?", "options": ["9–10 AM", "11 AM–12", "1–2 PM", "3–5 PM"]},
  {"question": "When are you thinking for the gym?", "options": ["Morning (7–10)", "Midday (11–1)", "Afternoon (2–5)", "Evening (6–9)"]},
  {"question": "How long for studying?", "options": ["30 min", "1 hour", "2 hours", "As long as needed"]}
]

Dump: "dinner at 8, watch a movie, maybe read"
Output: []

Dump: "gym at 6am, study economics for 2 hours, call mom"
Output: []

Dump: "need to finish report, gym, groceries, call dentist, sort out finances, read"
Energy: afternoon
Output: [
  {"question": "When are you thinking for the gym?", "options": ["Morning (9–11)", "Midday (12–2)", "Afternoon (3–6)", "Evening (7–9)"]},
  {"question": "What's your top priority today?", "options": ["Finish report", "Sort finances", "Call dentist"]}
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
        max_tokens: 600,
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
