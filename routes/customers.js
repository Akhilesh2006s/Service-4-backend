const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const CustomerPricing = require('../models/CustomerPricing');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Create customer
router.post('/', requireAdmin, async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      gstin,
      companyName,
      billingAddress,
      shippingAddress,
      state,
      pincode,
      bankName,
      bankAccount,
      bankIFSC,
      openingBalance,
      creditLimit,
      discountPercentage,
      tags,
      notes
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }

    const customer = await Customer.create({
      businessId: req.user.businessId,
      name,
      email,
      phone,
      gstin,
      companyName,
      billingAddress,
      shippingAddress,
      state,
      pincode,
      bankName,
      bankAccount,
      bankIFSC,
      openingBalance: openingBalance || 0,
      creditLimit: creditLimit || 0,
      discountPercentage: discountPercentage || 0,
      tags: tags || [],
      notes
    });

    res.status(201).json({ message: 'Customer created', customer });
  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// Get all customers
router.get('/', requireAdmin, async (req, res) => {
  try {
    // Get all Customer records for this business
    const customers = await Customer.find({ businessId: req.user.businessId }).sort({ createdAt: -1 });
    
    // Also get customer users (User with userType='customer') that have this businessId
    // or have placed orders with this business
    const User = require('../models/User');
    const Order = require('../models/Order');
    
    // Find all orders for this business to get customer user IDs
    const businessOrders = await Order.find({ businessId: req.user.businessId }).distinct('createdBy');
    
    // Get customer users who have placed orders
    const customerUsers = await User.find({
      _id: { $in: businessOrders },
      userType: 'customer'
    }).select('name email phone companyName gstin state pincode address');
    
    // Merge and format: Customer records + Customer users (avoid duplicates)
    const customerMap = new Map();
    
    // Add Customer records
    customers.forEach(customer => {
      customerMap.set(customer.email || customer._id.toString(), {
        _id: customer._id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        companyName: customer.companyName,
        gstin: customer.gstin,
        state: customer.state,
        pincode: customer.pincode,
        address: customer.billingAddress || customer.shippingAddress,
        isUserAccount: false,
        createdAt: customer.createdAt
      });
    });
    
    // Add customer users (only if not already in map)
    customerUsers.forEach(user => {
      if (!customerMap.has(user.email)) {
        customerMap.set(user.email, {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone || '',
          companyName: user.companyName || '',
          gstin: user.gstin || '',
          state: user.state || '',
          pincode: user.pincode || '',
          address: user.address || '',
          isUserAccount: true,
          createdAt: user.createdAt
        });
      }
    });
    
    // Convert map to array and sort by creation date
    const allCustomers = Array.from(customerMap.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    res.json({ customers: allCustomers });
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({ error: 'Failed to get customers' });
  }
});

// Get customer by ID
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const query = { _id: id };
    if (req.user.userType === 'admin') {
      query.businessId = req.user.businessId;
    }
    
    const customer = await Customer.findOne(query);
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({ customer });
  } catch (error) {
    console.error('Get customer error:', error);
    res.status(500).json({ error: 'Failed to get customer' });
  }
});

