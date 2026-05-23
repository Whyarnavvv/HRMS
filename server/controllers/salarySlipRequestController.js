const SalarySlipRequest = require('../models/SalarySlipRequest');
const Payroll = require('../models/Payroll');
const { generateSalarySlipPDF } = require('../utils/pdfGenerator');
const nodemailer = require('nodemailer');

const POPULATE_USER = 'name role email employeeId designation department bankDetails panCard birthDate joiningDate';

// @desc    Employee submits a salary slip request
// @route   POST /api/salary-slip-requests
// @access  Private
exports.createRequest = async (req, res) => {
  try {
    const { month, year } = req.body;
    if (!month || !year) return res.status(400).json({ message: 'month and year are required' });

    const existing = await SalarySlipRequest.findOne({ user: req.user._id, month, year });
    if (existing) return res.status(400).json({ message: 'Request for this month already submitted' });

    const request = await SalarySlipRequest.create({ user: req.user._id, month, year });
    return res.status(201).json(request);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get my salary slip requests
// @route   GET /api/salary-slip-requests/my
// @access  Private
exports.getMyRequests = async (req, res) => {
  try {
    const requests = await SalarySlipRequest.find({ user: req.user._id }).sort({ createdAt: -1 });
    return res.status(200).json(requests);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get all salary slip requests
// @route   GET /api/salary-slip-requests
// @access  Private (HR, Admin, AGM, SuperAdmin)
exports.getAllRequests = async (req, res) => {
  try {
    const requests = await SalarySlipRequest.find()
      .populate('user', 'name email employeeId role')
      .populate('fulfilledBy', 'name role')
      .sort({ createdAt: -1 });
    return res.status(200).json(requests);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Fulfill request by sending salary slip via email
// @route   POST /api/salary-slip-requests/:id/fulfill-email
// @access  Private (HR, Admin, AGM, SuperAdmin)
exports.fulfillByEmail = async (req, res) => {
  try {
    const slipReq = await SalarySlipRequest.findById(req.params.id).populate('user');
    if (!slipReq) return res.status(404).json({ message: 'Request not found' });

    const payroll = await Payroll.findOne({ user: slipReq.user._id, month: slipReq.month, year: slipReq.year })
      .populate('user', POPULATE_USER);
    if (!payroll) return res.status(404).json({ message: 'Payroll record not found for this month. Generate payroll first.' });

    const pdfBuffer = await generateSalarySlipPDF(payroll);

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      slipReq.status = 'Fulfilled';
      slipReq.fulfilledBy = req.user._id;
      slipReq.fulfilledAt = new Date();
      slipReq.fulfillMethod = 'Email';
      await slipReq.save();
      return res.status(200).json({ message: 'Simulated: Salary slip sent via email (SMTP not configured)', request: slipReq });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });

    await transporter.sendMail({
      from: `"Study Palace Hub HRMS" <${process.env.SMTP_USER}>`,
      to: slipReq.user.email,
      subject: `Your Salary Slip - ${slipReq.month}/${slipReq.year}`,
      text: `Hello ${slipReq.user.name}, please find attached your salary slip for ${slipReq.month}/${slipReq.year}.`,
      attachments: [{ filename: `SalarySlip_${slipReq.month}_${slipReq.year}.pdf`, content: pdfBuffer }]
    });

    slipReq.status = 'Fulfilled';
    slipReq.fulfilledBy = req.user._id;
    slipReq.fulfilledAt = new Date();
    slipReq.fulfillMethod = 'Email';
    await slipReq.save();

    return res.status(200).json({ message: 'Salary slip sent via email', request: slipReq });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Fulfill request in-platform (returns payroll data for display)
// @route   POST /api/salary-slip-requests/:id/fulfill-platform
// @access  Private (HR, Admin, AGM, SuperAdmin)
exports.fulfillByPlatform = async (req, res) => {
  try {
    const slipReq = await SalarySlipRequest.findById(req.params.id).populate('user');
    if (!slipReq) return res.status(404).json({ message: 'Request not found' });

    const payroll = await Payroll.findOne({ user: slipReq.user._id, month: slipReq.month, year: slipReq.year })
      .populate('user', POPULATE_USER);
    if (!payroll) return res.status(404).json({ message: 'Payroll record not found for this month. Generate payroll first.' });

    slipReq.status = 'Fulfilled';
    slipReq.fulfilledBy = req.user._id;
    slipReq.fulfilledAt = new Date();
    slipReq.fulfillMethod = 'Platform';
    await slipReq.save();

    return res.status(200).json({ message: 'Fulfilled', payroll, request: slipReq });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
