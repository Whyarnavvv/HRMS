const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  month: { type: Number, required: true },
  year: { type: Number, required: true },
  
  // Working metrics
  workingDays: { type: Number, default: 0 },
  presentDays: { type: Number, default: 0 },
  absentDays: { type: Number, default: 0 },
  halfDays: { type: Number, default: 0 },
  lateDays: { type: Number, default: 0 },
  paidLeaves: { type: Number, default: 0 },
  totalHours: { type: Number, default: 0 },
  
  // Financials
  baseSalary: { type: Number, required: true },
  grossBaseSalary: { type: Number, required: true }, // The full undisputed base
  totalAllowances: { type: Number, default: 0 },
  monthlyBonus: { type: Number, default: 0 },
  performanceBonus: { type: Number, default: 0 },
  
  // Specific Deductions
  absentDeduction: { type: Number, default: 0 },
  halfDayDeduction: { type: Number, default: 0 },
  lateDeduction: { type: Number, default: 0 },
  totalDeductions: { type: Number, default: 0 }, // For manual deductions sum and all totals
  
  // Manual Adjustments
  adjustments: [{
    amount: { type: Number, required: true },
    reason: { type: String, required: true },
    type: { type: String, enum: ['Addition', 'Deduction'], required: true }
  }],
  
  netSalary: { type: Number, required: true },
  
  // DOJ-based cycle fields
  cycleStart: { type: Date },
  cycleEnd: { type: Date },
  salaryPaymentDate: { type: Date },
  dailyRate: { type: Number, default: 0 },
  daysWorked: { type: Number, default: 0 },
  
  status: { 
    type: String, 
    enum: ['Draft', 'Processing', 'Paid', 'Cancelled'],
    default: 'Draft' 
  },
  
  paymentDate: { type: Date },
  salarySlipUrl: { type: String } // Path to generated PDF if applicable
}, { timestamps: true });

// Ensure one payroll record per user per month/year
payrollSchema.index({ user: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('Payroll', payrollSchema);
