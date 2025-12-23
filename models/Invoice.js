const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: String,
  hsnCode: String,
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  unit: String,
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  gstRate: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  itemTotal: {
    type: Number,
    default: 0
  },
  itemGST: {
    type: Number,
    default: 0
  }
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
    index: true
  },
  invoiceNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  dueDate: Date,
  paymentTerms: String,
  items: [invoiceItemSchema],
  subtotal: {
    type: Number,
    default: 0
  },
  cgst: {
    type: Number,
    default: 0
  },
  sgst: {
    type: Number,
    default: 0
  },
  igst: {
    type: Number,
    default: 0
  },
  totalGST: {
    type: Number,
    default: 0
  },
  grandTotal: {
    type: Number,
    required: true,
    default: 0
  },
  status: {
    type: String,
    enum: ['draft', 'pending', 'paid', 'overdue', 'cancelled'],
    default: 'draft'
  },
  notes: String
}, {
  timestamps: true
});

// Index for faster queries
invoiceSchema.index({ businessId: 1, date: -1 });
invoiceSchema.index({ customerId: 1, date: -1 });
invoiceSchema.index({ invoiceNumber: 1 });

module.exports = mongoose.model('Invoice', invoiceSchema);




