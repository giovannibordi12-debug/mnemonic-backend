module.exports = function handler(req, res) {
  res.setHeader('Content-Type', 'text/html')
  res.status(200).send(`
<!DOCTYPE html>
<html>
<head>
  <title>Mnemonic — Privacy Policy</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: -apple-system, sans-serif;
      background: #0f0f13;
      color: #c0beb8;
      line-height: 1.7;
      padding: 60px 20px 100px;
    }
    .wrap { max-width: 640px; margin: 0 auto; }
    h1 { color: #e8c97a; font-size: 2rem; margin-bottom: 6px; }
    .subtitle { color: #8a8a9a; font-size: 0.85rem; margin-bottom: 48px; }
    h2 { color: #f0eee8; font-size: 1.05rem; margin: 36px 0 12px; }
    p { margin-bottom: 14px; font-size: 0.92rem; }
    ul { margin: 8px 0 14px 20px; font-size: 0.92rem; }
    ul li { margin-bottom: 6px; }
    a { color: #7ac8e8; text-decoration: none; }
    a:hover { text-decoration: underline; }
    hr { border: none; border-top: 1px solid rgba(255,255,255,0.07); margin: 48px 0; }
    .footer { color: #8a8a9a; font-size: 0.78rem; margin-top: 48px; }
  </style>
</head>
<body>
<div class="wrap">
  <h1>Mnemonic</h1>
  <div class="subtitle">Privacy Policy · Effective 3 April 2026</div>

  <p>This privacy policy applies to the Mnemonic: AI Flashcard Generator app (hereby referred to as "Application") for mobile devices, created by Giovanni Bordi (hereby referred to as "Service Provider") as a Freemium service. This service is intended for use "AS IS".</p>

  <h2>Information Collection and Use</h2>
  <p>The Application collects information when you download and use it. This information may include:</p>
  <ul>
    <li>Your device's Internet Protocol address (e.g. IP address)</li>
    <li>The pages of the Application that you visit, the time and date of your visit, and the time spent on those pages</li>
    <li>The operating system you use on your mobile device</li>
  </ul>
  <p>The Application does not gather precise information about the location of your mobile device.</p>
  <p>The Application uses Artificial Intelligence (AI) technologies to enhance user experience and provide certain features. The AI components may process user-submitted text and images to generate flashcards. All AI processing is performed via the Anthropic API in accordance with this privacy policy and applicable laws.</p>

  <h2>Third Party Access</h2>
  <p>Only aggregated, anonymized data is periodically transmitted to external services to aid the Service Provider in improving the Application. The Service Provider may disclose information:</p>
  <ul>
    <li>As required by law, such as to comply with a subpoena or similar legal process</li>
    <li>When necessary to protect rights, safety, or respond to a government request</li>
    <li>With trusted service providers who work on their behalf and have agreed to adhere to this privacy statement</li>
  </ul>

  <h2>Opt-Out Rights</h2>
  <p>You can stop all collection of information by uninstalling the Application using the standard uninstall processes available on your mobile device or via the app marketplace.</p>

  <h2>Data Retention Policy</h2>
  <p>The Service Provider will retain User Provided data for as long as you use the Application and for a reasonable time thereafter. To request deletion of your data, please contact <a href="mailto:giovannibordi12@gmail.com">giovannibordi12@gmail.com</a>.</p>

  <h2>Children</h2>
  <p>The Service Provider does not use the Application to knowingly solicit data from or market to children under the age of 13. If you believe a child has provided personally identifiable information, please contact the Service Provider at <a href="mailto:giovannibordi12@gmail.com">giovannibordi12@gmail.com</a>.</p>

  <h2>Security</h2>
  <p>The Service Provider is concerned about safeguarding the confidentiality of your information and provides physical, electronic, and procedural safeguards to protect information processed and maintained.</p>

  <h2>Changes</h2>
  <p>This Privacy Policy may be updated from time to time. The Service Provider will notify you of any changes by updating this page. Continued use of the Application is deemed approval of all changes.</p>

  <h2>Your Consent</h2>
  <p>By using the Application, you are consenting to the processing of your information as set forth in this Privacy Policy.</p>

  <h2>Contact Us</h2>
  <p>If you have any questions regarding privacy while using the Application, please contact the Service Provider at <a href="mailto:giovannibordi12@gmail.com">giovannibordi12@gmail.com</a>.</p>

  <hr>
  <div class="footer">© 2026 Giovanni Bordi · Mnemonic: AI Flashcard Generator</div>
</div>
</body>
</html>
  `)
}
