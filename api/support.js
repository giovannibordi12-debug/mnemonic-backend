module.exports = function handler(req, res) {
  res.setHeader('Content-Type', 'text/html')
  res.status(200).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Mnemonic Support</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
    </head>
    <body style="font-family:-apple-system,sans-serif;max-width:600px;margin:60px auto;padding:20px;background:#0f0f13;color:#f0eee8">
      <h1 style="color:#e8c97a;font-size:2rem;margin-bottom:8px">Mnemonic</h1>
      <p style="color:#8a8a9a;margin-bottom:40px">AI Flashcards · Spaced Repetition</p>
      <h2 style="font-size:1.1rem;margin-bottom:12px">Support</h2>
      <p style="color:#c0beb8;line-height:1.6">For help, questions, or feedback about Mnemonic, please get in touch:</p>
      <p style="margin-top:20px">
        <a href="mailto:giovannibordi12@gmail.com" style="color:#e8c97a">your@email.com</a>
      </p>
      <p style="color:#8a8a9a;font-size:0.8rem;margin-top:60px">© 2026 Giovanni Bordi</p>
    </body>
    </html>
  `)
}
