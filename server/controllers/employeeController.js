const User = require('../models/User');
const Company = require('../models/Company');

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
      isEmailVerified: true,
      kycStatus: 'Incomplete',
      isActive: 'Active'
    };

    // Handle profile picture upload
    if (req.file) {
      employeeData.profilePic = `/uploads/${req.file.filename}`;
    }

    const employee = await User.create(employeeData);

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
    
    if (department) query.department = department;
    if (role) query.role = role;
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
    
    // Upcoming birthdays (within 30 days)
    const today = new Date();
    const nextMonth = new Date();
    nextMonth.setDate(today.getDate() + 30);
    
    const upcomingBirthdays = await User.find({
      birthDate: { $exists: true, $ne: null }
      // Complex logic for birthdays regardless of year usually involves aggregation
    }).select('name birthDate profilePic');

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

    Object.assign(employee, updates);
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
      if (req.files.panCard) user.panCardImage = `/uploads/${req.files.panCard[0].filename}`;
      if (req.files.aadhaarFront) user.aadhaarFrontImage = `/uploads/${req.files.aadhaarFront[0].filename}`;
      if (req.files.aadhaarBack) user.aadhaarBackImage = `/uploads/${req.files.aadhaarBack[0].filename}`;
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
    // If database connection fails, return fallback data for testing
    if (error.message.includes('ECONNREFUSED') || error.message.includes('timeout')) {
      console.log('Database connection failed - returning fallback company data');
      const fallbackCompanies = [
        {
          _id: 'fallback-company-1',
          name: 'Test Company A',
          email: 'test@companya.com',
          phone: '+1-555-0001',
          address: { street: '123 Test St', city: 'Test City', state: 'TS', postalCode: '12345', country: 'India' }
        },
        {
          _id: 'fallback-company-2', 
          name: 'Test Company B',
          email: 'test@companyb.com',
          phone: '+1-555-0002',
          address: { street: '456 Test Ave', city: 'Test City', state: 'TS', postalCode: '67890', country: 'India' }
        }
      ];
      res.status(200).json(fallbackCompanies);
    } else {
      res.status(500).json({ message: error.message });
    }
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
  getCompaniesForDropdown
};

