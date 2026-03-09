export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const {
      text, wakeHour, wakeMinute, windDownHour, windDownMinute,
      energyPattern, goals, taskOrderPreference,
      currentHour: clientHour, currentMinute: clientMinute,
      clarifyAnswers, learningContext
    } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'No brain dump text provided' });
    }

    const now = new Date();
    const currentHour = clientHour !== undefined ? clientHour : now.getHours();
    const currentMinute = clientMinute !== undefined ? clientMinute : now.getMinutes();

    const peakWindow = {
      morning: { label: 'morning', range: '7am–11am', start: 7, end: 11 },
      afternoon: { label: 'afternoon', range: '12pm–4pm', start: 12, end: 16 },
      night: { label: 'evening', range: '6pm–10pm', start: 18, end: 22 },
    }[energyPattern || 'morning'] || { label: 'morning', range: '7am–11am', start: 7, end: 11 };

    const goalRules = [];
    const goalList = goals || [];
    if (goalList.includes('fitness')) goalRules.push('FITNESS GOAL: Schedule exercise during peak energy unless a specific time is given.');
    if (goalList.includes('academic')) goalRules.push('ACADEMIC GOAL: Study tasks are top priority — schedule during peak energy, minimum 60 minutes.');
    if (goalList.includes('career')) goalRules.push('CAREER GOAL: Work tasks during peak energy hours.');
    if (goalList.includes('creative')) goalRules.push('CREATIVE GOAL: Creative tasks need focused peak-energy time.');
    if (goalList.includes('social')) goalRules.push('SOCIAL GOAL: Schedule calls/meetups at realistic social hours, do not skip them.');
    if (goalList.includes('mental health')) goalRules.push('MENTAL HEALTH GOAL: Always protect leisure time. Leave breathing room.');
    if (goalList.includes('financial')) goalRules.push('FINANCIAL GOAL: Money tasks when alert, not end of day.');

    const goalSection = goalRules.length > 0
      ? `\nGOAL-BASED RULES:\n${goalRules.join('\n')}\n` : '';

    let learningSection = '';
    if (learningContext && learningContext.trim().length > 0) {
      learningSection = `\nPERSONALISED INSTRUCTIONS (follow precisely):\n${learningContext}\n`;
    }

    const taskOrderRule = {
      'Hard first': 'TASK ORDER: Schedule the most demanding/effortful casual tasks at the START of the peak energy window. Easier tasks and leisure come after.',
      'Easy first': 'TASK ORDER: Schedule 1-2 quick easy tasks at the very start of the day to build momentum, THEN move into harder tasks during peak energy.',
      'Mix it up': 'TASK ORDER: Alternate between demanding and lighter tasks throughout the day. Never stack 2+ hard tasks back to back.',
    }[taskOrderPreference] || 'TASK ORDER: Schedule the most demanding tasks during peak energy hours.';

    const systemPrompt = `You are BrainPour, a daily planning AI. Parse the user's brain dump into THREE categories: scheduled tasks (for the calendar), quick tasks (for the to-do list), and write a short warm explanation.

CURRENT TIME: ${currentHour}:${String(currentMinute).padStart(2, '0')}
SCHEDULE WINDOW: ${wakeHour || 7}:${String(wakeMinute || 0).padStart(2, '0')} to ${windDownHour || 22}:${String(windDownMinute || 0).padStart(2, '0')}
ENERGY PATTERN: ${peakWindow.label} person — peak window is ${peakWindow.range}
GOALS: ${goalList.join(', ') || 'not specified'}
${goalSection}${learningSection}
TASK CLASSIFICATION:
- SCHEDULED TASKS (go on the calendar with a time slot): Tasks that need a dedicated block of time — studying, gym, cooking, meetings, watching a match, gaming sessions, deep work. These get a specific hour and duration.
- QUICK TASKS (go on the to-do list, NOT the calendar): Small tasks under 15 minutes that can be done anytime between other things — "call mom", "reply to email", "text Sarah", "buy milk", "check bank balance", "send invoice". These don't need a time slot. The user checks them off whenever they find a gap.

RULE: If a task takes under 15 minutes AND has no specific time mentioned, it is a QUICK TASK. If in doubt, make it a quick task — it's less overwhelming on the calendar.

SCHEDULING RULES:
1. Split into INDIVIDUAL tasks. "Study math and revise finance" = TWO tasks.
2. FIXED: has a specific time — keep exactly. CASUAL: obligation tasks — you choose time. LEISURE: enjoyment tasks — place as rewards.
3. Never schedule before current time. Peak energy for hardest tasks. 10-15 min buffers between intense tasks.
4. ${taskOrderRule}
5. Durations: study=45-60min, deep work=60-90min, gym=45-60min, movie=90-120min, gaming=60min, meals=30-45min, shopping=30-45min, cooking=30-45min.
6. Task titles: concise. "I need to do some quick revision on finance exam" → "Finance exam revision"

RETURN FORMAT — respond with ONLY a valid JSON object:
{
  "tasks": [
    {"title": "string", "category": "fixed|casual|leisure", "estimatedMinutes": number, "scheduledHour": number, "scheduledMinute": number}
  ],
  "quickTasks": [
    {"title": "string", "category": "casual|leisure"}
  ],
  "reasoning": "2-4 sentence warm explanation. Reference specific tasks. Mention why you placed things when you did."
}

No markdown, no code fences. Only the JSON object.`;

    let clarifyContext = '';
    if (clarifyAnswers && Array.isArray(clarifyAnswers) && clarifyAnswers.length > 0) {
      clarifyContext = '\n\nClarifying answers from the user:\n' +
        clarifyAnswers.map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n') +
        '\n\nUse these to personalise the schedule.';
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
        max_tokens: 1200,
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

    const parsed = JSON.parse(cleanContent);
    const tasks = Array.isArray(parsed) ? parsed : (parsed.tasks || []);
    const quickTasks = parsed.quickTasks || [];
    const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning : null;

    if (!Array.isArray(tasks)) return res.status(500).json({ error: 'Invalid AI response format' });

    const validatedTasks = tasks.map((task) => ({
      title: String(task.title || 'Untitled task'),
      category: ['fixed', 'casual', 'leisure'].includes(task.category) ? task.category : 'casual',
      estimatedMinutes: Math.max(5, Math.min(480, Number(task.estimatedMinutes) || 30)),
      scheduledHour: Math.max(0, Math.min(23, Number(task.scheduledHour) || 9)),
      scheduledMinute: Math.max(0, Math.min(59, Number(task.scheduledMinute) || 0)),
    }));

    validatedTasks.sort((a, b) => (a.scheduledHour * 60 + a.scheduledMinute) - (b.scheduledHour * 60 + b.scheduledMinute));

    const validatedQuickTasks = quickTasks.map((t) => ({
      title: String(t.title || 'Untitled'),
      category: ['casual', 'leisure'].includes(t.category) ? t.category : 'casual',
    }));

    return res.status(200).json({ tasks: validatedTasks, quickTasks: validatedQuickTasks, reasoning });

  } catch (error) {
    console.error('Parse error:', error);
    return res.status(500).json({ error: 'Failed to parse brain dump', details: error.message });
  }
}
