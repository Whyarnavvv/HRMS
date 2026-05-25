const https = require('https');

const getSenderEmail = () =>
  process.env.BREVO_SENDER || process.env.SMTP_USER;

/**
 * Send email via Brevo HTTP API over port 443.
 * Works on all hosting providers including Render free plan.
 */
const sendEmail = ({ to, subject, html }) => {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = getSenderEmail();

  if (!apiKey || !senderEmail) {
    console.log(`📧 [SIMULATION] Email to ${to} | Subject: ${subject}`);
    return Promise.resolve({ success: true, simulated: true });
  }

  console.log(`📧 Sending email to: ${to}`);

  const payload = JSON.stringify({
    sender: { email: senderEmail, name: 'Study Palace Hub' },
    to: [{ email: to }],
    subject,
    htmlContent: html,
  });

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: 'api.brevo.com',
        path: '/v3/smtp/email',
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode === 201) {
            console.log(`✅ Email sent to: ${to}`);
            resolve({ success: true });
          } else {
            let msg = body;
            try { msg = JSON.parse(body).message || body; } catch {}
            console.error(`❌ Email failed to ${to}: [${res.statusCode}] ${msg}`);
            resolve({ success: false, error: msg, code: res.statusCode });
          }
        });
      }
    );

    req.on('error', (err) => {
      console.error(`❌ Email request error to ${to}: ${err.message}`);
      resolve({ success: false, error: err.message });
    });

    req.write(payload);
    req.end();
  });
};

module.exports = { sendEmail, getSenderEmail };
