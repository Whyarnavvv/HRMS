const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']); // Override system DNS to fix querySrv ECONNREFUSED

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
require('./cron/emailSender'); // start cron

dotenv.config();

const app = express();

app.set('trust proxy', 1); // Trust Render's reverse proxy for correct client IPs

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    const allowed = [
      process.env.CLIENT_URL,
      process.env.FRONTEND_URL,
      'http://localhost:5173',
      'http://localhost:3000',
    ].filter(Boolean);
    // Allow any device on a local network (192.168.x.x or 10.x.x.x)
    const isLAN = /^http:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(origin);
    if (allowed.includes(origin) || isLAN) return callback(null, true);
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Connect Database with retry logic
const connectWithRetry = async (attempt = 1) => {
  const MAX_ATTEMPTS = Infinity; // Keep retrying until Atlas is reachable
  const RETRY_DELAY_MS = 5000;

  try {
    console.log(`🔄 MongoDB connection attempt ${attempt}/${MAX_ATTEMPTS}...`);
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ MongoDB Connected');

    console.log('✅ MongoDB Connected');

  } catch (err) {
    console.error(`❌ MongoDB connection failed (attempt ${attempt}): ${err.message}`);
    if (err.code === 'ECONNREFUSED' || err.message.includes('querySrv') || err.message.includes('whitelist') || err.message.includes('IP')) {
      console.error('   ⚠️  Your IP is not whitelisted in MongoDB Atlas.');
      console.error('   ➡️  Go to: https://cloud.mongodb.com → Network Access → Add IP Address → Allow Access from Anywhere (0.0.0.0/0)');
    }
    if (attempt < MAX_ATTEMPTS) {
      console.log(`   Retrying in ${RETRY_DELAY_MS / 1000}s...`);
      setTimeout(() => connectWithRetry(attempt + 1), RETRY_DELAY_MS);
    } else {
      console.error('❌ Max connection attempts reached. Please check your MongoDB Atlas settings.');
    }
  }
};

connectWithRetry();

// Guard: block API calls if DB is not connected
app.use('/api', (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      message: 'Database not connected. Please wait — the server is retrying the MongoDB connection. If this persists, check your MongoDB Atlas IP whitelist at https://cloud.mongodb.com'
    });
  }
  next();
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/employees', require('./routes/employeeRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/tasks', require('./routes/taskRoutes'));
app.use('/api/payroll', require('./routes/payrollRoutes'));
app.use('/api/holidays', require('./routes/holidayRoutes'));
app.use('/api/kpi', require('./routes/kpi'));
app.use('/api/settings', require('./routes/settingsRoutes'));
app.use('/api/wfh-requests', require('./routes/wfhRequestRoutes'));
app.use('/api/salary-slip-requests', require('./routes/salarySlipRequestRoutes'));
app.use('/api/screen-time', require('./routes/screenTimeRoutes'));
app.use('/api/audit-logs', require('./routes/auditLogRoutes'));
app.use('/api/companies', require('./routes/companyRoutes'));
app.use('/api/counselling', require('./routes/counsellingRoutes'));
app.use('/uploads/screenshots', require('express').static(require('path').join(__dirname, 'uploads', 'screenshots')));


const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server started on port ${PORT} and bound to 0.0.0.0`));
