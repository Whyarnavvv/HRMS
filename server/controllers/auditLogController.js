const AuditLog = require('../models/AuditLog');
const User = require('../models/User');

// @desc    List audit logs with filters
// @route   GET /api/audit-logs
// @access  Private (SuperAdmin)
exports.getAuditLogs = async (req, res) => {
  try {
    const {
      userId,
      department,
      action,
      module,
      fromDate,
      toDate,
      page = 1,
      limit = 20
    } = req.query;

    const query = {};

    // If filtering by department, resolve all userIds in that department first
    if (department) {
      const usersInDept = await User.find({ department }).select('_id');
      const ids = usersInDept.map(u => u._id);
      query.actorUserId = { $in: ids };
    }

    // userId overrides department-level filter
    if (userId) query.actorUserId = userId;

    if (action) query.action = { $regex: action, $options: 'i' };
    if (module) query.module = { $regex: module, $options: 'i' };
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));

    const [total, records] = await Promise.all([
      AuditLog.countDocuments(query),
      AuditLog.find(query)
        .populate('actorUserId', 'name email employeeId role department')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
    ]);

    return res.status(200).json({
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum),
      records
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get distinct departments that have audit log entries
// @route   GET /api/audit-logs/departments
// @access  Private (SuperAdmin)
exports.getAuditDepartments = async (req, res) => {
  try {
    const departments = await User.distinct('department', { department: { $ne: null, $exists: true } });
    return res.status(200).json(departments.filter(Boolean).sort());
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get users belonging to a department
// @route   GET /api/audit-logs/users-by-department?department=
// @access  Private (SuperAdmin)
exports.getUsersByDepartment = async (req, res) => {
  try {
    const { department } = req.query;
    const query = department ? { department } : {};
    const users = await User.find(query).select('_id name employeeId role department').sort({ name: 1 });
    return res.status(200).json(users);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
