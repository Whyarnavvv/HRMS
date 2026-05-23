const express = require('express');
const router = express.Router();
const { createEmployee, getEmployees, getEmployeeById, getStats } = require('../controllers/employeeController');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.route('/stats').get(getStats);

router.route('/')
  .get(getEmployees)
  .post(protect, adminOnly, upload.single('profilePic'), createEmployee);

router.route('/:id')
  .get(getEmployeeById);

module.exports = router;
