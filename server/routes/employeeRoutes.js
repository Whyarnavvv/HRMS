const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { createEmployee, getEmployees, getEmployeeById, getEmployeeStats, updateEmployee, deactivateEmployee, reactivateEmployee, getUnverifiedEmployees, verifyEmployee, submitKYC, reviewKYC, updateEmployeeCompany, getCompaniesForDropdown } = require('../controllers/employeeController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Multer Config for KYC
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    cb(null, `${req.user._id}-${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ storage });

router.post('/', protect, authorize('Admin', 'HR', 'SuperAdmin'), upload.single('profilePic'), createEmployee);
router.get('/', protect, authorize('Admin', 'HR', 'Manager', 'AGM', 'SuperAdmin'), getEmployees);
router.get('/stats', protect, authorize('Admin', 'HR', 'AGM', 'SuperAdmin'), getEmployeeStats);

// Specific routes must come before parameterized routes
router.get('/companies', protect, authorize('HR', 'Admin', 'SuperAdmin'), getCompaniesForDropdown);
router.get('/unverified', protect, authorize('Admin', 'HR', 'AGM', 'SuperAdmin'), getUnverifiedEmployees);

// KYC Routes
router.post('/submit-kyc', protect, upload.fields([
  { name: 'panCard', maxCount: 1 },
  { name: 'aadhaarFront', maxCount: 1 },
  { name: 'aadhaarBack', maxCount: 1 },
  { name: 'photo', maxCount: 1 }
]), submitKYC);

// Parameterized routes (must come after specific routes)
router.get('/:id', protect, getEmployeeById);
router.patch('/:id/kyc-review', protect, authorize('Admin', 'HR', 'AGM', 'SuperAdmin'), reviewKYC);
router.patch('/:id/verify', protect, authorize('Admin', 'HR', 'AGM', 'SuperAdmin'), verifyEmployee);
router.patch('/:id/company', protect, authorize('HR', 'Admin', 'AGM', 'SuperAdmin'), updateEmployeeCompany);
router.patch('/:id/deactivate', protect, authorize('Admin', 'HR', 'AGM', 'SuperAdmin'), deactivateEmployee);
router.patch('/:id/reactivate', protect, authorize('Admin', 'HR', 'AGM', 'SuperAdmin'), reactivateEmployee);
router.patch('/:id', protect, authorize('Admin', 'HR', 'AGM', 'SuperAdmin'), updateEmployee);

module.exports = router;

