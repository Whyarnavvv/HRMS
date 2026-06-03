const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  role: { type: String, enum: ['Admin', 'HR', 'Manager', 'Employee', 'AGM', 'SuperAdmin', 'Counselling Team'], required: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  employeeId: { type: String, unique: true, sparse: true },
  phoneNumber: { type: String },
  profilePic: { type: String },
  company: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Company',
    required: false 
  },

  // KPI relevant fields
  totalKpi: { type: Number, default: 0 },
  totalAdded: { type: Number, default: 0 },
  totalDeducted: { type: Number, default: 0 },

  // New Employee Management & KYC fields
  designation: { type: String },
  department: { type: String },
  joiningDate: { type: Date },
  birthDate: { type: Date },

  isEmailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String },
  emailVerificationTokenExpire: { type: Date },
  refreshToken: { type: String },
  resetPasswordToken: { type: String },
  resetPasswordExpire: { type: Date },
  kycStatus: {
    type: String,
    enum: ['Incomplete', 'Pending', 'Approved', 'Rejected'],
    default: 'Incomplete'
  },

  address: { type: String },
  panCard: { type: String },
  panCardImage: { type: String },
  aadhaarFrontImage: { type: String },
  aadhaarBackImage: { type: String },
  employeePhoto: { type: String },

  // Post-verification document uploads
  documents: {
    marksheet: { type: String },
    graduationDegree: { type: String },
    aadhaarCardFront: { type: String },
    aadhaarCardBack: { type: String },
    panCardDoc: { type: String },
    previousOrgDoc: { type: String },
    bankPassbook: { type: String }
  },

  // Upload lock flags — keyed by document field name.
  // Stored as Mixed so Mongoose persists arbitrary keys without sub-schema issues.
  // Shape per key: { is_uploaded: Boolean, reupload_allowed: Boolean }
  documentUploadStatus: { type: mongoose.Schema.Types.Mixed, default: {} },

  // Payroll related
  salaryStructure: {
    baseSalary: { type: Number, default: 0 },
    housingAllowance: { type: Number, default: 0 },
    transportAllowance: { type: Number, default: 0 },
    otherAllowances: { type: Number, default: 0 },
    monthlyBonus: { type: Number, default: 0 },
    salaryDate: { 
      type: Number, 
      min: 1, 
      max: 31,
      validate: {
        validator: function(v) {
          return v >= 1 && v <= 31;
        },
        message: 'Salary date must be a day between 1 and 31'
      }
    }
  },

  bankDetails: {
    accountHolder: { type: String },
    accountNumber: { type: String },
    ifsc: { type: String },
    bankName: { type: String }
  },

  isActive: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  leavingDate: { type: Date, default: null },
  isIdVerified: { type: Boolean, default: false },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  verifiedAt: { type: Date, default: null }
}, { timestamps: true });



userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Generate and hash password token
userSchema.methods.getResetPasswordToken = function () {
  // Generate token
  const resetToken = crypto.randomBytes(20).toString('hex');

  // Hash token and set to resetPasswordToken field
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Set expire (15 minutes)
  this.resetPasswordExpire = Date.now() + 15 * 60 * 1000;

  return resetToken;
};

module.exports = mongoose.model('User', userSchema);

