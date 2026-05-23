const Payroll = require('../models/Payroll');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Holiday = require('../models/Holiday');
const nodemailer = require('nodemailer');
const { generateSalarySlipPDF } = require('../utils/pdfGenerator');

const toNonNegativeNumber = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, num);
};

// ─── DOJ Cycle Helpers ────────────────────────────────────────────────────────

// Get the cycle start/end for a given employee DOJ and a reference month/year
// Cycle: DOJ-day of refMonth → DOJ-day of (refMonth+1)
// Handles month-end edge cases (e.g. joined 31st → use last day of shorter months)
const getCycleForMonth = (doj, refYear, refMonth) => {
  const dojDate = new Date(doj);
  const dojDay  = dojDate.getDate();

  // Clamp day to last day of the given month
  const clampDay = (year, month, day) => {
    const lastDay = new Date(year, month, 0).getDate(); // month is 1-based here
    return Math.min(day, lastDay);
  };

  const startDay = clampDay(refYear, refMonth, dojDay);
  const cycleStart = new Date(refYear, refMonth - 1, startDay);

  // End month = refMonth + 1
  const endYear  = refMonth === 12 ? refYear + 1 : refYear;
  const endMonth = refMonth === 12 ? 1 : refMonth + 1;
  const endDay   = clampDay(endYear, endMonth, dojDay);
  const cycleEnd = new Date(endYear, endMonth - 1, endDay);

  // Payment date = cycleEnd + 5 calendar days
  const salaryPaymentDate = new Date(cycleEnd);
  salaryPaymentDate.setDate(salaryPaymentDate.getDate() + 5);

  return { cycleStart, cycleEnd, salaryPaymentDate };
};

// Count attendance days within a date range (inclusive)
const countAttendanceInRange = async (userId, startDate, endDate) => {
  const start = startDate.toISOString().split('T')[0];
  const end   = endDate.toISOString().split('T')[0];

  const records = await Attendance.find({
    user: userId,
    date: { $gte: start, $lte: end }
  });

  let presentDays = 0, lateDays = 0, halfDays = 0, paidLeaves = 0, unpaidLeaves = 0;

  const holidays = await Holiday.find({ date: { $gte: start, $lte: end } });
  const holidaySet = new Set(holidays.map(h => h.date));

  const attendanceMap = {};
  records.forEach(r => { attendanceMap[r.date] = r; });

  // Iterate each day in range
  const cur = new Date(startDate);
  while (cur <= endDate) {
    const dateStr = cur.toISOString().split('T')[0];
    const isSunday  = cur.getDay() === 0;
    const isHoliday = holidaySet.has(dateStr);
    const record    = attendanceMap[dateStr];

    if (record) {
      if (record.status === 'Present')      presentDays  += 1;
      else if (record.status === 'Late')    { presentDays += 1; lateDays += 1; }
      else if (record.status === 'Half-day') { presentDays += 0.5; halfDays += 1; }
      else if (record.status === 'Paid Leave') paidLeaves += 1;
      else if (!isSunday && !isHoliday)    unpaidLeaves += 1;
    } else if (!isSunday && !isHoliday) {
      unpaidLeaves += 1;
    }
    cur.setDate(cur.getDate() + 1);
  }

  return { presentDays, lateDays, halfDays, paidLeaves, unpaidLeaves };
};

