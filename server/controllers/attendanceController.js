const Attendance = require('../models/Attendance');
const Settings = require('../models/Settings');
const WFHRequest = require('../models/WFHRequest');
const { isWithinRadius } = require('../utils/geolocation');
const { startScreenSession, stopScreenSession } = require('./screenTimeController');
const { autoCalculateKpi } = require('./kpiController');

// @desc    Check-in for today
// @route   POST /api/attendance/check-in
// @access  Private (Employee)
exports.checkIn = async (req, res) => {
  try {
    const { latitude, longitude } = req.body || {};
    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ message: 'latitude and longitude are required for check-in' });
    }

    const today = new Date().toISOString().split('T')[0];
    const existing = await Attendance.findOne({ user: req.user._id, date: today });

    if (existing && existing.checkIn) {
      return res.status(400).json({ message: 'Already checked in today' });
    }

    const checkInTime = new Date();

    // Late threshold: 10:15 AM IST
    // Use explicit IST offset (+5:30) to be timezone-safe regardless of server location
    const nowIST = new Date(checkInTime.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const lateThresholdIST = new Date(nowIST);
    lateThresholdIST.setHours(10, 15, 0, 0);

    let status = 'Present';
    if (nowIST > lateThresholdIST) {
      status = 'Late';
    }

    const settings = await Settings.findOne({ name: 'GlobalSettings' });
    const defaultZone = settings?.geofenceZones?.find(
      (z) => settings.defaultZoneId && z._id.toString() === settings.defaultZoneId.toString()
    );

    const officeLocation = defaultZone || settings?.officeLocation;
    const isGeofenceEnabled = !!(
      officeLocation &&
      Number(officeLocation.radius) > 0 &&
      Number.isFinite(Number(officeLocation.latitude)) &&
      Number.isFinite(Number(officeLocation.longitude))
    );
    let geofenceMeta = { validated: false };

    if (!isGeofenceEnabled) {
      return res.status(403).json({
        message: 'Check-in is disabled until Admin/AGM configures a geofence zone.',
        geofence: {
          validated: false,
          configured: false
        }
      });
    }

    if (isGeofenceEnabled) {
      const officeCheck = isWithinRadius(
        { latitude, longitude },
        { latitude: officeLocation.latitude, longitude: officeLocation.longitude },
        officeLocation.radius
      );

      geofenceMeta = {
        validated: true,
        mode: 'OFFICE',
        distanceMeters: Math.round(officeCheck.distanceMeters),
        allowedRadius: Number(officeLocation.radius),
        isWithinRadius: officeCheck.isInside
      };

      if (!officeCheck.isInside) {
        const activeWFH = await WFHRequest.findOne({
          user: req.user._id,
          status: 'APPROVED',
          fromDate: { $lte: today },
          toDate: { $gte: today }
        }).sort({ reviewedAt: -1 });

        if (!activeWFH) {
          return res.status(403).json({
            message: `You are ${Math.round(officeCheck.distanceMeters)}m away from office location. Check-in denied.`,
            geofence: geofenceMeta
          });
        }

        const wfhCheck = isWithinRadius(
          { latitude, longitude },
          { latitude: activeWFH.latitude, longitude: activeWFH.longitude },
          activeWFH.approvedRadius || 100
        );
        geofenceMeta = {
          validated: true,
          mode: 'WFH',
          requestId: activeWFH._id,
          distanceMeters: Math.round(wfhCheck.distanceMeters),
          allowedRadius: Number(activeWFH.approvedRadius || 100),
          isWithinRadius: wfhCheck.isInside
        };

        if (!wfhCheck.isInside) {
          return res.status(403).json({
            message: `Outside approved WFH range by ${Math.round(wfhCheck.distanceMeters)}m. Check-in denied.`,
            geofence: geofenceMeta
          });
        }
      }
    }

    if (existing) {
      existing.checkIn = checkInTime;
      existing.status = status;
      existing.note = geofenceMeta.validated
        ? `Check-in validated by ${geofenceMeta.mode} geofence`
        : existing.note;
      await existing.save();
      await startScreenSession(req.user._id, today);
      const recordObj = existing.toObject();
      recordObj.geofence = geofenceMeta;
      return res.status(200).json(recordObj);
    }

    const attendance = await Attendance.create({
      user: req.user._id,
      date: today,
      checkIn: checkInTime,
      status: status,
      note: geofenceMeta.validated ? `Check-in validated by ${geofenceMeta.mode} geofence` : undefined
    });

    await startScreenSession(req.user._id, today);
    const attendanceObj = attendance.toObject();
    attendanceObj.geofence = geofenceMeta;
    res.status(201).json(attendanceObj);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Check-out for today
// @route   POST /api/attendance/check-out
// @access  Private (Employee)
exports.checkOut = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const attendance = await Attendance.findOne({ user: req.user._id, date: today });

    if (!attendance || !attendance.checkIn) {
      return res.status(400).json({ message: 'No check-in record found for today' });
    }

    if (attendance.checkOut) {
      return res.status(400).json({ message: 'Already checked out today' });
    }

    attendance.checkOut = new Date();
    
    // Calculate total hours
    const diff = attendance.checkOut - attendance.checkIn;
    const hours = diff / (1000 * 60 * 60);
    attendance.totalHours = parseFloat(hours.toFixed(2));

    // Handle minor shortfalls (>= 8.5) and half-days
    // Preserve the original Late status — only override if truly a half-day
    const wasLate = attendance.status === 'Late';
    if (attendance.totalHours >= 8.5) {
      if (wasLate) {
        // Waiver: completed full hours despite being late
        attendance.status = 'Present';
        attendance.note = (attendance.note ? attendance.note + ' | ' : '') + 'Late waived: completed full hours';
      }
      // else: status stays Present — no change needed
    } else {
      // Less than 8.5h worked
      if (wasLate) {
        // Keep Late AND note the shortfall — don't overwrite to Half-day
        attendance.note = (attendance.note ? attendance.note + ' | ' : '') + 'Short hours but marked Late';
      } else {
        attendance.status = 'Half-day';
        attendance.note = (attendance.note ? attendance.note + ' | ' : '') + 'Half-day due to shortfall in hours';
      }
    }

    await attendance.save();
    await stopScreenSession(req.user._id, today);
    // Auto-calculate punctuality & working hours KPI
    const kpiAwarded = await autoCalculateKpi(req.user._id, attendance);
    // Return attendance + any KPI points awarded so frontend can show celebration
    res.status(200).json({ ...attendance.toObject(), kpiAwarded });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get current user's attendance history
// @route   GET /api/attendance/my-history
// @access  Private
exports.getMyHistory = async (req, res) => {
  try {
    const history = await Attendance.find({ user: req.user._id }).sort({ date: -1 });
    res.status(200).json(history);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all employees' attendance for a specific date (Admin/HR)
// @route   GET /api/attendance/all
// @access  Private (Admin/HR)
exports.getAllAttendance = async (req, res) => {
  try {
    const { date, userId } = req.query;
    let query = {};
    if (date) query.date = date;
    if (userId) query.user = userId;

    const history = await Attendance.find(query)
      .populate('user', 'name email employeeId designation')
      .sort({ date: -1 });
    res.status(200).json(history);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get current user's today attendance
// @route   GET /api/attendance/today
// @access  Private
exports.getTodayRecord = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const attendance = await Attendance.findOne({ user: req.user._id, date: today });
    res.status(200).json(attendance ? [attendance] : []);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get monthly attendance for a user
// @route   GET /api/attendance/monthly/:year/:month
// @access  Private
exports.getMonthlyAttendance = async (req, res) => {
  try {
    const { year, month } = req.params;
    const { userId } = req.query;
    const targetUserId = userId || req.user._id;

    const datePrefix = `${year}-${month.toString().padStart(2, '0')}`;
    const records = await Attendance.find({
      user: targetUserId,
      date: { $regex: `^${datePrefix}` }
    }).sort({ date: 1 });

    res.status(200).json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update attendance status manually (Admin/HR)
// @route   PATCH /api/attendance/status
// @access  Private (Admin/HR)
exports.updateAttendanceStatus = async (req, res) => {
  try {
    const { userId, date, status, note } = req.body;
    
    let record = await Attendance.findOne({ user: userId, date });
    
    if (record) {
      record.status = status;
      if (note) record.note = note;
      await record.save();
    } else {
      record = await Attendance.create({
        user: userId,
        date,
        status,
        note: note || 'Manually set by HR'
      });
    }
    
    res.status(200).json(record);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get team attendance dashboard data
// @route   GET /api/attendance/team-dashboard
// @access  Private (HR, Admin, AGM, SuperAdmin)
exports.getTeamAttendanceDashboard = async (req, res) => {
  try {
    const {
      date,
      startDate,
      endDate,
      department,
      search,
      status
    } = req.query;

    // Build date filter
    let dateFilter = {};
    if (date) {
      dateFilter.date = date;
    } else if (startDate && endDate) {
      dateFilter.date = {
        $gte: startDate,
        $lte: endDate
      };
    } else {
      // Default to today
      dateFilter.date = new Date().toISOString().split('T')[0];
    }

    // If department filter is set, resolve matching user IDs first
    // (populate with match silently nullifies non-matching users causing wrong stats)
    let userIdFilter = null;
    if (department && department !== 'all') {
      const User = require('../models/User');
      const usersInDept = await User.find({ department }).select('_id');
      userIdFilter = usersInDept.map(u => u._id);
    }

    // Build base attendance query
    let attendanceQuery = Attendance.find(dateFilter);

    // Apply user ID filter from department pre-lookup
    if (userIdFilter !== null) {
      attendanceQuery = attendanceQuery.where('user').in(userIdFilter);
    }

    if (status && status !== 'all') {
      attendanceQuery = attendanceQuery.where('status').equals(status);
    }

    const attendanceRecords = await attendanceQuery
      .populate('user', 'name employeeId department designation')
      .sort({ date: -1 });

    // Filter by employee name if search is provided
    let filteredRecords = attendanceRecords;
    if (search && search.trim()) {
      filteredRecords = attendanceRecords.filter(record => {
        const userName = record.user?.name || '';
        return userName.toLowerCase().includes(search.toLowerCase());
      });
    }

    // Remove records where user population failed (department filter)
    filteredRecords = filteredRecords.filter(record => record.user);

    // Calculate summary statistics
    const summary = {
      totalPresent: filteredRecords.filter(r => r.status === 'Present').length,
      totalAbsent: filteredRecords.filter(r => r.status === 'Absent').length,
      totalLate: filteredRecords.filter(r => r.status === 'Late').length,
      totalOvertimeHours: 0
    };

    // Calculate overtime (using 09:00-18:00 as default shift)
    filteredRecords.forEach(record => {
      if (record.checkIn && record.checkOut) {
        const checkIn = new Date(record.checkIn);
        const checkOut = new Date(record.checkOut);
        const shiftEnd = new Date(checkIn);
        shiftEnd.setHours(18, 0, 0, 0); // 18:00 fallback

        if (checkOut > shiftEnd) {
          const overtimeMs = checkOut - shiftEnd;
          const overtimeHours = overtimeMs / (1000 * 60 * 60);
          summary.totalOvertimeHours += overtimeHours;
        }
      }
    });

    res.status(200).json({
      attendance: filteredRecords,
      summary
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get today's attendance for manager's team
// @route   GET /api/attendance/team-today
// @access  Private (Manager, HR, Admin, AGM, SuperAdmin)
exports.getTeamTodayAttendance = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const User = require('../models/User');

    // Manager sees only their department; others see all
    const userQuery = req.user.role === 'Manager'
      ? { department: req.user.department, _id: { $ne: req.user._id } }
      : {};

    const teamMembers = await User.find(userQuery).select('_id name employeeId designation department');
    const memberIds = teamMembers.map(m => m._id);

    const records = await Attendance.find({ user: { $in: memberIds }, date: today })
      .populate('user', 'name employeeId designation department');

    // Build result: checked-in members + not-checked-in members
    const checkedInIds = new Set(records.map(r => r.user._id.toString()));
    const notCheckedIn = teamMembers
      .filter(m => !checkedInIds.has(m._id.toString()))
      .map(m => ({ user: m, checkIn: null, checkOut: null, status: 'Absent' }));

    res.status(200).json([...records, ...notCheckedIn]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  checkIn: exports.checkIn,
  checkOut: exports.checkOut,
  getMyHistory: exports.getMyHistory,
  getAllAttendance: exports.getAllAttendance,
  getMonthlyAttendance: exports.getMonthlyAttendance,
  getTodayRecord: exports.getTodayRecord,
  updateAttendanceStatus: exports.updateAttendanceStatus,
  getTeamAttendanceDashboard: exports.getTeamAttendanceDashboard,
  getTeamTodayAttendance: exports.getTeamTodayAttendance
};
