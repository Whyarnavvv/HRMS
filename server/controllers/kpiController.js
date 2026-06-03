const User = require('../models/User');
const KpiRecord = require('../models/KpiRecord');
const Settings = require('../models/Settings');

// ─── IST Timezone Helper ──────────────────────────────────────────────────────
// Converts a UTC Date object to its IST equivalent Date object
// so that .getHours()/.getMinutes() return IST values correctly.
const toIST = (date) => {
  return new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
};

// ─── Punctuality KPI ─────────────────────────────────────────────────────────
//
// Full-day employees (Reporting Time: 10:15 AM IST)
//   Check-in ≤ 10:15 AM  → 4.0 pts
//   Check-in ≤ 10:30 AM  → 3.5 pts
//   Check-in ≤ 10:45 AM  → 3.0 pts
//   Check-in ≤ 11:00 AM  → 2.5 pts
//   Check-in >  11:00 AM → 0 pts
//
// Half-day employees (Reporting Time: 2:30 PM IST)
//   Check-in ≤ 14:30     → 2.0 pts
//   Check-in >  14:30    → 0 pts
//
// NOTE: checkInDate must be an IST-equivalent Date (use toIST() before calling)
const calcPunctualityKpi = (checkInDate, isHalfDay) => {
  const h   = checkInDate.getHours();
  const m   = checkInDate.getMinutes();
  const min = h * 60 + m; // minutes since midnight in IST

  if (isHalfDay) {
    // Half-day: on or before 2:30 PM IST
    const deadline = 14 * 60 + 30; // 14:30
    return min <= deadline ? 2.0 : 0;
  }

  // Full-day brackets
  const t1015 = 10 * 60 + 15;
  const t1030 = 10 * 60 + 30;
  const t1045 = 10 * 60 + 45;
  const t1100 = 11 * 60;

  if (min <= t1015) return 4.0;
  if (min <= t1030) return 3.5;
  if (min <= t1045) return 3.0;
  if (min <= t1100) return 2.5;
  return 0;
};

// ─── Working Hours KPI ────────────────────────────────────────────────────────
//
// Full-day employees (Required: 8h 45m = 525 min)
//   working ≥ 525 min   → 4.0 pts
//   working < 525 min   → proportionally scaled from 4.0 → 1.0
//   Formula: pts = 1.0 + (3.0 × workedMin / 525)  [floor to 1 decimal, never rounds up]
//   i.e.  at 525 min → 1.0 + 3.0 = 4.0
//         at 0   min → 0 (never negative)
//
// Half-day employees (Required: 4h 30m = 270 min)
//   working ≥ 270 min   → 2.0 pts
//   working < 270 min   → proportionally scaled: pts = 2.0 × workedMin / 270
//   floor to 1 decimal, never rounds up
//
// NOTE: Math.floor(pts * 10) / 10 is used instead of parseFloat(pts.toFixed(1))
// because toFixed() uses banker's rounding and can round 3.994 → "4.0".
// floor ensures values like 8h44m (3.994) correctly become 3.9, never 4.0.
const calcWorkingHoursKpi = (totalHours, isHalfDay) => {
  const workedMin  = Math.round(totalHours * 60);

  if (isHalfDay) {
    const required = 4 * 60 + 30; // 270 min = 4h30m
    if (workedMin >= required) return 2.0;
    const pts = (2.0 * workedMin) / required;
    return Math.max(0, Math.floor(pts * 10) / 10);
  }

  const required = 8 * 60 + 45; // 525 min = 8h45m
  if (workedMin >= required) return 4.0;
  // Proportional: 1.0 base + 3.0 proportional component
  const pts = 1.0 + (3.0 * workedMin / required);
  return Math.max(0, Math.floor(pts * 10) / 10);
};

