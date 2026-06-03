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

  const now   = new Date();
  const month = now.getMonth() + 1; // current month (1-based)
  const year  = now.getFullYear();
  const start = new Date(year, month - 1, 1);
  const end   = new Date(year, month, 1);

  try {
    const KpiRecord = require('../models/KpiRecord');
    const employees = await User.find({ role: 'Employee', isActive: 'Active' });

    for (const emp of employees) {
      // Aggregate this employee's KPI points for the current month only
      const monthlyAgg = await KpiRecord.aggregate([
        {
          $match: {
            employeeId: emp._id,
            date: { $gte: start, $lt: end },
            points: { $gt: 0 }
          }
        },
        { $group: { _id: null, total: { $sum: '$points' } } }
      ]);
      const monthlyKpi = monthlyAgg[0]?.total || 0;
      const monthName  = start.toLocaleString('default', { month: 'long' });

      await sendEmail({
        to: emp.email,
        subject: `Monthly KPI Summary — ${monthName} ${year}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #2563eb;">Monthly KPI Summary</h2>
            <p>Hello ${emp.name},</p>
            <p>Your KPI score for <strong>${monthName} ${year}</strong> is: <strong>${monthlyKpi} points</strong>.</p>
            <p>Your all-time total KPI score is: <strong>${emp.totalKpi} points</strong>.</p>
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
