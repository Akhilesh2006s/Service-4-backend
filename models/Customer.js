const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: true
  },
  gstin: String,
  companyName: String,
  billingAddress: String,
  shippingAddress: String,
  state: String,
  pincode: String,
  bankName: String,
  bankAccount: String,
  bankIFSC: String,
  openingBalance: {
    type: Number,
    default: 0
  },
  creditLimit: {
    type: Number,
    default: 0
  },
  discountPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  tags: [String],
  notes: String
}, {
  timestamps: true
});

// Index for faster queries
customerSchema.index({ businessId: 1, email: 1 });
customerSchema.index({ businessId: 1, phone: 1 });

module.exports = mongoose.model('Customer', customerSchema);




