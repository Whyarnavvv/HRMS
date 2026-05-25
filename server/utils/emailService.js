const nodemailer = require('nodemailer');

const createTransporter = () => {
  // Brevo SMTP — port 465 (SSL) because Render blocks outbound port 587
  if (process.env.BREVO_USER && process.env.BREVO_PASS) {
    return nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.BREVO_USER,
        pass: process.env.BREVO_PASS,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    });
  }

  // Gmail fallback — port 465 SSL
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });
};

const getSenderEmail = () =>
  process.env.BREVO_SENDER || process.env.BREVO_USER || process.env.SMTP_USER;

const sendEmail = async ({ to, subject, html }) => {
  const hasBrevo = !!(process.env.BREVO_USER && process.env.BREVO_PASS);
  const hasGmail = !!(process.env.SMTP_USER && process.env.SMTP_PASS);

  if (!hasBrevo && !hasGmail) {
    console.log(`📧 [SIMULATION] Email to ${to} | Subject: ${subject}`);
    return { success: true, simulated: true };
  }

  console.log(`📧 Attempting email to: ${to} via ${hasBrevo ? 'Brevo (port 465)' : 'Gmail (port 465)'}`);

  const transporter = createTransporter();
  const senderEmail = getSenderEmail();

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
    console.error(`❌ Email failed to ${to}: ${error.message}`);
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNECTION') {
      console.error('   ⚠️  Port blocked by hosting provider. Check firewall/outbound rules.');
    }
    if (error.code === 'EAUTH') {
      console.error('   ⚠️  Authentication failed. Check BREVO_USER and BREVO_PASS.');
    }
    return { success: false, error: error.message, code: error.code };
  }
};

module.exports = { sendEmail, getSenderEmail };
