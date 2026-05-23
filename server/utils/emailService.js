const nodemailer = require('nodemailer');

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false, // STARTTLS on port 587
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false, // Required for some cloud hosting providers (Render)
    },
  });
};

const getSenderEmail = () => process.env.SMTP_USER;

/**
 * Send an email. Returns { success, error }.
 */
const sendEmail = async ({ to, subject, html }) => {
  const senderEmail = getSenderEmail();
  if (!senderEmail || !process.env.SMTP_PASS) {
    console.log(`📧 [SIMULATION] Email to ${to} | Subject: ${subject}`);
    return { success: true, simulated: true };
  }

  const transporter = createTransporter();
  try {
    await transporter.sendMail({
      from: `"Study Palace Hub" <${senderEmail}>`,
      to,
      subject,
      html,
    });
    console.log(`✅ Email sent to: ${to} | Subject: ${subject}`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Email failed to ${to}:`, error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { sendEmail, getSenderEmail };
