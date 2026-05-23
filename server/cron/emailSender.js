const cron = require('node-cron');
const nodemailer = require('nodemailer');
const User = require('../models/User');
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

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  try {
    const employees = await User.find({ role: 'Employee' });
    
    for (const emp of employees) {
      const mailOptions = {
        from: '"KPI Platform" <noreply@company.com>',
        to: emp.email,
        subject: `Monthly KPI Summary for ${emp.name}`,
        text: `Hello ${emp.name},\n\nYour total KPI score at the end of this month is: ${emp.totalKpi}.\n\nLog in to your portal to view the detailed history.\n\nBest Regards,\nHR Team`,
      };

      await transporter.sendMail(mailOptions);
      console.log(`Email sent to ${emp.email}`);
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
