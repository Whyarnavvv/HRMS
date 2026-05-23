const CounsellingLog = require('../models/CounsellingLog');

// @desc    Submit a counselling log
// @route   POST /api/counselling
// @access  Private (Counselling Team)
exports.createLog = async (req, res) => {
  try {
    const { phoneNumber, callSummary, remarks } = req.body;
    if (!phoneNumber || !callSummary)
      return res.status(400).json({ message: 'Phone number and call summary are required' });

    const log = await CounsellingLog.create({
      submittedBy: req.user._id,
      phoneNumber,
      callSummary,
      remarks,
      screenshotFilename: req.file?.filename || null
    });
    return res.status(201).json(log);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get all counselling logs (SuperAdmin only)
// @route   GET /api/counselling
// @access  Private (SuperAdmin)
exports.getLogs = async (req, res) => {
  try {
    const logs = await CounsellingLog.find()
      .populate('submittedBy', 'name email employeeId')
      .sort({ createdAt: -1 });
    return res.status(200).json(logs);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get own counselling logs (Counselling Team)
// @route   GET /api/counselling/my
// @access  Private (Counselling Team)
exports.getMyLogs = async (req, res) => {
  try {
    const logs = await CounsellingLog.find({ submittedBy: req.user._id })
      .sort({ createdAt: -1 });
    return res.status(200).json(logs);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
