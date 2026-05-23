const cron = require('node-cron');
const User = require('../models/User');
const { sendEmail } = require('../utils/emailService');
const { cleanupExpiredWFHGeolocations } = require('../controllers/wfhRequestController');

const isLastWorkingDayOfMonth = () => {
  const today = new Date();
  let lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  while (lastDay.getDay() === 0 || lastDay.getDay() === 6) {
    lastDay.setDate(lastDay.getDate() - 1);
  }
  return today.getDate() === lastDay.getDate() &&
         today.getMonth() === lastDay.getMonth() &&
         today.getFullYear() === lastDay.getFullYear();
};

const sendMonthlySummaryEmails = async () => {
  if (!isLastWorkingDayOfMonth()) return;
  console.log('Running monthly KPI email job...');

  try {
    const employees = await User.find({ role: 'Employee', isActive: 'Active' });
    for (const emp of employees) {
      await sendEmail({
        to: emp.email,
        subject: `Monthly KPI Summary — ${emp.name}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #2563eb;">Monthly KPI Summary</h2>
            <p>Hello ${emp.name},</p>
            <p>Your total KPI score at the end of this month is: <strong>${emp.totalKpi}</strong>.</p>
            <p>Log in to your portal to view the detailed history.</p>
            <p style="color: #94a3b8; font-size: 0.85em;">Best Regards,<br/>HR Team — Study Palace Hub</p>
          </div>
        `
      });
    }
  } catch (error) {
    console.error('Error sending monthly emails:', error);
  }
};

cron.schedule('0 17 * * *', () => {
  sendMonthlySummaryEmails();
});

// Run daily at midnight to purge geolocation data from expired WFH approvals
cron.schedule('0 0 * * *', () => {
  cleanupExpiredWFHGeolocations().catch((err) => console.error('WFH geo cleanup error:', err));
});

module.exports = { sendMonthlySummaryEmails, isLastWorkingDayOfMonth };
