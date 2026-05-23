const express = require('express');
const router = express.Router();
const { getHolidays, addHoliday, deleteHoliday } = require('../controllers/holidayController');
const { protect, authorize } = require('../middleware/authMiddleware.js');

router.get('/', protect, getHolidays);
router.post('/', protect, authorize('Admin', 'HR'), addHoliday);
router.delete('/:id', protect, authorize('Admin', 'HR'), deleteHoliday);

module.exports = router;
