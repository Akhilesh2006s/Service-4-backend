const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
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
  sku: {
    type: String,
    unique: true,
    sparse: true
  },
  hsnCode: String,
  price: {
    type: Number,
    required: true,
    min: 0
  },
  purchasePrice: {
    type: Number,
    default: 0,
    min: 0
  },
  gstRate: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  stock: {
    type: Number,
    default: 0,
    min: 0
  },
  minStock: {
    type: Number,
    default: 0,
    min: 0
  },
  unit: {
    type: String,
    default: 'pcs',
    enum: ['pcs', 'kg', 'g', 'ltr', 'box', 'pack']
  },
  category: String,
  nameHindi: String,
  description: String
}, {
  timestamps: true
});

// Index for faster queries
productSchema.index({ businessId: 1, name: 1 });

module.exports = mongoose.model('Product', productSchema);




