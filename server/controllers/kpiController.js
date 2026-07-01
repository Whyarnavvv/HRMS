const User = require('../models/User');
const KpiRecord = require('../models/KpiRecord');
const Settings = require('../models/Settings');
const { sendEmail } = require('../utils/emailService');

// Alert recipient for duplicate KPI events
const DUPLICATE_KPI_ALERT_EMAIL = 'adityakeshav108@gmail.com';

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
//
// IDEMPOTENCY DESIGN (fixes race-condition duplicate bug):
// ─────────────────────────────────────────────────────────
// The old implementation used a single read-then-write guard:
//   findOne(autoKpi:true, date=today) → if found, skip
// This has two race windows:
//   1. Two simultaneous checkOut requests both pass the guard before either
//      inserts, producing 2× punctuality + 2× working_hours records.
//   2. A second call arriving between the two sequential inserts (punctuality
//      first, then working_hours) finds punctuality already there and bails,
//      but a third concurrent call can still sneak in for working_hours.
//
// Fix: use findOneAndUpdate + upsert:true on a per-(employeeId, kpiType, date)
// filter instead of a separate create.  MongoDB's atomic upsert guarantees
// exactly-once insertion at the document level for each KPI type separately.
// If the document already exists (duplicate call), the upsert is a no-op and
// `upsertedCount` is 0, so we skip the User $inc.
//
// The date stored on the filter uses the plain YYYY-MM-DD string (dateStr) as
// an exact equality match on the ISO-midnight UTC Date — the same value that
// every insert uses — so the filter is always precise.
const autoCalculateKpi = async (userId, attendanceRecord) => {
  try {
    const { checkIn, checkOut, totalHours, date } = attendanceRecord;
    if (!checkIn || !checkOut) return [];

    // date is a 'YYYY-MM-DD' string (UTC-based, from toISOString().split('T')[0])
    // Storing as midnight UTC keeps it consistent with every existing record.
    const dateObj = new Date(date + 'T00:00:00.000Z');

    // Convert check-in to IST to read hours/minutes correctly regardless of
    // server timezone.
    const checkInIST = toIST(new Date(checkIn));

    // Determine half-day from the status flag set by checkOut handler.
    const isHalfDay = attendanceRecord.status === 'Half-day';

    const punctualityPts  = calcPunctualityKpi(checkInIST, isHalfDay);
    const workingHoursPts = calcWorkingHoursKpi(totalHours, isHalfDay);

    const awarded = [];

    // ── Helper: atomic upsert for one KPI type ────────────────────────────
    // Uses updateOne with upsert:true so that concurrent calls are serialised
    // by MongoDB — only the first one that wins the upsert creates the doc.
    // setOnInsert only writes the fields when the document is NEW; if it
    // already exists the update is a no-op and result.upsertedCount === 0.
    const awardKpi = async (kpiType, points, reason) => {
      if (points <= 0) return;

      const filter = {
        employeeId: userId,
        kpiType,
        date: dateObj,      // exact UTC-midnight Date — unique per day per type
        autoKpi: true
      };

      const result = await KpiRecord.updateOne(
        filter,
        {
          $setOnInsert: {
            employeeId: userId,
            assignedBy: userId,
            date:       dateObj,
            points,
            reason,
            autoKpi:   true,
            kpiType
          }
        },
        { upsert: true }
      );

      // upsertedCount === 1 means a new document was just created (first time).
      // If 0, the record already existed — skip the User $inc to avoid inflating totals.
      if (result.upsertedCount === 1) {
        await User.findByIdAndUpdate(userId, {
          $inc: { totalKpi: points, totalAdded: points }
        });
        awarded.push({ points, reason, kpiType });
      } else {
        // Duplicate blocked — fire an alert email so it can be investigated.
        // This runs async and does NOT block the checkout response.
        const employee = await User.findById(userId).select('name employeeId').lean();
        const dateLabel = dateObj.toLocaleDateString('en-IN', {
          day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata'
        });
        sendEmail({
          to: DUPLICATE_KPI_ALERT_EMAIL,
          subject: `⚠️ Duplicate KPI Blocked — ${employee?.name || userId} (${kpiType})`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;">
              <h2 style="color:#dc2626;margin-top:0;">⚠️ Duplicate Auto-KPI Attempt Blocked</h2>
              <p>A duplicate auto-KPI insertion was detected and blocked by the idempotency guard.</p>
              <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:16px;">
                <tr style="background:#f8fafc;">
                  <td style="padding:10px 14px;font-weight:700;color:#64748b;width:140px;">Employee</td>
                  <td style="padding:10px 14px;color:#1e293b;">${employee?.name || '(unknown)'}</td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;font-weight:700;color:#64748b;">Employee ID</td>
                  <td style="padding:10px 14px;color:#1e293b;">${employee?.employeeId || userId}</td>
                </tr>
                <tr style="background:#f8fafc;">
                  <td style="padding:10px 14px;font-weight:700;color:#64748b;">KPI Type</td>
                  <td style="padding:10px 14px;color:#1e293b;">${kpiType}</td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;font-weight:700;color:#64748b;">Points</td>
                  <td style="padding:10px 14px;color:#1e293b;">${points}</td>
                </tr>
                <tr style="background:#f8fafc;">
                  <td style="padding:10px 14px;font-weight:700;color:#64748b;">Date (IST)</td>
                  <td style="padding:10px 14px;color:#1e293b;">${dateLabel}</td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;font-weight:700;color:#64748b;">Reason</td>
                  <td style="padding:10px 14px;color:#1e293b;">${reason}</td>
                </tr>
                <tr style="background:#f8fafc;">
                  <td style="padding:10px 14px;font-weight:700;color:#64748b;">Detected at</td>
                  <td style="padding:10px 14px;color:#1e293b;">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</td>
                </tr>
              </table>
              <p style="margin-top:20px;font-size:13px;color:#64748b;">
                The KPI was <strong>NOT</strong> awarded — the existing record for this employee/type/date was kept intact.<br/>
                No points were added to the employee's total.<br/><br/>
                This alert is sent automatically by the HRMS duplicate-KPI guard.
              </p>
              <p style="color:#94a3b8;font-size:12px;margin-top:16px;">Study Palace Hub HRMS</p>
            </div>
          `
        }).catch(err => console.error('Duplicate KPI alert email failed:', err.message));
      }
    };

    // Award punctuality KPI (idempotent)
    if (punctualityPts > 0) {
      const checkInStr = checkInIST.toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', hour12: true
      });
      const reason = isHalfDay
        ? `Half-day check-in at ${checkInStr} IST — Punctuality KPI (Auto)`
        : `Check-in at ${checkInStr} IST — Punctuality KPI (Auto)`;
      await awardKpi('punctuality', punctualityPts, reason);
    }

    // Award working hours KPI (idempotent)
    if (workingHoursPts > 0) {
      const reason = `Worked ${totalHours}h — Working Hours KPI (Auto)`;
      await awardKpi('working_hours', workingHoursPts, reason);
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
//
// FALLBACK used when no fiscal-year config covers today's date and no legacy
// calendar-year config exists either.
const YEARLY_MAX_POINTS_FALLBACK = 2920;

// ── GET /api/kpi/yearly-max ───────────────────────────────────────────────────
// Returns the full yearlyMaxKpi array (all fiscal + legacy calendar entries).
// Frontend uses this to populate the saved-entries display.
const getYearlyMaxKpi = async (req, res) => {
  try {
    const settings = await Settings.findOne({ name: 'GlobalSettings' });
    res.status(200).json(settings?.yearlyMaxKpi || []);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── PUT /api/kpi/yearly-max ───────────────────────────────────────────────────
// Upserts a fiscal-year KPI config entry.
//
// Expected body (fiscal year):
//   { label: "April 2026 to March 2027", startDate: "2026-04-01",
//     endDate: "2027-04-01", workingDays: 310, maxPoints: 4960 }
//
// Legacy calendar-year body still accepted for backward compat:
//   { year: 2025, maxPoints: 2920 }
//
// Match key: fiscal entries matched by label; legacy entries matched by year.
const setYearlyMaxKpi = async (req, res) => {
  try {
    const { label, startDate, endDate, workingDays, year, maxPoints } = req.body;

    if (!maxPoints || Number(maxPoints) < 1) {
      return res.status(400).json({ message: 'Valid maxPoints is required' });
    }

    // Determine mode: fiscal (label provided) or legacy (year number provided)
    const isFiscal = !!(label && startDate && endDate);
    const isLegacy = !!(year && !label);

    if (!isFiscal && !isLegacy) {
      return res.status(400).json({
        message: 'Provide either { label, startDate, endDate, workingDays, maxPoints } for a fiscal year, ' +
                 'or { year, maxPoints } for a legacy calendar year.'
      });
    }

    let settings = await Settings.findOne({ name: 'GlobalSettings' });
    if (!settings) settings = await Settings.create({ name: 'GlobalSettings' });

    if (isFiscal) {
      const startD  = new Date(startDate);
      const endD    = new Date(endDate);

      if (isNaN(startD) || isNaN(endD) || endD <= startD) {
        return res.status(400).json({ message: 'startDate must be before endDate' });
      }

      // Upsert by label — allows re-saving to update maxPoints / workingDays
      const existing = settings.yearlyMaxKpi.find(e => e.label === label);
      if (existing) {
        existing.maxPoints    = Number(maxPoints);
        if (workingDays) existing.workingDays = Number(workingDays);
        existing.startDate    = startD;
        existing.endDate      = endD;
      } else {
        settings.yearlyMaxKpi.push({
          label,
          startDate:   startD,
          endDate:     endD,
          workingDays: workingDays ? Number(workingDays) : undefined,
          maxPoints:   Number(maxPoints)
        });
      }
    } else {
      // Legacy calendar-year path — untouched behaviour
      const existing = settings.yearlyMaxKpi.find(e => e.year === Number(year));
      if (existing) existing.maxPoints = Number(maxPoints);
      else settings.yearlyMaxKpi.push({ year: Number(year), maxPoints: Number(maxPoints) });
    }

    await settings.save();
    res.status(200).json(settings.yearlyMaxKpi);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /api/kpi/fiscal-years ─────────────────────────────────────────────────
// Returns only the fiscal-year entries (those with a label + startDate/endDate),
// sorted newest-first.  Used by the frontend label selector dropdown.
const getFiscalYears = async (req, res) => {
  try {
    const settings = await Settings.findOne({ name: 'GlobalSettings' });
    const fiscal = (settings?.yearlyMaxKpi || [])
      .filter(e => e.label && e.startDate && e.endDate)
      .sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    res.status(200).json(fiscal);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── Yearly Increment Calculation ────────────────────────────────────────────
//
// FISCAL-YEAR AWARE version.
//
// Resolution order for the period boundaries:
//   1. If ?label=  is supplied → look up the fiscal-year entry with that label
//      and use its startDate / endDate.
//   2. Else → find the fiscal-year entry whose startDate ≤ today < endDate
//      (i.e. the currently active fiscal year).
//   3. Else fallback: calendar year from ?year= param (legacy behaviour).
//
// The formula itself is UNCHANGED:
//   kpiPct = round(yearlyPoints / maxPoints × 100)
// Only the date window and the source of maxPoints change.
const getYearlyIncrement = async (req, res) => {
  try {
    const settings = await Settings.findOne({ name: 'GlobalSettings' });
    const allConfigs = settings?.yearlyMaxKpi || [];

    let start, end, maxPoints, periodLabel, workingDays;

    // ── Priority 1: explicit label param ─────────────────────────────────────
    if (req.query.label) {
      const cfg = allConfigs.find(e => e.label === req.query.label);
      if (!cfg) {
        return res.status(404).json({ message: `No KPI config found for label: ${req.query.label}` });
      }
      start        = new Date(cfg.startDate);
      end          = new Date(cfg.endDate);
      maxPoints    = cfg.maxPoints;
      workingDays  = cfg.workingDays;
      periodLabel  = cfg.label;

    // ── Priority 2: auto-detect active fiscal year ────────────────────────────
    } else {
      const today     = new Date();
      const activeCfg = allConfigs.find(e =>
        e.startDate && e.endDate &&
        new Date(e.startDate) <= today &&
        today < new Date(e.endDate)
      );

      if (activeCfg) {
        start        = new Date(activeCfg.startDate);
        end          = new Date(activeCfg.endDate);
        maxPoints    = activeCfg.maxPoints;
        workingDays  = activeCfg.workingDays;
        periodLabel  = activeCfg.label;

      // ── Priority 3: legacy calendar year (backward compat) ──────────────────
      } else {
        const year       = parseInt(req.query.year) || new Date().getFullYear();
        start            = new Date(year,     0, 1);
        end              = new Date(year + 1, 0, 1);
        const yearConfig = allConfigs.find(e => e.year === year);
        maxPoints        = yearConfig?.maxPoints || YEARLY_MAX_POINTS_FALLBACK;
        workingDays      = yearConfig?.workingDays;
        periodLabel      = String(year);
      }
    }

    // ── Aggregate KPI points within the resolved window ───────────────────────
    const agg = await KpiRecord.aggregate([
      { $match: { date: { $gte: start, $lt: end }, points: { $gt: 0 } } },
      { $group: { _id: '$employeeId', yearlyPoints: { $sum: '$points' } } }
    ]);

    const ids   = agg.map(a => a._id);
    const users = await User.find({ _id: { $in: ids }, isActive: 'Active' })
      .select('name employeeId role designation department salaryStructure');
    const userMap = Object.fromEntries(users.map(u => [u._id.toString(), u]));

    // ── Same increment bands as before — formula unchanged ────────────────────
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
        _id:           a._id,
        name:          u.name,
        employeeId:    u.employeeId,
        role:          u.role,
        department:    u.department,
        baseSalary:    u.salaryStructure?.baseSalary || 0,
        yearlyPoints:  parseFloat(a.yearlyPoints.toFixed(2)),
        kpiPercentage: pct,
        increment,
        bonus
      };
    }).filter(Boolean).sort((a, b) => b.kpiPercentage - a.kpiPercentage);

    res.status(200).json({
      periodLabel,
      maxPoints,
      workingDays:  workingDays || null,
      startDate:    start,
      endDate:      end,
      employees:    result
    });
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
  setYearlyMaxKpi,
  getFiscalYears
};
