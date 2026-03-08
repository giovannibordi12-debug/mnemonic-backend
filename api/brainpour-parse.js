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

    const systemPrompt = `You are BrainPour, a daily planning AI. Parse the user's brain dump into a scheduled day AND write a short warm explanation of your key scheduling decisions.

CURRENT TIME: ${currentHour}:${String(currentMinute).padStart(2, '0')}
SCHEDULE WINDOW: ${wakeHour || 7}:${String(wakeMinute || 0).padStart(2, '0')} to ${windDownHour || 22}:${String(windDownMinute || 0).padStart(2, '0')}
ENERGY PATTERN: ${peakWindow.label} person — peak window is ${peakWindow.range}
GOALS: ${goalList.join(', ') || 'not specified'}
${goalSection}${learningSection}

SCHEDULING RULES:
1. Split into INDIVIDUAL tasks. "Study math and revise finance" = TWO tasks.
2. FIXED: has a specific time mentioned — keep exactly. CASUAL: obligation tasks — you choose time. LEISURE: enjoyment tasks — place as rewards after productive blocks.
3. Never schedule before current time. Peak energy for hardest tasks. 10-15 min buffers between intense tasks.
4. Durations: calls/email=10-15min, shopping/cooking=30-45min, study=45-60min, deep work=60-90min, gym=45-60min, movie=90-120min, gaming=60min, meals=30-45min.
5. Task titles: concise. "I need to do some quick revision on finance exam" → "Finance exam revision"

RETURN FORMAT — respond with ONLY a valid JSON object with two fields:
{
  "tasks": [ array of task objects ],
  "reasoning": "2-4 sentence warm explanation of your key decisions. Reference specific tasks by name. Mention why you placed things when you did. End with something encouraging. Keep it conversational, not robotic. Example: 'I put your gym session first thing since you're a morning person — best to move while the energy is high. Your doctor's appointment is locked at 3pm so I built the rest of the day around that. Spaced your study session after lunch with a short break before it. You've got a solid day ahead!'"
}

Each task object must have exactly:
- "title": string
- "category": "fixed" | "casual" | "leisure"  
- "estimatedMinutes": number
- "scheduledHour": number (0-23)
- "scheduledMinute": number (0-59)

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

    // Support both old array format and new object format
    const tasks = Array.isArray(parsed) ? parsed : (parsed.tasks || []);
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

    return res.status(200).json({ tasks: validatedTasks, reasoning });

  } catch (error) {
    console.error('Parse error:', error);
    return res.status(500).json({ error: 'Failed to parse brain dump', details: error.message });
  }
}
