const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: String,
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  itemTotal: {
    type: Number,
    default: 0
  }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
    index: true
  },
  items: [orderItemSchema],
  total: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'on the way', 'delivered', 'completed', 'cancelled'],
    default: 'pending'
  },
  notes: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for faster queries
orderSchema.index({ businessId: 1, createdAt: -1 });
orderSchema.index({ customerId: 1, createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);

