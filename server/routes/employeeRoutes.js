const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { createEmployee, getEmployees, getEmployeeById, getEmployeeStats, updateEmployee, deactivateEmployee, reactivateEmployee, getUnverifiedEmployees, verifyEmployee, submitKYC, reviewKYC, updateEmployeeCompany, getCompaniesForDropdown, uploadDocuments, requestReupload, getReuploadRequests, reviewReuploadRequest } = require('../controllers/employeeController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Multer Config for KYC — use absolute path so it works in all environments
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    if (!require('fs').existsSync(uploadDir)) {
      require('fs').mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Include userId in filename so each document is traceable to its owner.
    // Do NOT change this pattern — existing stored files use this naming.
    cb(null, `${req.user._id}-${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const extOk  = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowed.test(file.mimetype);
    if (extOk && mimeOk) return cb(null, true);
    cb(new Error('Only JPG, PNG, and WEBP images are accepted.'));
  }
});

// Return multer errors (file type / size violations) as clean JSON instead of
// letting Express bubble them up as an unhandled HTML error page.
const handleUploadError = (err, req, res, next) => {
  if (err) {
    const isSizeError = err.code === 'LIMIT_FILE_SIZE';
    return res.status(400).json({
      message: isSizeError
        ? 'Image size must be less than 2 MB.'
        : (err.message || 'Invalid file. Only JPG, PNG, and WEBP images under 2 MB are accepted.')
    });
  }
  next();
};

router.post('/', protect, authorize('Admin', 'HR', 'SuperAdmin'), upload.single('profilePic'), handleUploadError, createEmployee);
router.get('/', protect, authorize('Admin', 'HR', 'Manager', 'AGM', 'SuperAdmin'), getEmployees);
router.get('/stats', protect, authorize('Admin', 'HR', 'AGM', 'SuperAdmin'), getEmployeeStats);

// Specific routes must come before parameterized routes
router.get('/companies', protect, authorize('HR', 'Admin', 'SuperAdmin'), getCompaniesForDropdown);
router.get('/unverified', protect, authorize('Admin', 'HR', 'AGM', 'SuperAdmin'), getUnverifiedEmployees);

// Document upload multer — accepts PDF, JPG, PNG up to 1.5 MB
const docStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    if (!require('fs').existsSync(uploadDir)) require('fs').mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${req.user._id}-${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const docUpload = multer({
  storage: docStorage,
  limits: { fileSize: 1.5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|pdf/;
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = /jpeg|jpg|png|pdf/.test(file.mimetype);
    if (extOk && mimeOk) return cb(null, true);
    cb(new Error('Only PDF, JPG, and PNG files are accepted.'));
  }
});

const handleDocUploadError = (err, req, res, next) => {
  if (err) {
    return res.status(400).json({
      message: err.code === 'LIMIT_FILE_SIZE'
        ? 'File size must be less than 1.5 MB.'
        : (err.message || 'Invalid file. Only PDF, JPG, PNG under 1.5 MB are accepted.')
    });
  }
  next();
};

// KYC Routes
router.post('/submit-kyc', protect, upload.fields([
  { name: 'photo', maxCount: 1 }
]), handleUploadError, submitKYC);

// Re-upload request routes
router.post('/reupload-request', protect, requestReupload);
router.get('/reupload-requests', protect, authorize('Admin', 'HR', 'AGM', 'SuperAdmin'), getReuploadRequests);
router.patch('/reupload-requests/:requestId', protect, authorize('Admin', 'HR', 'AGM', 'SuperAdmin'), reviewReuploadRequest);

// Parameterized routes (must come after specific routes)
router.post('/upload-documents', protect, docUpload.fields([
  { name: 'marksheet', maxCount: 1 },
  { name: 'graduationDegree', maxCount: 1 },
  { name: 'aadhaarCardFront', maxCount: 1 },
  { name: 'aadhaarCardBack', maxCount: 1 },
  { name: 'panCardDoc', maxCount: 1 },
  { name: 'previousOrgDoc', maxCount: 1 },
  { name: 'bankPassbook', maxCount: 1 }
]), handleDocUploadError, uploadDocuments);

router.get('/:id', protect, getEmployeeById);
router.patch('/:id/kyc-review', protect, authorize('Admin', 'HR', 'AGM', 'SuperAdmin'), reviewKYC);
router.patch('/:id/verify', protect, authorize('Admin', 'HR', 'AGM', 'SuperAdmin'), verifyEmployee);
router.patch('/:id/company', protect, authorize('HR', 'Admin', 'AGM', 'SuperAdmin'), updateEmployeeCompany);
router.patch('/:id/deactivate', protect, authorize('Admin', 'HR', 'AGM', 'SuperAdmin'), deactivateEmployee);
router.patch('/:id/reactivate', protect, authorize('Admin', 'HR', 'AGM', 'SuperAdmin'), reactivateEmployee);
router.patch('/:id', protect, authorize('Admin', 'HR', 'AGM', 'SuperAdmin'), updateEmployee);

module.exports = router;

