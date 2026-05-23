const Holiday = require('../models/Holiday');

// @desc    Get all holidays
// @route   GET /api/holidays
// @access  Private
exports.getHolidays = async (req, res) => {
  try {
    const holidays = await Holiday.find().sort({ date: 1 });
    res.status(200).json(holidays);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add a holiday
// @route   POST /api/holidays
// @access  Private (Admin/HR)
exports.addHoliday = async (req, res) => {
  try {
    const { date, name, type, description } = req.body;
    const existing = await Holiday.findOne({ date });
    if (existing) {
      return res.status(400).json({ message: 'A holiday already exists on this date' });
    }
    const holiday = await Holiday.create({ date, name, type, description });
    res.status(201).json(holiday);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a holiday
// @route   DELETE /api/holidays/:id
// @access  Private (Admin/HR)
exports.deleteHoliday = async (req, res) => {
  try {
    await Holiday.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Holiday deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
