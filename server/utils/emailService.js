const { BrevoClient } = require('@getbrevo/brevo');

const getSenderEmail = () =>
  process.env.BREVO_SENDER || process.env.SMTP_USER;

/**
 * Send email via Brevo HTTP API (port 443 — never blocked by any host).
 */
const sendEmail = async ({ to, subject, html }) => {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = getSenderEmail();

  if (!apiKey || !senderEmail) {
    console.log(`📧 [SIMULATION] Email to ${to} | Subject: ${subject}`);
    return { success: true, simulated: true };
  }

  console.log(`📧 Sending email to: ${to} via Brevo API`);

  try {
    const client = new BrevoClient({ apiKey });

    await client.transactionalEmails.sendTransacEmail({
      sender: { email: senderEmail, name: 'Study Palace Hub' },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    });

    console.log(`✅ Email sent to: ${to}`);
    return { success: true };
  } catch (error) {
    const msg = error?.response?.data?.message || error?.message || String(error);
    console.error(`❌ Email failed to ${to}: ${msg}`);
    return { success: false, error: msg };
  }
};

module.exports = { sendEmail, getSenderEmail };