// @desc    Generate payroll for all employees for a given month (DOJ-based cycles)
// @route   POST /api/payroll/generate
// @access  Private (Admin/HR)
const generateMonthlyPayroll = async (req, res) => {
  try {
    const month = Number(req.body.month);
    const year  = Number(req.body.year);
    if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000) {
      return res.status(400).json({ message: 'Invalid month/year provided for payroll generation' });
    }

    const employees = await User.find({ role: { $ne: 'SuperAdmin' }, isActive: 'Active' });
    const results   = [];

    for (const emp of employees) {
      const doj = emp.joiningDate || emp.createdAt;
      const { cycleStart, cycleEnd, salaryPaymentDate } = getCycleForMonth(doj, year, month);

      // Actual days in the cycle month (for daily rate calculation)
      const daysInCycleMonth = new Date(year, month, 0).getDate();

      const baseSalary          = toNonNegativeNumber(emp.salaryStructure?.baseSalary);
      const housingAllowance    = toNonNegativeNumber(emp.salaryStructure?.housingAllowance);
      const transportAllowance  = toNonNegativeNumber(emp.salaryStructure?.transportAllowance);
      const otherAllowances     = toNonNegativeNumber(emp.salaryStructure?.otherAllowances);
      const monthlyBonusFromStr = toNonNegativeNumber(emp.salaryStructure?.monthlyBonus);

      const dailyRate = daysInCycleMonth > 0 ? baseSalary / daysInCycleMonth : 0;

      // Count attendance within the DOJ cycle
      const { presentDays, lateDays, halfDays, paidLeaves, unpaidLeaves } =
        await countAttendanceInRange(emp._id, cycleStart, cycleEnd);

      const totalAllowances  = housingAllowance + transportAllowance + otherAllowances;
      const absentDeduction  = parseFloat((unpaidLeaves * dailyRate).toFixed(2));
      const halfDayDeduction = parseFloat((halfDays * (dailyRate / 2)).toFixed(2));

      // KPI bonus for the calendar month
      const KpiRecord = require('../models/KpiRecord');
      const kpiStart  = new Date(year, month - 1, 1);
      const kpiEnd    = new Date(year, month, 1);
      const kpiRecords = await KpiRecord.find({
        employeeId: emp._id,
        date: { $gte: kpiStart, $lt: kpiEnd }
      });
      const performanceBonus = Math.max(0, kpiRecords.reduce((a, c) => a + (c.points || 0), 0) * 50);

      // Total days in cycle (for daysWorked calculation)
      const cycleTotalDays = Math.round((cycleEnd - cycleStart) / (1000 * 60 * 60 * 24)) + 1;
      const daysWorked     = Math.max(0, cycleTotalDays - unpaidLeaves);

      const grossSalary = parseFloat((dailyRate * daysWorked).toFixed(2));
      const calculatedNet = Math.max(0, grossSalary + totalAllowances + monthlyBonusFromStr + performanceBonus - absentDeduction - halfDayDeduction);

      let payroll = await Payroll.findOne({ user: emp._id, month, year });

      const payrollData = {
        user: emp._id, month, year,
        cycleStart, cycleEnd, salaryPaymentDate,
        dailyRate: parseFloat(dailyRate.toFixed(2)),
        daysWorked,
        workingDays: cycleTotalDays,
        presentDays, absentDays: unpaidLeaves, lateDays, halfDays, paidLeaves,
        baseSalary: parseFloat(baseSalary.toFixed(2)),
        grossBaseSalary: parseFloat(baseSalary.toFixed(2)),
        totalAllowances, monthlyBonus: monthlyBonusFromStr, performanceBonus,
        absentDeduction, halfDayDeduction, lateDeduction: 0,
        totalDeductions: payroll ? payroll.adjustments.filter(a => a.type === 'Deduction').reduce((s, a) => s + a.amount, 0) : 0,
        netSalary: parseFloat(calculatedNet.toFixed(2)),
        status: payroll?.status || 'Draft'
      };

      // Re-apply existing manual adjustments
      if (payroll?.adjustments?.length) {
        payroll.adjustments.forEach(adj => {
          const amt = toNonNegativeNumber(adj.amount);
          payrollData.netSalary += adj.type === 'Addition' ? amt : -amt;
        });
        payrollData.netSalary = Math.max(0, parseFloat(payrollData.netSalary.toFixed(2)));
      }

      if (payroll) {
        if (payroll.status === 'Draft') { Object.assign(payroll, payrollData); await payroll.save(); }
      } else {
        payroll = await Payroll.create(payrollData);
      }

      const populated = await Payroll.findById(payroll._id)
        .populate('user', 'name role email employeeId designation department bankDetails panCard birthDate joiningDate');
      results.push(populated);
    }

    res.status(200).json({ message: `Payroll generated for ${results.length} employees`, results });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get payroll calendar — employees grouped by salary payment date
// @route   GET /api/payroll/calendar?month=&year=
// @access  Private (Admin/HR)
const getPayrollCalendar = async (req, res) => {
  try {
    const month = Number(req.query.month) || new Date().getMonth() + 1;
    const year  = Number(req.query.year)  || new Date().getFullYear();

    const employees = await User.find({ role: { $ne: 'SuperAdmin' }, isActive: 'Active' })
      .select('name employeeId joiningDate createdAt salaryStructure designation');

    const calendar = {};

    for (const emp of employees) {
      const doj = emp.joiningDate || emp.createdAt;
      const { cycleStart, cycleEnd, salaryPaymentDate } = getCycleForMonth(doj, year, month);
      const payDateStr = salaryPaymentDate.toISOString().split('T')[0];

      if (!calendar[payDateStr]) calendar[payDateStr] = [];
      calendar[payDateStr].push({
        _id: emp._id,
        name: emp.name,
        employeeId: emp.employeeId,
        designation: emp.designation,
        baseSalary: emp.salaryStructure?.baseSalary || 0,
        cycleStart: cycleStart.toISOString().split('T')[0],
        cycleEnd: cycleEnd.toISOString().split('T')[0],
        salaryPaymentDate: payDateStr
      });
    }

    // Sort by date and return as array
    const result = Object.entries(calendar)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, employees]) => ({ date, employees }));

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const convertLeavesToPaid = async (req, res) => {
  try {
    const { daysToConvert } = req.body;
    const payroll = await Payroll.findById(req.params.id);
    
    if (!payroll) return res.status(404).json({ message: 'Payroll record not found' });
    if (payroll.status === 'Paid') return res.status(400).json({ message: 'Cannot modify paid payroll' });
    if (!daysToConvert || daysToConvert <= 0) return res.status(400).json({ message: 'Invalid days to convert' });

    // Find attendance records for this month that are "Absent"
    const datePrefix = `${payroll.year}-${payroll.month.toString().padStart(2, '0')}`;
    const absentRecords = await Attendance.find({
      user: payroll.user,
      date: { $regex: `^${datePrefix}` },
      status: 'Absent'
    }).limit(daysToConvert);

    if (absentRecords.length < daysToConvert) {
      return res.status(400).json({ message: `Employee only has ${absentRecords.length} absent days available to convert.` });
    }

    // Convert them to Paid Leave
    for (let record of absentRecords) {
      record.status = 'Paid Leave';
      await record.save();
    }

    res.status(200).json({ message: `Successfully converted ${daysToConvert} absent days to paid leave. Please regenerate payroll.` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const addAdjustment = async (req, res) => {
  try {
    const { amount, reason, type } = req.body;
    const payroll = await Payroll.findById(req.params.id);
    
    if (!payroll) return res.status(404).json({ message: 'Payroll record not found' });
    if (payroll.status === 'Paid') return res.status(400).json({ message: 'Cannot adjust paid payroll' });

    const numAmount = Number(amount);
    payroll.adjustments.push({ amount: numAmount, reason, type });
    
    // Update net salary
    if (type === 'Addition') {
      payroll.netSalary += numAmount;
    } else {
      payroll.netSalary -= numAmount;
      payroll.totalDeductions = (payroll.totalDeductions || 0) + numAmount;
    }
    
    // Clamp netSalary to prevent negative amounts (-2 bug fix)
    payroll.netSalary = Math.max(0, payroll.netSalary);

    await payroll.save();
    const populated = await Payroll.findById(payroll._id).populate('user', 'name role email employeeId designation department bankDetails panCard birthDate joiningDate');
    res.status(200).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const processPayment = async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id).populate('user');
    if (!payroll) return res.status(404).json({ message: 'Payroll not found' });

    payroll.status = 'Paid';
    payroll.paymentDate = new Date();
    await payroll.save();

    // Trigger share email automatically upon payment if desired
    // For now we just return the record as the frontend has a manual share button too
    res.status(200).json(payroll);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getMyPayroll = async (req, res) => {
  try {
    const records = await Payroll.find({ user: req.user._id }).sort({ year: -1, month: -1 }).populate('user', 'name role email employeeId designation department bankDetails panCard birthDate joiningDate');
    res.status(200).json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getPayrollById = async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id).populate('user', 'name role email employeeId designation department bankDetails panCard birthDate joiningDate');
    if (!payroll) return res.status(404).json({ message: 'Payroll not found' });
    const isAdminOrHR = ['Admin', 'HR', 'SuperAdmin'].includes(req.user.role);
    const isOwner = payroll.user._id.toString() === req.user._id.toString();
    if (!isAdminOrHR && !isOwner) return res.status(403).json({ message: 'Not authorized' });
    res.status(200).json(payroll);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getPayrollPDF = async (req, res) => {
  try {
    if (['Employee', 'Manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Direct download is not allowed. Please submit a salary slip request.' });
    }
    const payroll = await Payroll.findById(req.params.id).populate('user', 'name role email employeeId designation department bankDetails panCard birthDate joiningDate');
    if (!payroll) return res.status(404).json({ message: 'Payroll not found' });
    const isAdminOrHR = ['Admin', 'HR', 'SuperAdmin'].includes(req.user.role);
    const isOwner = payroll.user?._id?.toString() === req.user._id.toString();
    if (!isAdminOrHR && !isOwner) return res.status(403).json({ message: 'Not authorized' });
    const pdfBuffer = await generateSalarySlipPDF(payroll);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="SalarySlip_${payroll.user?.name || 'Employee'}_${payroll.month}_${payroll.year}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const sharePayrollEmail = async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id).populate('user');
    if (!payroll) return res.status(404).json({ message: 'Payroll not found' });

    // Employees and Managers cannot self-share; must go through request flow
    if (['Employee', 'Manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Please submit a salary slip request instead.' });
    }

    const isAdminOrHR = ['Admin', 'HR', 'SuperAdmin'].includes(req.user.role);
    const isOwner = payroll.user._id.toString() === req.user._id.toString();

    if (!isAdminOrHR && !isOwner) {
      return res.status(403).json({ message: 'Not authorized to share this slip' });
    }

    // Generate PDF
    const pdfBuffer = await generateSalarySlipPDF(payroll);

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log('⚠️ Email credentials not set. Simulated share with PDF for:', payroll.user.email);
      return res.status(200).json({ message: 'Simulated: PDF Slip shared to employee email', simulated: true });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const mailOptions = {
      from: `"Study Palace Hub HRMS" <${process.env.SMTP_USER}>`,
      to: payroll.user.email,
      subject: `Official Salary Slip - ${payroll.month}/${payroll.year}`,
      text: `Hello ${payroll.user.name}, please find attached your official salary slip for ${payroll.month}/${payroll.year}.`,
      attachments: [
        {
          filename: `SalarySlip_${payroll.month}_${payroll.year}.pdf`,
          content: pdfBuffer
        }
      ]
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'Salary slip PDF shared successfully' });
  } catch (error) {
    console.error('Email error:', error);
    res.status(500).json({ message: 'Error sending email or generating PDF' });
  }
};

module.exports = { 
  generateMonthlyPayroll, 
  convertLeavesToPaid,
  addAdjustment, 
  processPayment, 
  getMyPayroll,
  getPayrollById,
  getPayrollPDF,
  sharePayrollEmail,
  generateSalarySlipPDF,
  getPayrollCalendar
};

