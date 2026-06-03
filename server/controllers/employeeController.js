const User = require('../models/User');
const Company = require('../models/Company');
const ReuploadRequest = require('../models/ReuploadRequest');
const crypto = require('crypto');
const { sendEmail } = require('../utils/emailService');

const ALLOWED_DOC_KEYS = ['marksheet', 'graduationDegree', 'aadhaarCardFront', 'aadhaarCardBack', 'panCardDoc', 'previousOrgDoc', 'bankPassbook'];

// @desc    Create new employee
// @route   POST /api/employees
// @access  Private (Admin, HR, SuperAdmin)
const createEmployee = async (req, res) => {
  try {
    const { name, email, employeeId, phoneNumber, role, department, designation, company, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Employee with this email already exists' });
    }

    // Check if employee ID already exists
    if (employeeId) {
      const existingEmployeeId = await User.findOne({ employeeId });
      if (existingEmployeeId) {
        return res.status(400).json({ message: 'Employee ID already exists' });
      }
    }

    // Validate company if provided
    if (company) {
      const companyExists = await Company.findById(company);
      if (!companyExists) {
        return res.status(400).json({ message: 'Invalid company ID' });
      }
    }

    // Create employee with default password if not provided
    const employeeData = {
      name,
      email,
      password: password || 'ChangeMe@123',
      employeeId: employeeId || null,
      phoneNumber: phoneNumber || null,
      role: role || 'Employee',
      department: department || null,
      designation: designation || null,
      company: company || null,
      // isEmailVerified stays false — the setup email below will let them verify
      isEmailVerified: false,
      kycStatus: 'Incomplete',
      isActive: 'Active'
    };

    // Handle profile picture upload
    if (req.file) {
      employeeData.profilePic = `/uploads/${req.file.filename}`;
    }

    const employee = await User.create(employeeData);

    // Send setup password email so the employee can set their own password
    const verificationToken = crypto.randomBytes(32).toString('hex');
    employee.emailVerificationToken = verificationToken;
    employee.emailVerificationTokenExpire = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
    await employee.save({ validateBeforeSave: false });

    const frontendBase = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
    const setupUrl = `${frontendBase}/setup-password/${verificationToken}`;

    await sendEmail({
      to: email,
      subject: 'Welcome to Study Palace Hub — Set Up Your Account',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #2563eb;">Welcome to Study Palace Hub, ${name}!</h2>
          <p>Your HRMS account has been created by HR. Click the button below to set your password and activate your account:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${setupUrl}" style="background: #2563eb; color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold;">Set Up Your Password</a>
          </div>
          <p>If the button doesn't work, copy and paste this link:</p>
          <p style="color: #64748b; font-size: 0.9em;">${setupUrl}</p>
          <p><em>This link will expire in 7 days.</em></p>
          <p style="color: #94a3b8; font-size: 0.85em;">If you did not expect this email, please contact HR.</p>
        </div>
      `
    });

    // Remove password from response
    const employeeResponse = employee.toObject();
    delete employeeResponse.password;

    // Populate company information
    await User.populate(employeeResponse, { path: 'company', select: 'name email phone address' });

    res.status(201).json({
      message: 'Employee created successfully',
      employee: employeeResponse
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all employees with filters
// @route   GET /api/employees
// @access  Private (Admin/HR/Manager)
const getEmployees = async (req, res) => {
  try {
    const { department, role, search } = req.query;
    let query = {};

    // Hide privileged-role accounts from Employee-level callers
    const HIDDEN_FROM_EMPLOYEES = ['SuperAdmin', 'Admin', 'AGM', 'HR'];
    if (req.user && req.user.role === 'Employee') {
      query.role = { $nin: HIDDEN_FROM_EMPLOYEES };
    }
    
    if (department) query.department = department;
    // Only apply explicit role filter if not already restricted
    if (role && !(query.role && query.role.$nin)) query.role = role;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } }
      ];
    }

    const employees = await User.find(query).select('-password').populate('company', 'name email phone address');
    res.status(200).json(employees);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single employee details
// @route   GET /api/employees/:id
// @access  Private
const getEmployeeById = async (req, res) => {
  try {
    const employee = await User.findById(req.params.id).select('-password').populate('company', 'name email phone address');
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    
    res.status(200).json({ employee });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// @desc    Get counts and stats for dashboard
// @route   GET /api/employees/stats
// @access  Private (Admin/HR)
// @desc    Get counts and stats for dashboard
// @route   GET /api/employees/stats
// @access  Private (Admin/HR)
const getEmployeeStats = async (req, res) => {
  try {
    const totalEmployees = await User.countDocuments({ role: { $ne: 'Admin' } });
    const departmentStats = await User.aggregate([
      { $match: { role: { $ne: 'Admin' } } },
      { $group: { _id: '$department', count: { $sum: 1 } } }
    ]);

    // Upcoming birthdays within the next 30 days (month/day comparison, year-independent)
    const today = new Date();
    const allWithBirthday = await User.find({
      birthDate: { $exists: true, $ne: null }
    }).select('name birthDate profilePic');

    const upcomingBirthdays = allWithBirthday.filter(emp => {
      const bday = new Date(emp.birthDate);
      // Normalise to current year so we can compare day-of-year
      const thisYear  = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
      const nextYear  = new Date(today.getFullYear() + 1, bday.getMonth(), bday.getDate());
      const inThisYear = thisYear >= today && thisYear <= new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      const inNextYear = nextYear >= today && nextYear <= new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      return inThisYear || inNextYear;
    });

    res.status(200).json({
      totalEmployees,
      departmentStats,
      upcomingBirthdays
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Deactivate employee account (mark as left)
// @route   PATCH /api/employees/:id/deactivate
// @access  Private (HR, AGM, Admin, SuperAdmin)
const deactivateEmployee = async (req, res) => {
  try {
    const { leavingDate } = req.body;
    const check = await User.findById(req.params.id).select('role');
    if (!check) return res.status(404).json({ message: 'Employee not found' });
    if (check.role === 'SuperAdmin') return res.status(403).json({ message: 'Cannot deactivate a SuperAdmin account' });

    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { isActive: 'Inactive', leavingDate: leavingDate ? new Date(leavingDate) : new Date() } },
      { new: true, runValidators: false }
    ).select('-password');

    res.status(200).json({ message: 'Employee account deactivated', employee: updated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Reactivate employee account
// @route   PATCH /api/employees/:id/reactivate
// @access  Private (HR, AGM, Admin, SuperAdmin)
const reactivateEmployee = async (req, res) => {
  try {
    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { isActive: 'Active' }, $unset: { leavingDate: '' } },
      { new: true, runValidators: false }
    ).select('-password');
    if (!updated) return res.status(404).json({ message: 'Employee not found' });

    res.status(200).json({ message: 'Employee account reactivated', employee: updated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update employee details
// @route   PATCH /api/employees/:id
// @access  Private (Admin/HR/AGM)
const updateEmployee = async (req, res) => {
  try {
    const employee = await User.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const updates = req.body;

    // Role escalation guard
    if (updates.role) {
      if (req.user.role === 'Admin' || req.user.role === 'SuperAdmin') {
        // full access
      } else if (req.user.role === 'HR' || req.user.role === 'AGM') {
        if (updates.role === 'Admin' || updates.role === 'SuperAdmin') {
          return res.status(403).json({ message: 'You cannot promote to Admin or SuperAdmin' });
        }
      } else {
        delete updates.role;
      }
    }

    // Handle salary structure
    if (updates.salaryStructure) {
      if (updates.salaryStructure.salaryDate !== undefined) {
        let salaryDate = updates.salaryStructure.salaryDate;
        if (typeof salaryDate === 'string') {
          const dateMatch = salaryDate.match(/(\d{1,2})$/);
          if (dateMatch) salaryDate = parseInt(dateMatch[1], 10);
          else salaryDate = parseInt(salaryDate, 10);
        }
        if (salaryDate < 1 || salaryDate > 31 || isNaN(salaryDate)) {
          return res.status(400).json({ message: 'Salary date must be a day between 1 and 31' });
        }
        updates.salaryStructure.salaryDate = salaryDate;
      }
    }

    // Whitelist allowed update fields to prevent mass-assignment
    const ALLOWED_FIELDS = [
      'name', 'phoneNumber', 'designation', 'department', 'joiningDate',
      'birthDate', 'address', 'employeeId', 'panCard', 'bankDetails',
      'salaryStructure', 'role', 'isActive', 'leavingDate', 'company'
    ];
    ALLOWED_FIELDS.forEach(field => {
      if (updates[field] !== undefined) {
        employee[field] = updates[field];
      }
    });
    await employee.save();

    res.status(200).json(employee);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Submit KYC details
// @route   POST /api/employees/submit-kyc
// @access  Private
const submitKYC = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const { phoneNumber, address, bankDetails, employeeId, birthDate, joiningDate, panCard } = req.body;
    
    // Update text fields
    user.phoneNumber = phoneNumber;
    user.address = address;
    user.employeeId = employeeId;
    if (birthDate) user.birthDate = birthDate;
    if (joiningDate) user.joiningDate = joiningDate;
    if (panCard) user.panCard = panCard;

    if (bankDetails) {
       user.bankDetails = typeof bankDetails === 'string' ? JSON.parse(bankDetails) : bankDetails;
    }

    // Update File paths from multer
    if (req.files) {
      if (req.files.photo) user.employeePhoto = `/uploads/${req.files.photo[0].filename}`;
    }

    user.kycStatus = 'Pending';
    await user.save();

    res.status(200).json({ message: 'KYC details submitted successfully and pending approval', user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Review KYC (Approve/Reject)
// @route   PATCH /api/employees/:id/kyc-review
// @access  Private (Admin/HR)
const reviewKYC = async (req, res) => {
  try {
    const { status, remarks } = req.body;
    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const employee = await User.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    employee.kycStatus = status;
    // We could store remarks in a new field if needed
    await employee.save();

    res.status(200).json({ message: `Employee KYC ${status}`, employee });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update employee company assignment
// @route   PATCH /api/employees/:id/company
// @access  Private (HR, Admin, SuperAdmin)
const updateEmployeeCompany = async (req, res) => {
  try {
    const { companyId } = req.body;
    
    // Validate company exists
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(400).json({ message: 'Company not found' });
    }

    // Update employee's company
    const employee = await User.findByIdAndUpdate(
      req.params.id,
      { company: companyId },
      { new: true, runValidators: true }
    ).populate('company', 'name email phone address');

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    res.status(200).json({ 
      message: 'Employee company updated successfully', 
      employee 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all companies for dropdown
// @route   GET /api/employees/companies
// @access  Private (HR, Admin, SuperAdmin)
const getCompaniesForDropdown = async (req, res) => {
  try {
    const companies = await Company.find({ isActive: true })
      .select('name email phone address')
      .sort({ name: 1 });
    res.status(200).json(companies);
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get unverified employees
// @route   GET /api/employees/unverified
// @access  Private (HR, AGM, Admin, SuperAdmin)
const getUnverifiedEmployees = async (req, res) => {
  try {
    const { search = '', department = '', page = 1, limit = 20, sort = 'joiningDate' } = req.query;
    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

    // isIdVerified not set OR explicitly false covers all legacy docs
    const query = { $or: [{ isIdVerified: false }, { isIdVerified: { $exists: false } }] };

    if (department && department.trim()) {
      query.department = { $regex: department.trim(), $options: 'i' };
    }

    if (search && search.trim()) {
      query.$and = [{
        $or: [
          { name:       { $regex: search.trim(), $options: 'i' } },
          { employeeId: { $regex: search.trim(), $options: 'i' } },
          { department: { $regex: search.trim(), $options: 'i' } }
        ]
      }];
    }

    const sortMap = {
      joiningDate:  { joiningDate: 1 },
      '-joiningDate': { joiningDate: -1 },
      name:         { name: 1 }
    };
    const sortObj = sortMap[sort] || { joiningDate: 1 };

    const [employees, total] = await Promise.all([
      User.find(query)
        .select('name employeeId department designation joiningDate kycStatus isIdVerified createdAt')
        .sort(sortObj)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      User.countDocuments(query)
    ]);

    const now = new Date();
    const result = employees.map(emp => {
      const doj = emp.joiningDate || emp.createdAt;
      const daysSinceJoining = doj ? Math.floor((now - new Date(doj)) / (1000 * 60 * 60 * 24)) : 0;
      let verificationStatus = 'Pending';
      if (emp.kycStatus === 'Incomplete')      verificationStatus = 'Documents Missing';
      else if (emp.kycStatus === 'Pending')    verificationStatus = 'Under Review';
      else if (emp.kycStatus === 'Rejected')   verificationStatus = 'Rejected';
      return {
        _id: emp._id,
        employeeId: emp.employeeId || '—',
        name: emp.name,
        department: emp.department || '—',
        designation: emp.designation || '—',
        joiningDate: doj ? new Date(doj).toISOString().split('T')[0] : null,
        kycStatus: emp.kycStatus,
        verificationStatus,
        isOverdue: daysSinceJoining > 30
      };
    });

    res.status(200).json({ total, page: pageNum, limit: limitNum, employees: result });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mark employee ID as verified
// @route   PATCH /api/employees/:id/verify
// @access  Private (HR, AGM, Admin, SuperAdmin)
const verifyEmployee = async (req, res) => {
  try {
    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { isIdVerified: true, verifiedBy: req.user._id, verifiedAt: new Date() } },
      { new: true, runValidators: false }
    ).select('-password');
    if (!updated) return res.status(404).json({ message: 'Employee not found' });
    res.status(200).json({ message: 'Employee ID verified successfully', employee: updated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Upload post-verification documents (one-time, locked after upload)
// @route   POST /api/employees/upload-documents
// @access  Private (verified employees only)
const uploadDocuments = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.isIdVerified) return res.status(403).json({ message: 'Account must be verified before uploading documents.' });

    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ message: 'No file provided.' });
    }

    const currentStatus = user.documentUploadStatus || {};

    // Enforce lock BEFORE processing any file — reject entire request if any field is locked
    for (const field of ALLOWED_DOC_KEYS) {
      if (!req.files[field]) continue;
      const s = currentStatus[field] || {};
      if (s.is_uploaded && !s.reupload_allowed) {
        return res.status(403).json({
          message: `Document '${field}' is already uploaded. Request HR approval to re-upload.`
        });
      }
    }

    // Build $set payload for both documents and documentUploadStatus
    const docUpdates = {};
    const statusUpdates = {};

    for (const field of ALLOWED_DOC_KEYS) {
      if (!req.files[field]) continue;
      docUpdates[`documents.${field}`] = `/uploads/${req.files[field][0].filename}`;
      statusUpdates[`documentUploadStatus.${field}`] = { is_uploaded: true, reupload_allowed: false };
    }

    const updated = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { ...docUpdates, ...statusUpdates } },
      { new: true, runValidators: false }
    ).select('documents documentUploadStatus');

    res.status(200).json({
      message: 'Documents uploaded successfully',
      documents: updated.documents,
      documentUploadStatus: updated.documentUploadStatus
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Request re-upload for a document
// @route   POST /api/employees/reupload-request
// @access  Private (Employee)
const requestReupload = async (req, res) => {
  try {
    const { documentKey } = req.body;
    if (!ALLOWED_DOC_KEYS.includes(documentKey)) {
      return res.status(400).json({ message: 'Invalid document key.' });
    }

    const existing = await ReuploadRequest.findOne({
      employee: req.user._id,
      documentKey,
      status: 'PENDING'
    });
    if (existing) return res.status(409).json({ message: 'A re-upload request is already pending for this document.' });

    const request = await ReuploadRequest.create({ employee: req.user._id, documentKey });
    res.status(201).json({ message: 'Re-upload request submitted.', request });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all pending re-upload requests
// @route   GET /api/employees/reupload-requests
// @access  Private (HR, Admin, AGM, SuperAdmin)
const getReuploadRequests = async (req, res) => {
  try {
    const requests = await ReuploadRequest.find({ status: 'PENDING' })
      .populate('employee', 'name employeeId department')
      .sort({ createdAt: -1 });
    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Approve or reject a re-upload request
// @route   PATCH /api/employees/reupload-requests/:requestId
// @access  Private (HR, Admin, AGM, SuperAdmin)
const reviewReuploadRequest = async (req, res) => {
  try {
    const { action } = req.body; // 'APPROVE' | 'REJECT'
    if (!['APPROVE', 'REJECT'].includes(action)) {
      return res.status(400).json({ message: 'Invalid action. Use APPROVE or REJECT.' });
    }

    const request = await ReuploadRequest.findById(req.params.requestId);
    if (!request || request.status !== 'PENDING') {
      return res.status(404).json({ message: 'Pending request not found.' });
    }

    request.status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    await request.save();

    if (action === 'APPROVE') {
      await User.findByIdAndUpdate(
        request.employee,
        { $set: { [`documentUploadStatus.${request.documentKey}`]: { is_uploaded: true, reupload_allowed: true } } },
        { runValidators: false }
      );
    }

    res.status(200).json({ message: `Request ${action === 'APPROVE' ? 'approved' : 'rejected'}.`, request });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { 
  createEmployee,
  getEmployees, 
  getEmployeeById, 
  getEmployeeStats, 
  updateEmployee,
  deactivateEmployee,
  reactivateEmployee,
  getUnverifiedEmployees,
  verifyEmployee,
  submitKYC, 
  reviewKYC,
  updateEmployeeCompany,
  getCompaniesForDropdown,
  uploadDocuments,
  requestReupload,
  getReuploadRequests,
  reviewReuploadRequest
};

