const nodemailer = require('nodemailer');

const createTransporter = () => {
  // Brevo SMTP relay (requires sender IP whitelisted in Brevo dashboard)
  if (process.env.BREVO_USER && process.env.BREVO_PASS) {
    return nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.BREVO_USER,
        pass: process.env.BREVO_PASS,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }

  // Gmail fallback
  const port = Number(process.env.SMTP_PORT) || 465;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
};

const getSenderEmail = () =>
  process.env.BREVO_SENDER || process.env.SMTP_USER;

const sendEmail = async ({ to, subject, html }) => {
  const senderEmail = getSenderEmail();
  const hasBrevo = !!(process.env.BREVO_USER && process.env.BREVO_PASS);
  const hasGmail = !!(process.env.SMTP_USER && process.env.SMTP_PASS);

  if (!hasBrevo && !hasGmail) {
    console.log(`📧 [SIMULATION] Email to ${to} | Subject: ${subject}`);
    return { success: true, simulated: true };
  }

  const transporter = createTransporter();

  try {
    const info = await transporter.sendMail({
      from: `"Study Palace Hub" <${senderEmail}>`,
      to,
      subject,
      html,
    });
    console.log(`✅ Email sent to: ${to} | MessageId: ${info.messageId}`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Email FAILED to ${to} | Code: ${error.code} | ${error.message}`);
    if (error.code === 'EAUTH' && error.message.includes('Unauthorized IP')) {
      console.error('   ⚠️  Brevo: Render IP not whitelisted. Go to Brevo → Senders & IPs → Whitelist IPs → add Render IPs.');
    }
    return { success: false, error: error.message, code: error.code };
  }
};

module.exports = { sendEmail, getSenderEmail };
