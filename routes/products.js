const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Create product
router.post('/', requireAdmin, async (req, res) => {
  try {
    const {
      name,
      sku,
      hsnCode,
      price,
      purchasePrice,
      gstRate,
      stock,
      minStock,
      unit,
      category,
      nameHindi,
      description
    } = req.body;

    if (!name || !price || !gstRate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const product = await Product.create({
      businessId: req.user.businessId,
      name,
      sku: sku || `SKU-${Date.now()}`,
      hsnCode,
      price,
      purchasePrice: purchasePrice || 0,
      gstRate,
      stock: stock || 0,
      minStock: minStock || 0,
      unit: unit || 'pcs',
      category,
      nameHindi,
      description
    });

    res.status(201).json({ message: 'Product created', product });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Get all products
router.get('/', requireAuth, async (req, res) => {
  try {
    let query = {};
    const CustomerPricing = require('../models/CustomerPricing');
    const Customer = require('../models/Customer');
    
    if (req.user.userType === 'admin') {
      // Admin sees only their business products
      query.businessId = req.user.businessId;
    } else if (req.user.userType === 'customer') {
      // Customer sees products from all businesses (catalog view)
      // For now, show all products. Later can filter by business
      query = { stock: { $gt: 0 } }; // Only show products in stock
    }
    
    const products = await Product.find(query).sort({ createdAt: -1 });
    
    // If customer, get their custom prices
    if (req.user.userType === 'customer') {
      // Find Customer record for this user
      const User = require('../models/User');
      const customerUser = await User.findById(req.user.id);
      
      if (customerUser) {
        // Find Customer records by email
        const customerRecords = await Customer.find({ email: customerUser.email });
        
        if (customerRecords.length > 0) {
          // Get all customer pricing for these customer records
          const customerIds = customerRecords.map(c => c._id);
          const pricingRecords = await CustomerPricing.find({
            customerId: { $in: customerIds }
          });
          
          // Create a map of productId -> price
          const pricingMap = new Map();
          pricingRecords.forEach(p => {
            const productIdStr = p.productId.toString();
            if (!pricingMap.has(productIdStr)) {
              pricingMap.set(productIdStr, p.price);
            }
          });
          
          // Add custom price to products
          const productsWithPricing = products.map(product => {
            const productIdStr = product._id.toString();
            const customPrice = pricingMap.get(productIdStr);
            return {
              ...product.toObject(),
              price: customPrice || product.price,
              originalPrice: product.price,
              hasCustomPrice: !!customPrice
            };
          });
          
          return res.json({ products: productsWithPricing });
        }
      }
    }
    
    res.json({ products });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Failed to get products' });
  }
});

// Get product by ID
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const businessId = req.user.userType === 'admin' ? req.user.businessId : null;
    const query = { _id: id };
    if (businessId) query.businessId = businessId;
    
    const product = await Product.findOne(query);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ product });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Failed to get product' });
  }
});

// Update product
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findOneAndUpdate(
      { _id: id, businessId: req.user.businessId },
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ message: 'Product updated', product });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Delete product
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findOneAndDelete({ _id: id, businessId: req.user.businessId });
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ message: 'Product deleted' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// Update stock
router.patch('/:id/stock', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, type } = req.body; // type: 'add', 'subtract', 'set'

    const product = await Product.findOne({ _id: id, businessId: req.user.businessId });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    let newQuantity = product.stock;
    if (type === 'add') {
      newQuantity = product.stock + quantity;
    } else if (type === 'subtract') {
      newQuantity = Math.max(0, product.stock - quantity);
    } else if (type === 'set') {
      newQuantity = quantity;
    }

    product.stock = newQuantity;
    await product.save();
    
    res.json({ message: 'Stock updated', product });
  } catch (error) {
    console.error('Update stock error:', error);
    res.status(500).json({ error: 'Failed to update stock' });
  }
});

// Get low stock products
router.get('/inventory/low-stock', requireAdmin, async (req, res) => {
  try {
    const products = await Product.find({ 
      businessId: req.user.businessId,
      $expr: { $lte: ['$stock', '$minStock'] }
    });
    res.json({ products });
  } catch (error) {
    console.error('Get low stock error:', error);
    res.status(500).json({ error: 'Failed to get low stock products' });
  }
});

module.exports = router;

