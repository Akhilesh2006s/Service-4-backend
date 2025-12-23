const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const Product = require('../models/Product');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Sales Report
router.get('/sales', requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date required' });
    }

    const invoices = await Invoice.find({
      businessId: req.user.businessId,
      date: { $gte: new Date(startDate), $lte: new Date(endDate) },
      status: { $ne: 'cancelled' }
    });

    const report = {
      totalSales: invoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0),
      totalGST: invoices.reduce((sum, inv) => sum + (inv.totalGST || 0), 0),
      invoiceCount: invoices.length,
      dailySales: []
    };

    // Group by date
    const dailyMap = {};
    invoices.forEach(inv => {
      const date = inv.date.toISOString().split('T')[0];
      if (!dailyMap[date]) {
        dailyMap[date] = { date, sales: 0, count: 0 };
      }
      dailyMap[date].sales += inv.grandTotal || 0;
      dailyMap[date].count += 1;
    });
    report.dailySales = Object.values(dailyMap);

    res.json(report);
  } catch (error) {
    console.error('Get sales report error:', error);
    res.status(500).json({ error: 'Failed to get sales report' });
  }
});

// Profit & Loss Report
router.get('/profit-loss', requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date required' });
    }

    const invoices = await Invoice.find({
      businessId: req.user.businessId,
      date: { $gte: new Date(startDate), $lte: new Date(endDate) },
      status: { $ne: 'cancelled' }
    });

    let revenue = 0;
    let costs = 0;

    for (const invoice of invoices) {
      revenue += invoice.grandTotal || 0;
      // Calculate costs from items
      for (const item of invoice.items) {
        const product = await Product.findById(item.productId);
        if (product && product.purchasePrice) {
          costs += item.quantity * product.purchasePrice;
        }
      }
    }

    const profit = revenue - costs;
    const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;

    const report = {
      revenue,
      costs,
      profit,
      profitMargin: parseFloat(profitMargin.toFixed(2))
    };

    res.json(report);
  } catch (error) {
    console.error('Get profit loss report error:', error);
    res.status(500).json({ error: 'Failed to get profit loss report' });
  }
});

// Product-wise Sales Report
router.get('/product-sales', requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date required' });
    }

    const invoices = await Invoice.find({
      businessId: req.user.businessId,
      date: { $gte: new Date(startDate), $lte: new Date(endDate) },
      status: { $ne: 'cancelled' }
    });

    const productMap = {};
    invoices.forEach(invoice => {
      invoice.items.forEach(item => {
        const productId = item.productId.toString();
        if (!productMap[productId]) {
          productMap[productId] = {
            productId,
            productName: item.productName || 'Unknown',
            quantity: 0,
            totalSales: 0
          };
        }
        productMap[productId].quantity += item.quantity;
        productMap[productId].totalSales += item.itemTotal || 0;
      });
    });

    const report = Object.values(productMap);
    res.json({ products: report });
  } catch (error) {
    console.error('Get product sales report error:', error);
    res.status(500).json({ error: 'Failed to get product sales report' });
  }
});

// GSTR-1 Report
router.get('/gstr-1', requireAdmin, async (req, res) => {
  try {
    const { period } = req.query; // Format: YYYY-MM
    
    if (!period) {
      return res.status(400).json({ error: 'Period required (format: YYYY-MM)' });
    }

    const [year, month] = period.split('-');
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const invoices = await Invoice.find({
      businessId: req.user.businessId,
      date: { $gte: startDate, $lte: endDate },
      status: { $ne: 'cancelled' }
    });

    const byGSTRate = {
      '0': { taxableValue: 0, cgst: 0, sgst: 0, igst: 0 },
      '5': { taxableValue: 0, cgst: 0, sgst: 0, igst: 0 },
      '12': { taxableValue: 0, cgst: 0, sgst: 0, igst: 0 },
      '18': { taxableValue: 0, cgst: 0, sgst: 0, igst: 0 },
      '28': { taxableValue: 0, cgst: 0, sgst: 0, igst: 0 }
    };

    invoices.forEach(invoice => {
      invoice.items.forEach(item => {
        const rate = Math.round(item.gstRate || 0).toString();
        if (!byGSTRate[rate]) {
          byGSTRate[rate] = { taxableValue: 0, cgst: 0, sgst: 0, igst: 0 };
        }
        byGSTRate[rate].taxableValue += item.itemTotal || 0;
        byGSTRate[rate].cgst += invoice.cgst || 0;
        byGSTRate[rate].sgst += invoice.sgst || 0;
        byGSTRate[rate].igst += invoice.igst || 0;
      });
    });

    const report = {
      period,
      taxableValue: {},
      taxBreakdown: {},
      byGSTRate
    };

    res.json(report);
  } catch (error) {
    console.error('Get GSTR-1 report error:', error);
    res.status(500).json({ error: 'Failed to get GSTR-1 report' });
  }
});

