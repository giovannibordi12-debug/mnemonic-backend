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

    // Peak energy window based on pattern
    const peakWindow = {
      morning: { label: 'morning', range: '7am–11am', start: 7, end: 11 },
      afternoon: { label: 'afternoon', range: '12pm–4pm', start: 12, end: 16 },
      night: { label: 'evening', range: '6pm–10pm', start: 18, end: 22 },
    }[energyPattern || 'morning'] || { label: 'morning', range: '7am–11am', start: 7, end: 11 };

    // Goals → concrete scheduling rules
    const goalRules = [];
    const goalList = goals || [];
    if (goalList.includes('fitness')) {
      goalRules.push('FITNESS GOAL: If any exercise, gym, sport, or physical activity task appears, treat it as high priority. Schedule it during peak energy hours unless a specific time is given. Do not bury it late in the day.');
    }
    if (goalList.includes('academic')) {
      goalRules.push('ACADEMIC GOAL: Study, revision, reading, and research tasks are top priority. Schedule the most important study task first during peak energy. Give study sessions at least 60 minutes.');
    }
    if (goalList.includes('career')) {
      goalRules.push('CAREER GOAL: Work tasks, emails, projects, and professional development are high priority. Schedule them during peak energy hours.');
    }
    if (goalList.includes('creative')) {
      goalRules.push('CREATIVE GOAL: Creative tasks (writing, art, music, design) need focused time. Schedule them during peak energy when the mind is fresh, not as afterthoughts.');
    }
    if (goalList.includes('social')) {
      goalRules.push('SOCIAL GOAL: Calls, meetups, and social tasks matter to this user. Do not skip or deprioritize them — schedule them at realistic social hours (not 7am).');
    }
    if (goalList.includes('mental health')) {
      goalRules.push('MENTAL HEALTH GOAL: Protect leisure and rest time. Always include at least one leisure or relaxation task. Do not overschedule — leave breathing room between tasks.');
    }
    if (goalList.includes('financial')) {
      goalRules.push('FINANCIAL GOAL: Budget, financial planning, and money-related tasks are important. Schedule them when the user is alert, not at the end of a long day.');
    }

    const goalSection = goalRules.length > 0
      ? `\nGOAL-BASED SCHEDULING RULES (apply these when relevant tasks appear):\n${goalRules.join('\n')}\n`
      : '';

    // Learning history as direct scheduling instructions
    let learningSection = '';
    if (learningContext && learningContext.trim().length > 0) {
      learningSection = `\nPERSONALISED SCHEDULING INSTRUCTIONS (based on this user's past behaviour — follow these precisely):\n${learningContext}\n`;
    }

    const systemPrompt = `You are a daily planning AI assistant called BrainPour. The user will give you a messy brain dump of everything on their mind today. Your job is to parse it into individual tasks, categorize them, estimate durations, and schedule them into a realistic daily calendar.

CURRENT TIME: ${currentHour}:${String(currentMinute).padStart(2, '0')}
USER'S SCHEDULE WINDOW: ${wakeHour || 7}:${String(wakeMinute || 0).padStart(2, '0')} to ${windDownHour || 22}:${String(windDownMinute || 0).padStart(2, '0')}
ENERGY PATTERN: ${peakWindow.label} person — peak performance window is ${peakWindow.range}
GOALS: ${goalList.join(', ') || 'not specified'}
${goalSection}${learningSection}
RULES:
1. TASK SPLITTING: Split the brain dump into INDIVIDUAL, DISTINCT tasks. "Study math and revise finance" = TWO tasks. Never clump multiple activities into one task.

2. CATEGORIZATION:
   - FIXED: Tasks with a specific time mentioned ("class at 9", "meeting at 3pm"). Keep their stated time exactly.
   - CASUAL: Tasks with obligation language ("need to", "should", "must", "finish", "study", "call", "clean"). You choose the best time.
   - LEISURE: Tasks with desire/enjoyment language ("want to", "game", "watch", "relax", "café", "read for fun"). Place as rewards after hard tasks.

3. TIME SCHEDULING:
   - NEVER schedule before current time (${currentHour}:${String(currentMinute).padStart(2, '0')}).
   - Schedule the most important/hardest casual tasks during peak energy (${peakWindow.range}).
   - Place leisure tasks after productive blocks as rewards.
   - Leave 10-15 min buffers between intense tasks.
   - If "in X minutes/hours" is mentioned, calculate from current time.
   - Follow PERSONALISED SCHEDULING INSTRUCTIONS above precisely — they override general rules.

4. DURATION ESTIMATES:
   - Quick tasks (call, email): 10-15 min
   - Shopping, cooking: 30-45 min
   - Study/revision: 45-60 min
   - Deep work, creative: 60-90 min
   - Gym, exercise: 45-60 min
   - Match, movie: 90-120 min
   - Gaming: 60 min
   - Meals: 30-45 min

5. TASK TITLES: Concise and clear. "I need to do some quick revision on my finance exam" → "Finance exam revision"

Return ONLY a valid JSON array. No explanation, no markdown, no code fences. Each object must have exactly:
- "title": string
- "category": "fixed" | "casual" | "leisure"
- "estimatedMinutes": number
- "scheduledHour": number (0-23)
- "scheduledMinute": number (0-59)`;

    let clarifyContext = '';
    if (clarifyAnswers && Array.isArray(clarifyAnswers) && clarifyAnswers.length > 0) {
      clarifyContext = '\n\nThe user answered these clarifying questions:\n' +
        clarifyAnswers.map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n') +
        '\n\nUse these answers to personalise the schedule further.';
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
        messages: [{
          role: 'user',
          content: `Here is my brain dump for today:\n\n${text}${clarifyContext}`,
        }],
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Anthropic API error:', errorData);
      return res.status(500).json({ error: 'AI service error', details: errorData });
    }

    const data = await response.json();
    const content = data.content?.[0]?.text;
    if (!content) return res.status(500).json({ error: 'No response from AI' });

    let cleanContent = content.trim();
    if (cleanContent.startsWith('```json')) cleanContent = cleanContent.slice(7);
    if (cleanContent.startsWith('```')) cleanContent = cleanContent.slice(3);
    if (cleanContent.endsWith('```')) cleanContent = cleanContent.slice(0, -3);
    cleanContent = cleanContent.trim();

    const tasks = JSON.parse(cleanContent);
    if (!Array.isArray(tasks)) return res.status(500).json({ error: 'Invalid AI response format' });

    const validatedTasks = tasks.map((task) => ({
      title: String(task.title || 'Untitled task'),
      category: ['fixed', 'casual', 'leisure'].includes(task.category) ? task.category : 'casual',
      estimatedMinutes: Math.max(5, Math.min(480, Number(task.estimatedMinutes) || 30)),
      scheduledHour: Math.max(0, Math.min(23, Number(task.scheduledHour) || 9)),
      scheduledMinute: Math.max(0, Math.min(59, Number(task.scheduledMinute) || 0)),
    }));

    validatedTasks.sort((a, b) => (a.scheduledHour * 60 + a.scheduledMinute) - (b.scheduledHour * 60 + b.scheduledMinute));

    return res.status(200).json(validatedTasks);
  } catch (error) {
    console.error('Parse error:', error);
    return res.status(500).json({ error: 'Failed to parse brain dump', details: error.message });
  }
}
