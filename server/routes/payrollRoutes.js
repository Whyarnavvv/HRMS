const express = require('express');
const router = express.Router();
const { generateMonthlyPayroll, convertLeavesToPaid, addAdjustment, processPayment, getMyPayroll, getPayrollById, getPayrollPDF, sharePayrollEmail, getPayrollCalendar } = require('../controllers/payrollController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.post('/generate', protect, authorize('Admin', 'HR'), generateMonthlyPayroll);
router.get('/calendar', protect, authorize('Admin', 'HR', 'AGM', 'SuperAdmin'), getPayrollCalendar);
router.get('/my-slips', protect, getMyPayroll);
router.post('/:id/convert-leaves', protect, authorize('Admin', 'HR'), convertLeavesToPaid);
router.patch('/:id/adjustment', protect, authorize('Admin', 'HR'), addAdjustment);
router.patch('/:id/pay', protect, authorize('Admin', 'HR'), processPayment);
router.post('/:id/share', protect, sharePayrollEmail);
router.get('/:id/pdf', protect, getPayrollPDF);
router.get('/:id', protect, getPayrollById);

module.exports = router;


