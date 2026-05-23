const User = require('../models/User');
const KpiRecord = require('../models/KpiRecord');
const Settings = require('../models/Settings');

// ─── Auto-KPI Helpers ────────────────────────────────────────────────────────

const calcPunctualityKpi = (checkIn, status) => {
  const h = checkIn.getHours();
  const m = checkIn.getMinutes();
  const totalMin = h * 60 + m;

  // Half-day: check-in between 14:30–14:45 → 2.5 pts
  if (status === 'Half-day') {
    const from = 14 * 60 + 30; // 14:30
    const to   = 14 * 60 + 45; // 14:45
    return (totalMin >= from && totalMin <= to) ? 2.5 : 0;
  }

  const t1015 = 10 * 60 + 15;
  const t1030 = 10 * 60 + 30;
  const t1045 = 10 * 60 + 45;
  const t1100 = 11 * 60;

  if (totalMin < t1015)  return 4;
  if (totalMin <= t1030) return 3.5;
  if (totalMin <= t1045) return 3;
  if (totalMin <= t1100) return 2.5;
  return 0;
};

const calcWorkingHoursKpi = (totalHours) => {
  const totalMin = Math.round(totalHours * 60);
  const base     = 8 * 60 + 45; // 8h45m in minutes
  const floor    = 8 * 60 + 5;  // 8h05m

  if (totalMin >= base)       return 4;
  if (totalMin <= floor)      return 0;

  // 0.1 decrease per minute below 8:45, floor at 0
  const diff = base - totalMin;
  return Math.max(0, parseFloat((4 - diff * 0.1).toFixed(1)));
};

// Called from attendanceController after checkout
// Returns array of awarded KPI records so the API response can include them
const autoCalculateKpi = async (userId, attendanceRecord) => {
  try {
    const { checkIn, checkOut, totalHours, date } = attendanceRecord;
    if (!checkIn || !checkOut) return [];

    const dateObj = new Date(date + 'T00:00:00');

    // Prevent duplicate auto-KPI for same date
    const existing = await KpiRecord.findOne({
      employeeId: userId,
      date: { $gte: new Date(date + 'T00:00:00'), $lt: new Date(date + 'T23:59:59') },
      autoKpi: true
    });
    if (existing) return [];

    // BUG FIX: derive punctuality status purely from check-in time,
    // NOT from attendance.status which may have been mutated at checkout
    // (e.g. Late waived to Present, or changed to Half-day).
    const checkInDate = new Date(checkIn);
    const lateThresholdMin = 10 * 60 + 15; // 10:15 AM
    const checkInMin = checkInDate.getHours() * 60 + checkInDate.getMinutes();
    const isHalfDay = totalHours < 4.5; // less than 4.5h = half-day for KPI purposes
    const punctualityStatus = isHalfDay ? 'Half-day' : (checkInMin > lateThresholdMin ? 'Late' : 'Present');

    const punctualityPts = calcPunctualityKpi(checkInDate, punctualityStatus);
    const workingHrsPts  = calcWorkingHoursKpi(totalHours);

    const awarded = [];

    if (punctualityPts > 0) {
      const reason = checkInMin < 10 * 60 + 15
        ? `Early check-in at ${checkInDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — Punctuality KPI (Auto)`
        : `On-time check-in — Punctuality KPI (Auto)`;
      await KpiRecord.create({
        employeeId: userId, assignedBy: userId, date: dateObj,
        points: punctualityPts, reason, autoKpi: true, kpiType: 'punctuality'
      });
      await User.findByIdAndUpdate(userId, { $inc: { totalKpi: punctualityPts, totalAdded: punctualityPts } });
      awarded.push({ points: punctualityPts, reason, kpiType: 'punctuality' });
    }

    if (workingHrsPts > 0) {
      const reason = `Worked ${totalHours}h — Working Hours KPI (Auto)`;
      await KpiRecord.create({
        employeeId: userId, assignedBy: userId, date: dateObj,
        points: workingHrsPts, reason, autoKpi: true, kpiType: 'working_hours'
      });
      await User.findByIdAndUpdate(userId, { $inc: { totalKpi: workingHrsPts, totalAdded: workingHrsPts } });
      awarded.push({ points: workingHrsPts, reason, kpiType: 'working_hours' });
    }

    return awarded;
  } catch (err) {
    console.error('autoCalculateKpi error:', err.message);
    return [];
  }
};