// GSTR-3B Report
router.get('/gstr-3b', requireAdmin, async (req, res) => {
  try {
    const { period } = req.query; // Format: YYYY-MM
    
    if (!period) {
      return res.status(400).json({ error: 'Period required (format: YYYY-MM)' });
    }

    const [year, month] = period.split('-');
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const invoices = await Invoice.find({
      businessId: req.user.businessId,
      date: { $gte: startDate, $lte: endDate },
      status: { $ne: 'cancelled' }
    });

    const summary = {
      totalTaxableValue: invoices.reduce((sum, inv) => sum + (inv.subtotal || 0), 0),
      totalCGST: invoices.reduce((sum, inv) => sum + (inv.cgst || 0), 0),
      totalSGST: invoices.reduce((sum, inv) => sum + (inv.sgst || 0), 0),
      totalIGST: invoices.reduce((sum, inv) => sum + (inv.igst || 0), 0)
    };

    const report = {
      period,
      summary
    };

    res.json(report);
  } catch (error) {
    console.error('Get GSTR-3B report error:', error);
    res.status(500).json({ error: 'Failed to get GSTR-3B report' });
  }
});

// Transaction Reports: Sales
router.get('/transactions/sales', requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date required' });
    }

    const invoices = await Invoice.find({
      businessId: req.user.businessId,
      date: { $gte: new Date(startDate), $lte: new Date(endDate) },
      status: { $ne: 'cancelled' }
    }).populate('customerId', 'name email phone').sort({ date: -1 });

    const transactions = invoices.map(inv => ({
      date: inv.date,
      invoiceNumber: inv.invoiceNumber,
      customer: {
        name: inv.customerId?.name || 'Unknown',
        email: inv.customerId?.email || '',
        phone: inv.customerId?.phone || ''
      },
      subtotal: inv.subtotal || 0,
      cgst: inv.cgst || 0,
      sgst: inv.sgst || 0,
      igst: inv.igst || 0,
      totalGST: inv.totalGST || 0,
      grandTotal: inv.grandTotal || 0,
      status: inv.status,
      itemCount: inv.items.length
    }));

    const summary = {
      totalTransactions: transactions.length,
      totalSales: transactions.reduce((sum, t) => sum + t.grandTotal, 0),
      totalGST: transactions.reduce((sum, t) => sum + t.totalGST, 0),
      totalSubtotal: transactions.reduce((sum, t) => sum + t.subtotal, 0)
    };

    res.json({ transactions, summary });
  } catch (error) {
    console.error('Get sales transactions error:', error);
    res.status(500).json({ error: 'Failed to get sales transactions' });
  }
});

// Transaction Reports: Purchases
router.get('/transactions/purchases', requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date required' });
    }

    // Get invoices in the date range
    const invoices = await Invoice.find({
      businessId: req.user.businessId,
      date: { $gte: new Date(startDate), $lte: new Date(endDate) },
      status: { $ne: 'cancelled' }
    });

    // Calculate purchases from invoice items (using purchasePrice)
    const purchaseMap = {};
    let totalPurchaseCost = 0;

    for (const invoice of invoices) {
      for (const item of invoice.items) {
        const product = await Product.findById(item.productId);
        if (product && product.purchasePrice) {
          const purchaseCost = item.quantity * product.purchasePrice;
          totalPurchaseCost += purchaseCost;
          
          const date = invoice.date.toISOString().split('T')[0];
          if (!purchaseMap[date]) {
            purchaseMap[date] = {
              date,
              items: [],
              totalCost: 0
            };
          }
          
          purchaseMap[date].items.push({
            productName: item.productName || product.name,
            quantity: item.quantity,
            unit: item.unit || product.unit,
            purchasePrice: product.purchasePrice,
            totalCost: purchaseCost
          });
          purchaseMap[date].totalCost += purchaseCost;
        }
      }
    }

    const purchases = Object.values(purchaseMap).sort((a, b) => 
      new Date(b.date) - new Date(a.date)
    );

    const summary = {
      totalPurchases: purchases.length,
      totalCost: totalPurchaseCost,
      totalItems: purchases.reduce((sum, p) => sum + p.items.length, 0)
    };

    res.json({ purchases, summary });
  } catch (error) {
    console.error('Get purchases transactions error:', error);
    res.status(500).json({ error: 'Failed to get purchases transactions' });
  }
});

