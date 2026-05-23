const WFHRequest = require('../models/WFHRequest');

const getToday = () => new Date().toISOString().split('T')[0];

// Cleanup expired WFH geolocation records (approvedDate < today)
exports.cleanupExpiredWFHGeolocations = async () => {
  const today = getToday();
  await WFHRequest.updateMany(
    { status: 'APPROVED', approvedDate: { $lt: today }, latitude: { $exists: true } },
    { $unset: { latitude: '', longitude: '', address: '' } }
  );
};

// @desc    Create WFH request
// @route   POST /api/wfh-requests
// @access  Private (Employee)
exports.createWFHRequest = async (req, res) => {
  try {
    const { latitude, longitude, address, reason, date } = req.body;
    if (latitude === undefined || longitude === undefined || !reason || !date) {
      return res.status(400).json({ message: 'latitude, longitude, reason, and date are required' });
    }

    const request = await WFHRequest.create({
      user: req.user._id,
      latitude,
      longitude,
      address,
      reason,
      fromDate: date,
      toDate: date
    });

    return res.status(201).json(request);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get my WFH requests
// @route   GET /api/wfh-requests/my
// @access  Private
exports.getMyWFHRequests = async (req, res) => {
  try {
    const records = await WFHRequest.find({ user: req.user._id }).sort({ createdAt: -1 });
    return res.status(200).json(records);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get all WFH requests
// @route   GET /api/wfh-requests
// @access  Private (Admin/AGM/SuperAdmin)
exports.getAllWFHRequests = async (req, res) => {
  try {
    const { status, userId } = req.query;
    const query = {};
    if (status) query.status = status;
    if (userId) query.user = userId;
    const records = await WFHRequest.find(query)
      .populate('user', 'name email employeeId role')
      .populate('reviewedBy', 'name role')
      .sort({ createdAt: -1 });
    return res.status(200).json(records);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Approve WFH request
// @route   PATCH /api/wfh-requests/:id/approve
// @access  Private (Admin/AGM/SuperAdmin)
exports.approveWFHRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewNote, approvedRadius } = req.body;
    const record = await WFHRequest.findById(id);
    if (!record) {
      return res.status(404).json({ message: 'WFH request not found' });
    }

    record.status = 'APPROVED';
    record.reviewedBy = req.user._id;
    record.reviewedAt = new Date();
    record.reviewNote = reviewNote || '';
    record.approvedDate = record.fromDate; // single date
    if (approvedRadius !== undefined) record.approvedRadius = approvedRadius;
    await record.save();
    return res.status(200).json(record);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Reject WFH request
// @route   PATCH /api/wfh-requests/:id/reject
// @access  Private (Admin/AGM/SuperAdmin)
exports.rejectWFHRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewNote } = req.body;
    const record = await WFHRequest.findById(id);
    if (!record) {
      return res.status(404).json({ message: 'WFH request not found' });
    }

    record.status = 'REJECTED';
    record.reviewedBy = req.user._id;
    record.reviewedAt = new Date();
    record.reviewNote = reviewNote || '';
    await record.save();
    return res.status(200).json(record);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get active approved WFH record for current user/date
// @route   GET /api/wfh-requests/my-active
// @access  Private
exports.getMyActiveWFH = async (req, res) => {
  try {
    const today = req.query.date || getToday();
    // Cleanup expired geolocations on fetch
    await exports.cleanupExpiredWFHGeolocations();
    const record = await WFHRequest.findOne({
      user: req.user._id,
      status: 'APPROVED',
      approvedDate: today
    }).sort({ reviewedAt: -1 });
    return res.status(200).json(record || null);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get employee's current geolocation for a WFH request (approver view)
// @route   GET /api/wfh-requests/:id/employee-location
// @access  Private (SuperAdmin/AGM/Admin)
exports.getEmployeeLocationForWFH = async (req, res) => {
  try {
    const record = await WFHRequest.findById(req.params.id).populate('user', 'name employeeId');
    if (!record) return res.status(404).json({ message: 'WFH request not found' });
    return res.status(200).json({
      wfhId: record._id,
      employee: record.user,
      latitude: record.latitude,
      longitude: record.longitude,
      address: record.address,
      approvedDate: record.approvedDate || record.fromDate
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