// ─── Auto-KPI (called from attendanceController after checkout) ───────────────
// Returns array of awarded KPI objects so the API response can include them.
const autoCalculateKpi = async (userId, attendanceRecord) => {
  try {
    const { checkIn, checkOut, totalHours, date } = attendanceRecord;
    if (!checkIn || !checkOut) return [];

    const dateObj  = new Date(date + 'T00:00:00');
    const dayStart = new Date(date + 'T00:00:00');
    const dayEnd   = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    // Prevent duplicate auto-KPI for the same date
    const existing = await KpiRecord.findOne({
      employeeId: userId,
      date: { $gte: dayStart, $lt: dayEnd },
      autoKpi: true
    });
    if (existing) return [];

    // Convert check-in to IST to read hours/minutes correctly regardless of server timezone
    const checkInIST = toIST(new Date(checkIn));

    // Determine if this is a half-day shift using the attendance status flag
    // that the checkOut handler already set reliably (status === 'Half-day').
    // This is more accurate than a totalHours threshold because it correctly
    // handles the exact 4h30m boundary and any manual overrides by HR.
    const isHalfDay = attendanceRecord.status === 'Half-day';

    const punctualityPts  = calcPunctualityKpi(checkInIST, isHalfDay);
    const workingHoursPts = calcWorkingHoursKpi(totalHours, isHalfDay);

    const awarded = [];

    // Award punctuality KPI
    if (punctualityPts > 0) {
      const checkInStr = checkInIST.toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', hour12: true
      });
      const reason = isHalfDay
        ? `Half-day check-in at ${checkInStr} IST — Punctuality KPI (Auto)`
        : `Check-in at ${checkInStr} IST — Punctuality KPI (Auto)`;

      await KpiRecord.create({
        employeeId: userId,
        assignedBy: userId,
        date: dateObj,
        points: punctualityPts,
        reason,
        autoKpi: true,
        kpiType: 'punctuality'
      });
      await User.findByIdAndUpdate(userId, {
        $inc: { totalKpi: punctualityPts, totalAdded: punctualityPts }
      });
      awarded.push({ points: punctualityPts, reason, kpiType: 'punctuality' });
    }

    // Award working hours KPI
    if (workingHoursPts > 0) {
      const reason = `Worked ${totalHours}h — Working Hours KPI (Auto)`;
      await KpiRecord.create({
        employeeId: userId,
        assignedBy: userId,
        date: dateObj,
        points: workingHoursPts,
        reason,
        autoKpi: true,
        kpiType: 'working_hours'
      });
      await User.findByIdAndUpdate(userId, {
        $inc: { totalKpi: workingHoursPts, totalAdded: workingHoursPts }
      });
      awarded.push({ points: workingHoursPts, reason, kpiType: 'working_hours' });
    }

    return awarded;
  } catch (err) {
    console.error('autoCalculateKpi error:', err.message);
    return [];
  }
};

// ─── Manual KPI Management ───────────────────────────────────────────────────
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
    if (Number(points) > 0) employee.totalAdded  += Number(points);
    else                    employee.totalDeducted += Math.abs(Number(points));
    await employee.save();

    res.status(201).json({ message: 'KPI updated successfully', kpiRecord, totalKpi: employee.totalKpi });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── KPI History ─────────────────────────────────────────────────────────────
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

