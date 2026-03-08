export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const {
      text, wakeHour, wakeMinute, windDownHour, windDownMinute,
      energyPattern, goals,
      currentHour: clientHour, currentMinute: clientMinute,
      clarifyAnswers, learningContext
    } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'No brain dump text provided' });
    }

    const now = new Date();
    const currentHour = clientHour !== undefined ? clientHour : now.getHours();
    const currentMinute = clientMinute !== undefined ? clientMinute : now.getMinutes();

    // Build learning history section if available
    let learningSection = '';
    if (learningContext && learningContext.trim().length > 0) {
      learningSection = `\nLEARNING HISTORY (from this user's past behaviour — use this to schedule smarter):
${learningContext}
Apply these patterns: if a task keyword matches something the user skips often, schedule it at their preferred time or skip suggesting it. If a task type takes longer than expected, use the learned duration. If a time is marked as wrong, avoid that slot.
`;
    }

    const systemPrompt = `You are a daily planning AI assistant called BrainPour. The user will give you a messy brain dump of everything on their mind today. Your job is to parse it into individual tasks, categorize them, estimate durations, and schedule them into a realistic daily calendar.
CURRENT TIME: ${currentHour}:${String(currentMinute).padStart(2, '0')}
USER'S SCHEDULE WINDOW: ${wakeHour || 7}:${String(wakeMinute || 0).padStart(2, '0')} to ${windDownHour || 22}:${String(windDownMinute || 0).padStart(2, '0')}
ENERGY PATTERN: ${energyPattern || 'morning'}
GOALS: ${(goals || []).join(', ') || 'not specified'}
${learningSection}
RULES:
1. TASK SPLITTING: Split the brain dump into INDIVIDUAL, DISTINCT tasks. "Study math and revise finance" should become TWO separate tasks. Never clump multiple activities into one task.
2. CATEGORIZATION:
   - FIXED: Tasks with a specific time mentioned ("class at 9", "meeting at 3pm", "match at 18"). These keep their stated time exactly.
   - CASUAL: Tasks with obligation/action language ("need to", "should", "have to", "must", "finish", "study", "revise", "call", "clean"). These are flexible — you choose the best time.
   - LEISURE: Tasks with desire/enjoyment language ("want to", "would like", "game", "watch a show", "relax", "café", "read for fun"). Place these as rewards between hard tasks.
3. TIME SCHEDULING:
   - NEVER schedule tasks before the current time (${currentHour}:${String(currentMinute).padStart(2, '0')}). If it's 5pm, the earliest task starts at 5pm.
   - If the user says "in X minutes" or "in X hours", calculate the actual time from the current time.
   - If the user mentions a specific time, respect it exactly.
   - Schedule harder casual tasks during the user's peak energy time.
   - Place leisure tasks as rewards after completing hard blocks.
   - Leave 10-15 minute buffers between intense tasks.
   - Be realistic about duration estimates — don't under-estimate.
4. DURATION ESTIMATES (be realistic):
   - Quick tasks (call someone, send email): 10-15 min
   - Medium tasks (grocery shopping, cooking): 30-45 min
   - Study/revision sessions: 45-60 min
   - Creative/deep work: 60-90 min
   - Exercise/gym: 45-60 min
   - Watching a match/movie: 90-120 min
   - Gaming session: 60 min
   - Meals: 30-45 min
5. TASK TITLES: Clean up the task title to be concise and clear. Keep it short.
Return ONLY a valid JSON array. No explanation, no markdown, no code fences. Each object must have exactly these fields:
- "title": string (concise task name)
- "category": "fixed" | "casual" | "leisure"
- "estimatedMinutes": number
- "scheduledHour": number (0-23, 24-hour format)
- "scheduledMinute": number (0-59)
Example output:
[
  {"title": "Finance exam revision", "category": "casual", "estimatedMinutes": 60, "scheduledHour": 17, "scheduledMinute": 30},
  {"title": "Watch AS Roma match", "category": "fixed", "estimatedMinutes": 120, "scheduledHour": 18, "scheduledMinute": 0},
  {"title": "Gaming session", "category": "leisure", "estimatedMinutes": 60, "scheduledHour": 20, "scheduledMinute": 15}
]`;

    let clarifyContext = '';
    if (clarifyAnswers && Array.isArray(clarifyAnswers) && clarifyAnswers.length > 0) {
      clarifyContext = '\n\nThe user also answered these clarifying questions:\n' +
        clarifyAnswers.map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n') +
        '\n\nUse these answers to make the schedule more personalized.';
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Here is my brain dump for today:\n\n${text}${clarifyContext}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Anthropic API error:', errorData);
      return res.status(500).json({ error: 'AI service error', details: errorData });
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

    const tasks = JSON.parse(cleanContent);
    if (!Array.isArray(tasks)) {
      return res.status(500).json({ error: 'Invalid AI response format' });
    }

    const validatedTasks = tasks.map((task) => ({
      title: String(task.title || 'Untitled task'),
      category: ['fixed', 'casual', 'leisure'].includes(task.category) ? task.category : 'casual',
      estimatedMinutes: Math.max(5, Math.min(480, Number(task.estimatedMinutes) || 30)),
      scheduledHour: Math.max(0, Math.min(23, Number(task.scheduledHour) || 9)),
      scheduledMinute: Math.max(0, Math.min(59, Number(task.scheduledMinute) || 0)),
    }));

    validatedTasks.sort((a, b) => {
      const aTime = a.scheduledHour * 60 + a.scheduledMinute;
      const bTime = b.scheduledHour * 60 + b.scheduledMinute;
      return aTime - bTime;
    });

    return res.status(200).json(validatedTasks);
  } catch (error) {
    console.error('Parse error:', error);
    return res.status(500).json({ error: 'Failed to parse brain dump', details: error.message });
  }
}
