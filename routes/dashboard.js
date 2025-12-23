const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Get dashboard data
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { month, year } = req.query;
    const currentDate = new Date();
    const currentMonth = month || (currentDate.getMonth() + 1);
    const currentYear = year || currentDate.getFullYear();

    // Calculate date range for the month
    const startDate = new Date(currentYear, currentMonth - 1, 1);
    const endDate = new Date(currentYear, currentMonth, 0, 23, 59, 59);

    // Get all dashboard data
    const [invoices, products, customers, lowStockProducts] = await Promise.all([
      Invoice.find({
        businessId: req.user.businessId,
        date: { $gte: startDate, $lte: endDate },
        status: { $ne: 'cancelled' }
      }),
      Product.find({ businessId: req.user.businessId }),
      Customer.find({ businessId: req.user.businessId }),
      Product.find({
        businessId: req.user.businessId,
        $expr: { $lte: ['$stock', '$minStock'] }
      }).limit(10)
    ]);

    // Calculate sales summary
    const salesSummary = {
      totalSales: invoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0),
      invoiceCount: invoices.length,
      gstCollected: invoices.reduce((sum, inv) => sum + (inv.totalGST || 0), 0)
    };

    // Calculate inventory overview
    const inventoryOverview = {
      totalProducts: products.length,
      stockValue: products.reduce((sum, p) => sum + (p.stock * p.price || 0), 0),
      lowStockCount: lowStockProducts.length
    };

    // Get recent invoices
    const recentInvoices = await Invoice.find({ businessId: req.user.businessId })
      .populate('customerId', 'name')
      .sort({ createdAt: -1 })
      .limit(10)
      .select('invoiceNumber date grandTotal status customerId');

    res.json({
      salesSummary,
      inventoryOverview,
      customerCount: customers.length,
      recentInvoices,
      lowStockProducts,
      period: {
        month: parseInt(currentMonth),
        year: parseInt(currentYear)
      }
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({ error: 'Failed to get dashboard data' });
  }
});

// Get sales summary
router.get('/sales', requireAdmin, async (req, res) => {
  try {
    const { month, year } = req.query;
    const currentDate = new Date();
    const currentMonth = month || (currentDate.getMonth() + 1);
    const currentYear = year || currentDate.getFullYear();
    
    const startDate = new Date(currentYear, currentMonth - 1, 1);
    const endDate = new Date(currentYear, currentMonth, 0, 23, 59, 59);

    const invoices = await Invoice.find({
      businessId: req.user.businessId,
      date: { $gte: startDate, $lte: endDate },
      status: { $ne: 'cancelled' }
    });

    const salesSummary = {
      totalSales: invoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0),
      invoiceCount: invoices.length,
      gstCollected: invoices.reduce((sum, inv) => sum + (inv.totalGST || 0), 0)
    };

    res.json(salesSummary);
  } catch (error) {
    console.error('Get sales summary error:', error);
    res.status(500).json({ error: 'Failed to get sales summary' });
  }
});

// Get inventory overview
router.get('/inventory', requireAdmin, async (req, res) => {
  try {
    const products = await Product.find({ businessId: req.user.businessId });
    const lowStockProducts = await Product.find({
      businessId: req.user.businessId,
      $expr: { $lte: ['$stock', '$minStock'] }
    });

    const inventoryOverview = {
      totalProducts: products.length,
      stockValue: products.reduce((sum, p) => sum + (p.stock * p.price || 0), 0),
      lowStockCount: lowStockProducts.length
    };

    res.json(inventoryOverview);
  } catch (error) {
    console.error('Get inventory overview error:', error);
    res.status(500).json({ error: 'Failed to get inventory overview' });
  }
});

module.exports = router;