// Update customer
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await Customer.findOneAndUpdate(
      { _id: id, businessId: req.user.businessId },
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({ message: 'Customer updated', customer });
  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

// Delete customer
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await Customer.findOneAndDelete({ _id: id, businessId: req.user.businessId });
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({ message: 'Customer deleted' });
  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

// Get all products with customer pricing for a specific customer
router.get('/:id/products', requireAdmin, async (req, res) => {
  try {
    const { id: customerId } = req.params;
    const Product = require('../models/Product');
    
    // Get all products for this business
    const products = await Product.find({ businessId: req.user.businessId }).sort({ name: 1 });
    
    // Get all customer pricing for this customer
    const customerPricing = await CustomerPricing.find({ customerId });
    const pricingMap = new Map();
    customerPricing.forEach(p => {
      pricingMap.set(p.productId.toString(), p.price);
    });
    
    // Combine products with their custom prices
    const productsWithPricing = products.map(product => ({
      _id: product._id,
      name: product.name,
      sku: product.sku,
      category: product.category,
      defaultPrice: product.price,
      customPrice: pricingMap.get(product._id.toString()) || null,
      stock: product.stock,
      unit: product.unit,
      gstRate: product.gstRate
    }));
    
    res.json({ products: productsWithPricing });
  } catch (error) {
    console.error('Get customer products error:', error);
    res.status(500).json({ error: 'Failed to get customer products' });
  }
});

// Set customer-specific pricing (single product)
router.post('/:id/pricing', requireAdmin, async (req, res) => {
  try {
    const { id: customerId } = req.params;
    const { productId, price } = req.body;

    if (!productId || price === undefined || price === null) {
      return res.status(400).json({ error: 'Product ID and price required' });
    }

    // Verify customer belongs to this business
    const customer = await Customer.findOne({ _id: customerId, businessId: req.user.businessId });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Verify product belongs to this business
    const Product = require('../models/Product');
    const product = await Product.findOne({ _id: productId, businessId: req.user.businessId });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const pricing = await CustomerPricing.findOneAndUpdate(
      { customerId, productId },
      { customerId, productId, price: parseFloat(price) },
      { upsert: true, new: true }
    );
    res.json({ message: 'Customer pricing set', pricing });
  } catch (error) {
    console.error('Set customer pricing error:', error);
    res.status(500).json({ error: 'Failed to set customer pricing' });
  }
});

// Bulk set customer pricing (multiple products)
router.post('/:id/pricing/bulk', requireAdmin, async (req, res) => {
  try {
    const { id: customerId } = req.params;
    const { pricing } = req.body; // Array of { productId, price }

    if (!Array.isArray(pricing)) {
      return res.status(400).json({ error: 'Pricing must be an array' });
    }

    // Verify customer belongs to this business
    const customer = await Customer.findOne({ _id: customerId, businessId: req.user.businessId });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Verify all products belong to this business
    const Product = require('../models/Product');
    const productIds = pricing.map(p => p.productId).filter(Boolean);
    const products = await Product.find({ 
      _id: { $in: productIds }, 
      businessId: req.user.businessId 
    });
    
    if (products.length !== productIds.length) {
      return res.status(400).json({ error: 'Some products not found or do not belong to your business' });
    }

    // Bulk update/create pricing
    const operations = pricing.map(p => ({
      updateOne: {
        filter: { customerId, productId: p.productId },
        update: { customerId, productId: p.productId, price: parseFloat(p.price) },
        upsert: true
      }
    }));

    await CustomerPricing.bulkWrite(operations);
    
    res.json({ message: 'Customer pricing updated successfully', count: pricing.length });
  } catch (error) {
    console.error('Bulk set customer pricing error:', error);
    res.status(500).json({ error: 'Failed to set customer pricing' });
  }
});

// Delete customer pricing
router.delete('/:id/pricing/:productId', requireAdmin, async (req, res) => {
  try {
    const { id: customerId, productId } = req.params;
    
    await CustomerPricing.findOneAndDelete({ customerId, productId });
    res.json({ message: 'Customer pricing deleted' });
  } catch (error) {
    console.error('Delete customer pricing error:', error);
    res.status(500).json({ error: 'Failed to delete customer pricing' });
  }
});

// Get customer-specific pricing
router.get('/:id/pricing/:productId', requireAuth, async (req, res) => {
  try {
    const { id: customerId, productId } = req.params;
    const pricing = await CustomerPricing.findOne({ customerId, productId });
    res.json({ pricing });
  } catch (error) {
    console.error('Get customer pricing error:', error);
    res.status(500).json({ error: 'Failed to get customer pricing' });
  }
});

module.exports = router;

