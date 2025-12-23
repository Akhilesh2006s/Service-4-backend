const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const User = require('../models/User');
const Product = require('../models/Product');
const { requireAuth, requireAdmin, requireCustomer } = require('../middleware/auth');

// Create order
router.post('/', requireAuth, async (req, res) => {
  try {
    const { customerId, items, notes } = req.body;

    // Validate items
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Items are required' });
    }

    // Determine customer ID and business ID based on user type
    let finalCustomerId;
    let businessIdForOrder = null;
    
    if (req.user.userType === 'customer') {
      // For customer users, find or create a Customer record
      const customerUser = await User.findById(req.user.id);
      if (!customerUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Get businessId from products being ordered
      // Check all products to ensure they're from the same business
      if (items && items.length > 0) {
        const productIds = items.map(item => item.productId).filter(Boolean);
        const products = await Product.find({ _id: { $in: productIds } });
        
        if (products.length === 0) {
          return res.status(400).json({ error: 'No valid products found' });
        }
        
        // Get unique businessIds from products
        const businessIds = [...new Set(products.map(p => p.businessId?.toString()).filter(Boolean))];
        
        if (businessIds.length === 0) {
          return res.status(400).json({ error: 'Products do not have business IDs' });
        }
        
        if (businessIds.length > 1) {
          return res.status(400).json({ error: 'Cannot order products from multiple businesses in one order' });
        }
        
        // Use the businessId from products - ensure it's an ObjectId
        businessIdForOrder = new mongoose.Types.ObjectId(businessIds[0]);
        
        console.log('Order businessId from products:', businessIdForOrder.toString());
      }
      
      // If no businessId from products, try to get from customer user
      if (!businessIdForOrder && customerUser.businessId) {
        businessIdForOrder = customerUser.businessId;
      }
      
      if (!businessIdForOrder) {
        return res.status(400).json({ error: 'Unable to determine business for order. Products may not be available.' });
      }
      
      // Try to find existing Customer record by email and businessId
      let customer = await Customer.findOne({ 
        email: customerUser.email,
        businessId: businessIdForOrder
      });
      
      if (!customer) {
        // Create a Customer record for this user with the correct businessId
        customer = await Customer.create({
          businessId: businessIdForOrder,
          name: customerUser.name,
          email: customerUser.email,
          phone: customerUser.phone || '',
          companyName: customerUser.companyName || '',
          gstin: customerUser.gstin || '',
          state: customerUser.state || '',
          pincode: customerUser.pincode || '',
          billingAddress: customerUser.address || '',
          shippingAddress: customerUser.address || ''
        });
      }
      
      finalCustomerId = customer._id;
    } else if (req.user.userType === 'admin') {
      // For admins, customerId is required
      if (!customerId) {
        return res.status(400).json({ error: 'Customer ID is required' });
      }
      finalCustomerId = customerId;
      businessIdForOrder = req.user.businessId;
    } else {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Calculate order total
    let total = 0;
    const orderItems = items.map(item => {
      const itemTotal = item.quantity * item.unitPrice;
      total += itemTotal;
      return {
        ...item,
        itemTotal
      };
    });

    const order = await Order.create({
      businessId: businessIdForOrder,
      customerId: finalCustomerId,
      items: orderItems,
      total,
      status: 'pending',
      notes,
      createdBy: req.user.id
    });

    // Log for debugging
    console.log('Order created:', {
      orderId: order._id,
      businessId: order.businessId,
      customerId: order.customerId,
      total: order.total
    });

    res.status(201).json({ message: 'Order created', order });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Get all orders
router.get('/', requireAuth, async (req, res) => {
  try {
    const query = {};
    if (req.user.userType === 'admin') {
      // For admin, get all orders for their business
      // Convert string businessId from session to ObjectId for proper matching
      if (!req.user.businessId) {
        return res.status(400).json({ error: 'Business ID not found' });
      }
      
      query.businessId = new mongoose.Types.ObjectId(req.user.businessId);
      
      // Log for debugging
      console.log('Fetching orders for business:', {
        queryBusinessId: query.businessId.toString(),
        userBusinessId: req.user.businessId,
        userBusinessIdType: typeof req.user.businessId
      });
    } else if (req.user.userType === 'customer') {
      // For customers, find their Customer record first, then get orders
      const customerUser = await User.findById(req.user.id);
      if (customerUser) {
        // Find Customer records for this user
        const customerRecords = await Customer.find({ 
          email: customerUser.email 
        });
        if (customerRecords.length > 0) {
          query.customerId = { $in: customerRecords.map(c => c._id) };
        } else {
          // No customer records found, return empty
          return res.json({ orders: [] });
        }
      } else {
        return res.json({ orders: [] });
      }
    }
    
    const orders = await Order.find(query)
      .populate('customerId', 'name email phone')
      .populate('businessId', 'businessName name')
      .sort({ createdAt: -1 });
    res.json({ orders });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Failed to get orders' });
  }
});

// Get order by ID
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const query = { _id: id };
    
    if (req.user.userType === 'admin') {
      query.businessId = req.user.businessId;
    } else if (req.user.userType === 'customer') {
      query.customerId = req.user.id;
    }
    
    const order = await Order.findOne(query).populate('customerId', 'name email phone');
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ order });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Failed to get order' });
  }
});

// Update order status
router.patch('/:id/status', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'confirmed', 'processing', 'on the way', 'delivered', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const order = await Order.findOneAndUpdate(
      { _id: id, businessId: req.user.businessId },
      { status },
      { new: true }
    );
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ message: 'Order status updated', order });
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// Convert order to invoice
router.post('/:id/convert-to-invoice', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findOne({ _id: id, businessId: req.user.businessId });
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // This will be handled by the invoice creation endpoint
    // For now, return the order data that can be used to create an invoice
    res.json({ 
      message: 'Order ready for invoice conversion', 
      order,
      invoiceData: {
        customerId: order.customerId,
        items: order.items
      }
    });
  } catch (error) {
    console.error('Convert order error:', error);
    res.status(500).json({ error: 'Failed to convert order to invoice' });
  }
});

// Delete order
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findOneAndDelete({ _id: id, businessId: req.user.businessId });
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ message: 'Order deleted' });
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({ error: 'Failed to delete order' });
  }
});

module.exports = router;
