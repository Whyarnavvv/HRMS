const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema({
  date: { type: String, required: true, unique: true }, // Format: YYYY-MM-DD
  name: { type: String, required: true },
  description: { type: String },
  type: { 
    type: String, 
    enum: ['National', 'Company', 'Regional'], 
    default: 'Company' 
  }
}, { timestamps: true });

module.exports = mongoose.model('Holiday', holidaySchema);
