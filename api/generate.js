module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  const { text, images, count } = req.body

  const content = []

  if (images && images.length > 0) {
    images.forEach(function(img) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: img.mimeType, data: img.data }
      })
    })
  }

  content.push({
    type: 'text',
    text: 'You are an expert educator. Generate exactly ' + (count || 10) + ' high-quality flashcards from the content provided.\n\nEach card should have a clear question and a thorough 2-4 sentence answer.\nRespond ONLY with a JSON array, no markdown or preamble:\n[{"q":"question","a":"answer","tag":"topic tag"},...]\n\nContent:\n' + (text || 'Use the images provided.')
  })

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{ role: 'user', content: content }]
      })
    })

    const data = await response.json()
    const raw = data.content[0].text.trim()
    const cards = JSON.parse(raw.replace(/```json|```/g, '').trim())
    res.status(200).json({ cards: cards })
  } catch(err) {
    res.status(500).json({ error: err.message })
  }
}