// Bill-wise Reports: Item-level sales analysis
router.get('/bill-wise/items', requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date required' });
    }

    const invoices = await Invoice.find({
      businessId: req.user.businessId,
      date: { $gte: new Date(startDate), $lte: new Date(endDate) },
      status: { $ne: 'cancelled' }
    }).populate('customerId', 'name').sort({ date: -1 });

    const billWiseReport = invoices.map(invoice => ({
      invoiceNumber: invoice.invoiceNumber,
      date: invoice.date,
      customerName: invoice.customerId?.name || 'Unknown',
      items: invoice.items.map(item => ({
        productName: item.productName,
        hsnCode: item.hsnCode,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        gstRate: item.gstRate,
        itemTotal: item.itemTotal,
        itemGST: item.itemGST
      })),
      subtotal: invoice.subtotal,
      totalGST: invoice.totalGST,
      grandTotal: invoice.grandTotal,
      status: invoice.status
    }));

    // Summary statistics
    const itemSummary = {};
    invoices.forEach(invoice => {
      invoice.items.forEach(item => {
        const key = item.productId.toString();
        if (!itemSummary[key]) {
          itemSummary[key] = {
            productName: item.productName,
            totalQuantity: 0,
            totalSales: 0,
            totalGST: 0,
            invoiceCount: 0
          };
        }
        itemSummary[key].totalQuantity += item.quantity;
        itemSummary[key].totalSales += item.itemTotal || 0;
        itemSummary[key].totalGST += item.itemGST || 0;
        itemSummary[key].invoiceCount += 1;
      });
    });

    res.json({
      bills: billWiseReport,
      itemSummary: Object.values(itemSummary),
      totalBills: billWiseReport.length
    });
  } catch (error) {
    console.error('Get bill-wise items report error:', error);
    res.status(500).json({ error: 'Failed to get bill-wise items report' });
  }
});

// Item Reports: Stock Summary
router.get('/items/stock-summary', requireAdmin, async (req, res) => {
  try {
    const products = await Product.find({ businessId: req.user.businessId })
      .sort({ name: 1 });

    const stockSummary = products.map(product => {
      const stockValue = product.stock * product.price;
      const purchaseValue = product.stock * (product.purchasePrice || 0);
      const isLowStock = product.stock <= product.minStock;
      
      return {
        productId: product._id,
        name: product.name,
        nameHindi: product.nameHindi,
        sku: product.sku,
        category: product.category,
        stock: product.stock,
        minStock: product.minStock,
        unit: product.unit,
        price: product.price,
        purchasePrice: product.purchasePrice || 0,
        stockValue,
        purchaseValue,
        isLowStock,
        stockStatus: isLowStock ? 'Low Stock' : product.stock === 0 ? 'Out of Stock' : 'In Stock'
      };
    });

    const summary = {
      totalProducts: products.length,
      totalStockValue: stockSummary.reduce((sum, p) => sum + p.stockValue, 0),
      totalPurchaseValue: stockSummary.reduce((sum, p) => sum + p.purchaseValue, 0),
      lowStockCount: stockSummary.filter(p => p.isLowStock).length,
      outOfStockCount: stockSummary.filter(p => p.stock === 0).length,
      inStockCount: stockSummary.filter(p => p.stock > 0 && !p.isLowStock).length
    };

    res.json({ stockSummary, summary });
  } catch (error) {
    console.error('Get stock summary error:', error);
    res.status(500).json({ error: 'Failed to get stock summary' });
  }
});

// Item Reports: P&L Statement (Product-wise)
router.get('/items/pl-statement', requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date required' });
    }

    const invoices = await Invoice.find({
      businessId: req.user.businessId,
      date: { $gte: new Date(startDate), $lte: new Date(endDate) },
      status: { $ne: 'cancelled' }
    });

    const productPL = {};
    
    for (const invoice of invoices) {
      for (const item of invoice.items) {
        const productId = item.productId.toString();
        const product = await Product.findById(item.productId);
        
        if (!productPL[productId]) {
          productPL[productId] = {
            productId,
            productName: item.productName || product?.name || 'Unknown',
            sku: product?.sku || '',
            category: product?.category || '',
            totalQuantitySold: 0,
            totalRevenue: 0,
            totalCost: 0,
            totalProfit: 0,
            profitMargin: 0
          };
        }
        
        const revenue = item.itemTotal || 0;
        const cost = item.quantity * (product?.purchasePrice || 0);
        const profit = revenue - cost;
        
        productPL[productId].totalQuantitySold += item.quantity;
        productPL[productId].totalRevenue += revenue;
        productPL[productId].totalCost += cost;
        productPL[productId].totalProfit += profit;
      }
    }

    // Calculate profit margins
    const plStatement = Object.values(productPL).map(item => ({
      ...item,
      profitMargin: item.totalRevenue > 0 
        ? parseFloat(((item.totalProfit / item.totalRevenue) * 100).toFixed(2))
        : 0
    })).sort((a, b) => b.totalProfit - a.totalProfit);

    const overallSummary = {
      totalRevenue: plStatement.reduce((sum, p) => sum + p.totalRevenue, 0),
      totalCost: plStatement.reduce((sum, p) => sum + p.totalCost, 0),
      totalProfit: plStatement.reduce((sum, p) => sum + p.totalProfit, 0),
      overallProfitMargin: 0
    };
    
    overallSummary.overallProfitMargin = overallSummary.totalRevenue > 0
      ? parseFloat(((overallSummary.totalProfit / overallSummary.totalRevenue) * 100).toFixed(2))
      : 0;

    res.json({ plStatement, summary: overallSummary });
  } catch (error) {
    console.error('Get P&L statement error:', error);
    res.status(500).json({ error: 'Failed to get P&L statement' });
  }
});

module.exports = router;

