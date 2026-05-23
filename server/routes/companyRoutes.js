const express = require('express');
const router = express.Router();
const { 
  getCompanies, 
  getCompany, 
  createCompany, 
  updateCompany, 
  deleteCompany, 
  getCompanyStats 
} = require('../controllers/companyController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { auditLogger } = require('../middleware/auditLogger');
const upload = require('../middleware/uploadMiddleware');

// Apply authentication to all routes
router.use(protect);

// Routes - Read access for HR, Admin, SuperAdmin
router.get('/', 
  authorize('HR', 'Admin', 'SuperAdmin'),
  auditLogger({ action: 'VIEW_COMPANIES', module: 'COMPANY', targetEntity: 'Company' }), 
  getCompanies
);
router.get('/stats', 
  authorize('SuperAdmin'),
  auditLogger({ action: 'VIEW_COMPANY_STATS', module: 'COMPANY', targetEntity: 'Company' }), 
  getCompanyStats
);
router.get('/:id', 
  authorize('HR', 'Admin', 'SuperAdmin'),
  auditLogger({ action: 'VIEW_COMPANY', module: 'COMPANY', targetEntity: 'Company' }), 
  getCompany
);

// Management operations - SuperAdmin only
router.post('/', 
  authorize('SuperAdmin'),
  upload.single('logo'), 
  auditLogger({ action: 'CREATE_COMPANY', module: 'COMPANY', targetEntity: 'Company' }), 
  createCompany
);

router.put('/:id', 
  authorize('SuperAdmin'),
  upload.single('logo'), 
  auditLogger({ action: 'UPDATE_COMPANY', module: 'COMPANY', targetEntity: 'Company' }), 
  updateCompany
);

router.delete('/:id', 
  authorize('SuperAdmin'),
  auditLogger({ action: 'DELETE_COMPANY', module: 'COMPANY', targetEntity: 'Company' }), 
  deleteCompany
);

module.exports = router;
