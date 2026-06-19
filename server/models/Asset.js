const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema({
  // Identity
  assetNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  assetName: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['Laptop', 'Desktop', 'Phone', 'SIM Card', 'ID Card', 'Access Card', 'Furniture', 'Other'],
    trim: true
  },
  brand: {
    type: String,
    trim: true
  },
  modelName: {
    type: String,
    trim: true
  },

  // IMEI — for device assets (Phone, SIM Card, Tablet, etc.)
  // Optional for non-device assets; must be unique when present.
  // unique + sparse declared here on the field — NO separate schema.index() call needed.
  imeiNumber: {
    type:   String,
    trim:   true,
    unique: true,
    sparse: true,   // allows multiple null/undefined values; enforces uniqueness only when set
    default: null
  },

  // Quantity tracking — availableQuantity is always derived but stored for fast queries
  totalQuantity: { type: Number, required: true, min: 1, default: 1 },
  assignedQuantity: { type: Number, default: 0, min: 0 },
  availableQuantity: { type: Number, default: 1, min: 0 },

  // Status is the overall asset record status, not per-unit
  status: {
    type: String,
    enum: ['Available', 'Fully Assigned', 'Under Repair', 'Retired'],
    default: 'Available'
  },

  // Procurement
  purchaseDate: { type: Date },
  vendorName: { type: String, trim: true },
  warrantyExpiry: { type: Date },
  purchasePrice: { type: Number, min: 0 },

  notes: { type: String, trim: true },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

// Enforce availableQuantity consistency before every save
assetSchema.pre('save', async function () {
  this.availableQuantity = this.totalQuantity - this.assignedQuantity;

  if (this.availableQuantity < 0) {
    throw new Error('Assigned quantity cannot exceed total quantity');
  }

  // Auto-derive status based on quantities (only when not manually set to Retired/Under Repair)
  if (this.status !== 'Retired' && this.status !== 'Under Repair') {
    this.status = this.availableQuantity === 0 ? 'Fully Assigned' : 'Available';
  }
});

// assetNumber already has unique: true in the schema field definition above
// — no separate index needed (removes Mongoose duplicate-index warning)
assetSchema.index({ category: 1, status: 1 });
assetSchema.index({ createdAt: -1 });
// NOTE: imeiNumber index is declared inline on the field (unique: true, sparse: true)
// — no separate schema.index() call to avoid the duplicate-index warning

module.exports = mongoose.model('Asset', assetSchema);
