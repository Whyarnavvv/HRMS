const nodemailer = require('nodemailer');

const getSenderEmail = () => process.env.SMTP_USER;

const sendEmail = async ({ to, subject, html }) => {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    console.log(`📧 [SIMULATION] Email to ${to} | Subject: ${subject}`);
    return { success: true, simulated: true };
  }

  console.log(`📧 Sending email to: ${to}`);

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  try {
    await transporter.sendMail({
      from: `"Study Palace Hub" <${user}>`,
      to,
      subject,
      html,
    });
    console.log(`✅ Email sent to: ${to}`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Email failed to ${to}: ${error.message}`);
    return { success: false, error: error.message };
  }
};

module.exports = { sendEmail, getSenderEmail };