// ─── Existing Controllers ────────────────────────────────────────────────────

const manageKpi = async (req, res) => {
  const { employeeId, date, points, reason } = req.body;
  const adminId = req.user._id;

  if (!reason || reason.trim() === '') {
    return res.status(400).json({ message: 'A mandatory reason must be provided' });
  }
  if (!date || points === undefined || points === null) {
    return res.status(400).json({ message: 'Date and points are required' });
  }

  try {
    const employee = await User.findById(employeeId);
    if (!employee) return res.status(404).json({ message: 'User not found' });

    const kpiRecord = await KpiRecord.create({
      employeeId,
      assignedBy: adminId,
      date,
      points: Number(points),
      reason
    });

    employee.totalKpi += Number(points);
    if (Number(points) > 0) employee.totalAdded += Number(points);
    else employee.totalDeducted += Math.abs(Number(points));
    await employee.save();

    res.status(201).json({ message: 'KPI updated successfully', kpiRecord, totalKpi: employee.totalKpi });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getKpiHistory = async (req, res) => {
  try {
    const employeeId = req.params.employeeId || req.user._id;
    const records = await KpiRecord.find({ employeeId })
      .sort({ date: -1, createdAt: -1 })
      .populate('assignedBy', 'name role');
    res.status(200).json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getLeaderboard = async (req, res) => {
  try {
    const leaderboard = await User.find({ isActive: 'Active', role: { $ne: 'SuperAdmin' } })
      .select('name role totalKpi totalAdded totalDeducted profilePic designation')
      .sort({ totalKpi: -1 });
    res.status(200).json(leaderboard);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── New Controllers ─────────────────────────────────────────────────────────

// Monthly leaderboard — KPI points earned in current month
const getMonthlyLeaderboard = async (req, res) => {
  try {
    const now   = new Date();
    const month = parseInt(req.query.month) || (now.getMonth() + 1);
    const year  = parseInt(req.query.year)  || now.getFullYear();
    const start = new Date(year, month - 1, 1);
    const end   = new Date(year, month, 1);

    const agg = await KpiRecord.aggregate([
      { $match: { date: { $gte: start, $lt: end }, points: { $gt: 0 } } },
      { $group: { _id: '$employeeId', monthlyPoints: { $sum: '$points' } } },
      { $sort: { monthlyPoints: -1 } }
    ]);

    const ids = agg.map(a => a._id);
    const users = await User.find({ _id: { $in: ids } })
      .select('name role designation profilePic employeeId');
    const userMap = Object.fromEntries(users.map(u => [u._id.toString(), u]));

    const result = agg.map((a, i) => ({
      rank: i + 1,
      ...userMap[a._id.toString()]?.toObject(),
      monthlyPoints: a.monthlyPoints
    })).filter(r => r.name);

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Employee of the Month
const getEmployeeOfMonth = async (req, res) => {
  try {
    const now   = new Date();
    const month = parseInt(req.query.month) || (now.getMonth() + 1);
    const year  = parseInt(req.query.year)  || now.getFullYear();
    const start = new Date(year, month - 1, 1);
    const end   = new Date(year, month, 1);

    const agg = await KpiRecord.aggregate([
      { $match: { date: { $gte: start, $lt: end }, points: { $gt: 0 } } },
      { $group: { _id: '$employeeId', monthlyPoints: { $sum: '$points' } } },
      { $sort: { monthlyPoints: -1 } },
      { $limit: 1 }
    ]);

    if (!agg.length) return res.status(200).json(null);

    const user = await User.findById(agg[0]._id)
      .select('name role designation profilePic employeeId department');
    res.status(200).json({ ...user.toObject(), monthlyPoints: agg[0].monthlyPoints, month, year });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Employee of the Year
const getEmployeeOfYear = async (req, res) => {
  try {
    const year  = parseInt(req.query.year) || new Date().getFullYear();
    const start = new Date(year, 0, 1);
    const end   = new Date(year + 1, 0, 1);

    const agg = await KpiRecord.aggregate([
      { $match: { date: { $gte: start, $lt: end }, points: { $gt: 0 } } },
      { $group: { _id: '$employeeId', yearlyPoints: { $sum: '$points' } } },
      { $sort: { yearlyPoints: -1 } },
      { $limit: 1 }
    ]);

    if (!agg.length) return res.status(200).json(null);

    const user = await User.findById(agg[0]._id)
      .select('name role designation profilePic employeeId department');
    res.status(200).json({ ...user.toObject(), yearlyPoints: agg[0].yearlyPoints, year });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Yearly increment calculation
const YEARLY_MAX_POINTS_FALLBACK = 2920;

const getYearlyMaxKpi = async (req, res) => {
  try {
    const settings = await Settings.findOne({ name: 'GlobalSettings' });
    res.status(200).json(settings?.yearlyMaxKpi || []);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const setYearlyMaxKpi = async (req, res) => {
  try {
    const { year, maxPoints } = req.body;
    if (!year || !maxPoints || Number(maxPoints) < 1)
      return res.status(400).json({ message: 'Valid year and maxPoints are required' });

    let settings = await Settings.findOne({ name: 'GlobalSettings' });
    if (!settings) settings = await Settings.create({ name: 'GlobalSettings' });

    const existing = settings.yearlyMaxKpi.find(e => e.year === Number(year));
    if (existing) existing.maxPoints = Number(maxPoints);
    else settings.yearlyMaxKpi.push({ year: Number(year), maxPoints: Number(maxPoints) });

    await settings.save();
    res.status(200).json(settings.yearlyMaxKpi);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getYearlyIncrement = async (req, res) => {
  try {
    const year  = parseInt(req.query.year) || new Date().getFullYear();
    const start = new Date(year, 0, 1);
    const end   = new Date(year + 1, 0, 1);

    const settings = await Settings.findOne({ name: 'GlobalSettings' });
    const yearConfig = settings?.yearlyMaxKpi?.find(e => e.year === year);
    const maxPoints = yearConfig?.maxPoints || YEARLY_MAX_POINTS_FALLBACK;

    const agg = await KpiRecord.aggregate([
      { $match: { date: { $gte: start, $lt: end }, points: { $gt: 0 } } },
      { $group: { _id: '$employeeId', yearlyPoints: { $sum: '$points' } } }
    ]);

    const ids   = agg.map(a => a._id);
    const users = await User.find({ _id: { $in: ids }, isActive: 'Active' })
      .select('name employeeId role designation department salaryStructure');
    const userMap = Object.fromEntries(users.map(u => [u._id.toString(), u]));

    const result = agg.map(a => {
      const u = userMap[a._id.toString()];
      if (!u) return null;
      const pct = Math.round((a.yearlyPoints / maxPoints) * 100);
      let increment = 'No Increment';
      let bonus = false;
      if      (pct >= 95) { increment = '21%–25%'; bonus = true; }
      else if (pct >= 90) { increment = '20%'; }
      else if (pct >= 80) { increment = '15%–19%'; }
      else if (pct >= 70) { increment = '11%–14%'; }
      else if (pct >= 60) { increment = '10%'; }
      return {
        _id: a._id,
        name: u.name,
        employeeId: u.employeeId,
        role: u.role,
        department: u.department,
        baseSalary: u.salaryStructure?.baseSalary || 0,
        yearlyPoints: a.yearlyPoints,
        kpiPercentage: pct,
        increment,
        bonus
      };
    }).filter(Boolean).sort((a, b) => b.kpiPercentage - a.kpiPercentage);

    res.status(200).json({ year, maxPoints, employees: result });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  manageKpi,
  getKpiHistory,
  getLeaderboard,
  getMonthlyLeaderboard,
  getEmployeeOfMonth,
  getEmployeeOfYear,
  getYearlyIncrement,
  autoCalculateKpi,
  getYearlyMaxKpi,
  setYearlyMaxKpi
};
