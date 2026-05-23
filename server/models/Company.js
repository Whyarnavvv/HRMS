const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  logo: {
    type: String,
    default: null
  },
  gstNumber: {
    type: String,
    trim: true,
    uppercase: true,
    validate: {
      validator: function(v) {
        // Basic GST number validation (Indian GST format: 2 digits + 10 characters)
        return !v || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v);
      },
      message: 'Invalid GST number format'
    }
  },
  address: {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    postalCode: { type: String, trim: true },
    country: { type: String, trim: true, default: 'India' }
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Invalid email format'
    }
  },
  phone: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        return !v || /^[0-9+\-\s()]+$/.test(v);
      },
      message: 'Invalid phone number format'
    }
  },
  website: {
    type: String,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        return !v || /^https?:\/\/.+/.test(v);
      },
      message: 'Invalid website URL format'
    }
  },
  industry: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  establishedYear: {
    type: Number,
    min: 1800,
    max: new Date().getFullYear()
  },
  employeeCount: {
    type: Number,
    min: 0,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full address
companySchema.virtual('fullAddress').get(function() {
  const parts = [];
  if (this.address.street) parts.push(this.address.street);
  if (this.address.city) parts.push(this.address.city);
  if (this.address.state) parts.push(this.address.state);
  if (this.address.postalCode) parts.push(this.address.postalCode);
  if (this.address.country && this.address.country !== 'India') parts.push(this.address.country);
  return parts.join(', ');
});

// Index for better query performance
companySchema.index({ name: 1 });
companySchema.index({ email: 1 });
companySchema.index({ gstNumber: 1 });
companySchema.index({ isActive: 1 });

module.exports = mongoose.model('Company', companySchema);
