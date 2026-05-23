const ScreenTime = require('../models/ScreenTime');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = path.join(__dirname, '..', 'uploads', 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const getToday = () => new Date().toISOString().split('T')[0];

const getOrCreateTodayRecord = async (userId, date = getToday()) => {
  let record = await ScreenTime.findOne({ user: userId, date });
  if (!record) {
    record = await ScreenTime.create({ user: userId, date });
  }
  return record;
};

exports.startScreenSession = async (userId, date = getToday()) => {
  const record = await getOrCreateTodayRecord(userId, date);
  if (!record.sessionStart) {
    record.sessionStart = new Date();
    await record.save();
  }
  return record;
};

exports.stopScreenSession = async (userId, date = getToday()) => {
  const record = await getOrCreateTodayRecord(userId, date);
  record.sessionEnd = new Date();
  if (record.sessionStart && record.sessionEnd) {
    const diffSeconds = Math.max(0, Math.floor((record.sessionEnd - record.sessionStart) / 1000));
    record.totalWorkingSeconds = diffSeconds;
  }
  await record.save();
  return record;
};

// @desc    Screen heartbeat / activity update
// @route   POST /api/screen-time/heartbeat
// @access  Private
exports.trackHeartbeat = async (req, res) => {
  try {
    const { date, state = 'ACTIVE', durationSeconds = 0 } = req.body;
    const record = await getOrCreateTodayRecord(req.user._id, date || getToday());

    if (!record.sessionStart) {
      record.sessionStart = new Date();
    }

    const safeDuration = Math.max(0, Number(durationSeconds || 0));
    if (state === 'IDLE') {
      record.idleSeconds += safeDuration;
    } else {
      record.activeSeconds += safeDuration;
    }
    record.activityEvents.push({ state, durationSeconds: safeDuration, timestamp: new Date() });

    // Ensure sessionEnd is updated continuously to track logout/last active time
    record.sessionEnd = new Date();
    
    // Total working seconds should precisely be the sum of tracked time
    record.totalWorkingSeconds = record.activeSeconds + record.idleSeconds;

    await record.save();
    return res.status(200).json(record);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get my screen-time summaries
// @route   GET /api/screen-time/my
// @access  Private
exports.getMyScreenTime = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    const query = { user: req.user._id };
    if (fromDate || toDate) {
      query.date = {};
      if (fromDate) query.date.$gte = fromDate;
      if (toDate) query.date.$lte = toDate;
    }
    const records = await ScreenTime.find(query).sort({ date: -1 });
    return res.status(200).json(records);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get team screen-time summaries
// @route   GET /api/screen-time/team
// @access  Private (Admin/AGM/SuperAdmin)
exports.getTeamScreenTime = async (req, res) => {
  try {
    const { date } = req.query;
    const match = {};
    if (date) match.date = date;

    const rows = await ScreenTime.find(match)
      .populate('user', 'name email employeeId role department')
      .sort({ date: -1 })
      .limit(1000);
    return res.status(200).json(rows);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get global screen-time analytics
// @route   GET /api/screen-time/global
// @access  Private (SuperAdmin)
exports.getGlobalAnalytics = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    const match = {};
    if (fromDate || toDate) {
      match.date = {};
      if (fromDate) match.date.$gte = fromDate;
      if (toDate) match.date.$lte = toDate;
    }

    const summary = await ScreenTime.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$date',
          users: { $addToSet: '$user' },
          totalActiveSeconds: { $sum: '$activeSeconds' },
          totalIdleSeconds: { $sum: '$idleSeconds' },
          totalWorkingSeconds: { $sum: '$totalWorkingSeconds' }
        }
      },
      { $sort: { _id: -1 } }
    ]);

    return res.status(200).json(summary);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    SuperAdmin: get all employees screen time with screenshots
// @route   GET /api/screen-time/admin
// @access  Private (SuperAdmin only)
exports.getAdminScreenTime = async (req, res) => {
  try {
    const { fromDate, toDate, date } = req.query;
    const query = {};
    if (date) {
      query.date = date;
    } else if (fromDate || toDate) {
      query.date = {};
      if (fromDate) query.date.$gte = fromDate;
      if (toDate) query.date.$lte = toDate;
    }
    const rows = await ScreenTime.find(query)
      .populate('user', 'name email employeeId role department profilePic')
      .sort({ date: -1 })
      .limit(500);
    return res.status(200).json(rows);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Log idle event (keyboard+mouse idle or tab closed)
// @route   POST /api/screen-time/idle-event
// @access  Private
exports.logIdleEvent = async (req, res) => {
  try {
    const { reason = 'keyboard_mouse_idle', date } = req.body;
    const record = await getOrCreateTodayRecord(req.user._id, date || getToday());
    record.idleEvents.push({ startedAt: new Date(), reason });
    await record.save();
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Upload a silent screenshot
// @route   POST /api/screen-time/screenshot
// @access  Private
exports.uploadScreenshot = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const record = await getOrCreateTodayRecord(req.user._id, getToday());
    record.screenshots.push({ filename: req.file.filename, capturedAt: new Date() });
    await record.save();
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get screenshot config (how many per day)
// @route   GET /api/screen-time/screenshot-config
// @access  Private (SuperAdmin)
exports.getScreenshotConfig = async (req, res) => {
  try {
    const Settings = require('../models/Settings');
    const settings = await Settings.findOne({ name: 'GlobalSettings' });
    return res.status(200).json({ screenshotsPerDay: settings?.screenshotsPerDay || 0 });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Set screenshot config
// @route   PUT /api/screen-time/screenshot-config
// @access  Private (SuperAdmin)
exports.setScreenshotConfig = async (req, res) => {
  try {
    const { screenshotsPerDay } = req.body;
    const Settings = require('../models/Settings');
    let settings = await Settings.findOne({ name: 'GlobalSettings' });
    if (!settings) settings = await Settings.create({ name: 'GlobalSettings' });
    settings.screenshotsPerDay = Number(screenshotsPerDay) || 0;
    await settings.save();
    return res.status(200).json({ screenshotsPerDay: settings.screenshotsPerDay });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
