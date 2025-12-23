const mongoose = require('mongoose');

const customerPricingSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  }
}, {
  timestamps: true
});

// Unique constraint on customer and product combination
customerPricingSchema.index({ customerId: 1, productId: 1 }, { unique: true });

module.exports = mongoose.model('CustomerPricing', customerPricingSchema);