// ─── All-time Leaderboard ─────────────────────────────────────────────────────
const getLeaderboard = async (req, res) => {
  try {
    const leaderboard = await User.find({ isActive: 'Active', role: { $ne: 'SuperAdmin' } })
      .select('name role totalKpi totalAdded totalDeducted profilePic designation employeeId department')
      .sort({ totalKpi: -1 });
    res.status(200).json(leaderboard);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Monthly Leaderboard ─────────────────────────────────────────────────────
// Returns rank, name, totalKPI for month, averageKPI per working day
const getMonthlyLeaderboard = async (req, res) => {
  try {
    const now   = new Date();
    const month = parseInt(req.query.month) || (now.getMonth() + 1);
    const year  = parseInt(req.query.year)  || now.getFullYear();

    const start = new Date(year, month - 1, 1);
    const end   = new Date(year, month,     1);

    // Aggregate total points per employee for the period
    const agg = await KpiRecord.aggregate([
      { $match: { date: { $gte: start, $lt: end }, points: { $gt: 0 } } },
      {
        $group: {
          _id:           '$employeeId',
          totalPoints:   { $sum: '$points' },
          recordCount:   { $sum: 1 }       // number of KPI records (attendance days)
        }
      },
      { $sort: { totalPoints: -1 } }
    ]);

    const ids   = agg.map(a => a._id);
    const users = await User.find({ _id: { $in: ids }, isActive: 'Active' })
      .select('name role designation profilePic employeeId department');
    const userMap = Object.fromEntries(users.map(u => [u._id.toString(), u]));

    const result = agg.map((a, i) => {
      const u = userMap[a._id.toString()];
      if (!u) return null;
      // Average = totalPoints / number of days with auto-KPI records
      const avgKpi = a.recordCount > 0
        ? parseFloat((a.totalPoints / a.recordCount).toFixed(2))
        : 0;
      return {
        rank:        i + 1,
        _id:         a._id,
        name:        u.name,
        role:        u.role,
        designation: u.designation,
        department:  u.department,
        employeeId:  u.employeeId,
        profilePic:  u.profilePic,
        totalKpi:    parseFloat(a.totalPoints.toFixed(2)),
        averageKpi:  avgKpi,
        monthlyPoints: parseFloat(a.totalPoints.toFixed(2)) // backward compat alias
      };
    }).filter(Boolean);

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Yearly Leaderboard ───────────────────────────────────────────────────────
// Returns rank, name, totalKPI for year, averageKPI per working day
const getYearlyLeaderboard = async (req, res) => {
  try {
    const year  = parseInt(req.query.year) || new Date().getFullYear();
    const start = new Date(year,     0, 1);
    const end   = new Date(year + 1, 0, 1);

    const agg = await KpiRecord.aggregate([
      { $match: { date: { $gte: start, $lt: end }, points: { $gt: 0 } } },
      {
        $group: {
          _id:         '$employeeId',
          totalPoints: { $sum: '$points' },
          recordCount: { $sum: 1 }
        }
      },
      { $sort: { totalPoints: -1 } }
    ]);

    const ids   = agg.map(a => a._id);
    const users = await User.find({ _id: { $in: ids }, isActive: 'Active' })
      .select('name role designation profilePic employeeId department');
    const userMap = Object.fromEntries(users.map(u => [u._id.toString(), u]));

    const result = agg.map((a, i) => {
      const u = userMap[a._id.toString()];
      if (!u) return null;
      const avgKpi = a.recordCount > 0
        ? parseFloat((a.totalPoints / a.recordCount).toFixed(2))
        : 0;
      return {
        rank:        i + 1,
        _id:         a._id,
        name:        u.name,
        role:        u.role,
        designation: u.designation,
        department:  u.department,
        employeeId:  u.employeeId,
        profilePic:  u.profilePic,
        totalKpi:    parseFloat(a.totalPoints.toFixed(2)),
        averageKpi:  avgKpi,
        yearlyPoints: parseFloat(a.totalPoints.toFixed(2)) // backward compat alias
      };
    }).filter(Boolean);

    res.status(200).json({ year, employees: result });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Employee KPI Dashboard (self-service) ────────────────────────────────────
// Employees can view their own KPI stats, ranks, and period breakdowns.
// Admins/HR can view any employee's dashboard by passing ?employeeId=
const getMyKpiDashboard = async (req, res) => {
  try {
    const mongoose     = require('mongoose');
    const requestedId  = req.query.employeeId;
    const isPrivileged = ['Admin', 'HR', 'AGM', 'SuperAdmin'].includes(req.user.role);

    // Employees can only view their own dashboard
    const rawId   = (isPrivileged && requestedId) ? requestedId : req.user._id.toString();
    const targetOid = new mongoose.Types.ObjectId(rawId);

    const now       = new Date();
    const thisMonth = now.getMonth() + 1;
    const thisYear  = now.getFullYear();

    const qMonth = parseInt(req.query.month) || thisMonth;
    const qYear  = parseInt(req.query.year)  || thisYear;

    // Build all date ranges up front
    const curMonthStart  = new Date(thisYear, thisMonth - 1, 1);
    const curMonthEnd    = new Date(thisYear, thisMonth,     1);
    const prevMonthStart = new Date(thisYear, thisMonth - 2, 1);
    const prevMonthEnd   = new Date(thisYear, thisMonth - 1, 1);
    const selMonthStart  = new Date(qYear, qMonth - 1, 1);
    const selMonthEnd    = new Date(qYear, qMonth,     1);
    const yearStart      = new Date(thisYear, 0, 1);
    const yearEnd        = new Date(thisYear + 1, 0, 1);
    const selYearStart   = new Date(qYear, 0, 1);
    const selYearEnd     = new Date(qYear + 1, 0, 1);

    // Sum all KPI points earned in a period for this employee
    const sumPoints = async (start, end) => {
      const agg = await KpiRecord.aggregate([
        { $match: { employeeId: targetOid, date: { $gte: start, $lt: end } } },
        { $group: { _id: null, total: { $sum: '$points' }, count: { $sum: 1 } } }
      ]);
      return { total: agg[0]?.total || 0, count: agg[0]?.count || 0 };
    };

    // Get this employee's rank for a period (only counting positive points)
    const getRank = async (start, end) => {
      const allAgg = await KpiRecord.aggregate([
        { $match: { date: { $gte: start, $lt: end }, points: { $gt: 0 } } },
        { $group: { _id: '$employeeId', totalPoints: { $sum: '$points' } } },
        { $sort: { totalPoints: -1 } }
      ]);
      const rank = allAgg.findIndex(a => a._id.toString() === rawId) + 1;
      return rank > 0 ? rank : null;
    };

    const [curMonth, prevMonth, selMonth, curYear, selYear, monthRank, yearRank] = await Promise.all([
      sumPoints(curMonthStart,  curMonthEnd),
      sumPoints(prevMonthStart, prevMonthEnd),
      sumPoints(selMonthStart,  selMonthEnd),
      sumPoints(yearStart,      yearEnd),
      sumPoints(selYearStart,   selYearEnd),
      getRank(curMonthStart,    curMonthEnd),
      getRank(yearStart,        yearEnd)
    ]);

    res.status(200).json({
      employeeId:       rawId,
      currentMonthKpi:  parseFloat(curMonth.total.toFixed(2)),
      previousMonthKpi: parseFloat(prevMonth.total.toFixed(2)),
      selectedMonthKpi: parseFloat(selMonth.total.toFixed(2)),
      currentYearKpi:   parseFloat(curYear.total.toFixed(2)),
      selectedYearKpi:  parseFloat(selYear.total.toFixed(2)),
      monthlyRank:      monthRank,
      yearlyRank:       yearRank,
      selectedMonth:    qMonth,
      selectedYear:     qYear
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Employee of the Month ───────────────────────────────────────────────────
const getEmployeeOfMonth = async (req, res) => {
  try {
    const now   = new Date();
    const month = parseInt(req.query.month) || (now.getMonth() + 1);
    const year  = parseInt(req.query.year)  || now.getFullYear();
    const start = new Date(year, month - 1, 1);
    const end   = new Date(year, month,     1);

    const agg = await KpiRecord.aggregate([
      { $match: { date: { $gte: start, $lt: end }, points: { $gt: 0 } } },
      { $group: { _id: '$employeeId', monthlyPoints: { $sum: '$points' } } },
      { $sort: { monthlyPoints: -1 } },
      { $limit: 1 }
    ]);

    if (!agg.length) return res.status(200).json(null);

    const user = await User.findById(agg[0]._id)
      .select('name role designation profilePic employeeId department');
    res.status(200).json({
      ...user.toObject(),
      monthlyPoints: parseFloat(agg[0].monthlyPoints.toFixed(2)),
      month,
      year
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Employee of the Year ────────────────────────────────────────────────────
const getEmployeeOfYear = async (req, res) => {
  try {
    const year  = parseInt(req.query.year) || new Date().getFullYear();
    const start = new Date(year,     0, 1);
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
    res.status(200).json({
      ...user.toObject(),
      yearlyPoints: parseFloat(agg[0].yearlyPoints.toFixed(2)),
      year
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Yearly Max KPI Settings ──────────────────────────────────────────────────
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

// ─── Yearly Increment Calculation ────────────────────────────────────────────
const getYearlyIncrement = async (req, res) => {
  try {
    const year  = parseInt(req.query.year) || new Date().getFullYear();
    const start = new Date(year,     0, 1);
    const end   = new Date(year + 1, 0, 1);

    const settings  = await Settings.findOne({ name: 'GlobalSettings' });
    const yearConfig = settings?.yearlyMaxKpi?.find(e => e.year === year);
    const maxPoints  = yearConfig?.maxPoints || YEARLY_MAX_POINTS_FALLBACK;

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
      let bonus     = false;
      if      (pct >= 95) { increment = '21%–25%'; bonus = true; }
      else if (pct >= 90) { increment = '20%'; }
      else if (pct >= 80) { increment = '15%–19%'; }
      else if (pct >= 70) { increment = '11%–14%'; }
      else if (pct >= 60) { increment = '10%'; }
      return {
        _id:          a._id,
        name:         u.name,
        employeeId:   u.employeeId,
        role:         u.role,
        department:   u.department,
        baseSalary:   u.salaryStructure?.baseSalary || 0,
        yearlyPoints: parseFloat(a.yearlyPoints.toFixed(2)),
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
  getYearlyLeaderboard,
  getMyKpiDashboard,
  getEmployeeOfMonth,
  getEmployeeOfYear,
  getYearlyIncrement,
  autoCalculateKpi,
  getYearlyMaxKpi,
  setYearlyMaxKpi
};
