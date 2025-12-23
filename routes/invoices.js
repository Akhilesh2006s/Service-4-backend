const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const User = require('../models/User');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const { requireAuth, requireAdmin, requireCustomer } = require('../middleware/auth');
const { calculateInvoiceTotals, generateInvoiceNumber } = require('../utils/gstCalculator');
const { generateInvoicePDF } = require('../utils/pdfGenerator');

// Create invoice
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { customerId, items, date, dueDate, paymentTerms, notes } = req.body;

    if (!customerId || !items || items.length === 0) {
      return res.status(400).json({ error: 'Customer ID and items required' });
    }

    // Get business and customer details for GST calculation
    const business = await User.findById(req.user.businessId);
    const customer = await Customer.findById(customerId);

    if (!business || !customer) {
      return res.status(404).json({ error: 'Business or customer not found' });
    }

    // Get product details for items
    const itemsWithDetails = await Promise.all(items.map(async (item) => {
      const product = await Product.findById(item.productId);
      return {
        ...item,
        gstRate: product ? product.gstRate : item.gstRate || 0,
        hsnCode: product ? product.hsnCode : item.hsnCode,
        productName: product ? product.name : item.name
      };
    }));

    // Calculate invoice totals with GST
    const totals = calculateInvoiceTotals(
      itemsWithDetails,
      customer.state,
      business.state
    );

    // Generate invoice number
    const invoiceCount = await Invoice.countDocuments({ businessId: req.user.businessId });
    const invoiceNumber = generateInvoiceNumber(req.user.businessId, invoiceCount);

    // Create invoice
    const invoice = await Invoice.create({
      businessId: req.user.businessId,
      customerId,
      invoiceNumber,
      date: date || new Date().toISOString().split('T')[0],
      dueDate,
      paymentTerms,
      items: totals.items,
      subtotal: totals.subtotal,
      cgst: totals.cgst,
      sgst: totals.sgst,
      igst: totals.igst,
      totalGST: totals.totalGST,
      grandTotal: totals.grandTotal,
      status: 'draft',
      notes
    });

    res.status(201).json({ message: 'Invoice created', invoice });
  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

// Get all invoices
router.get('/', requireAuth, async (req, res) => {
  try {
    const query = {};
    if (req.user.userType === 'admin') {
      query.businessId = req.user.businessId;
    } else if (req.user.userType === 'customer') {
      query.customerId = req.user.id;
    }
    
    const invoices = await Invoice.find(query)
      .populate('customerId', 'name email phone companyName gstin state')
      .sort({ createdAt: -1 });
    res.json({ invoices });
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({ error: 'Failed to get invoices' });
  }
});

// Get invoice by ID
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const query = { _id: id };
    
    if (req.user.userType === 'admin') {
      query.businessId = req.user.businessId;
    } else if (req.user.userType === 'customer') {
      query.customerId = req.user.id;
    }
    
    const invoice = await Invoice.findOne(query)
      .populate('customerId', 'name email phone companyName gstin state address');
    
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json({ invoice });
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({ error: 'Failed to get invoice' });
  }
});

// Update invoice
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { items, customerId, date, dueDate, notes } = req.body;

    // If items are updated, recalculate totals
    if (items) {
      const business = await User.findById(req.user.businessId);
      const customer = await Customer.findById(customerId || req.body.customerId);
      
      if (business && customer) {
        const totals = calculateInvoiceTotals(
          items,
          customer.state,
          business.state
        );

        req.body = {
          ...req.body,
          items: totals.items,
          subtotal: totals.subtotal,
          cgst: totals.cgst,
          sgst: totals.sgst,
          igst: totals.igst,
          totalGST: totals.totalGST,
          grandTotal: totals.grandTotal
        };
      }
    }

    const invoice = await Invoice.findOneAndUpdate(
      { _id: id, businessId: req.user.businessId },
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json({ message: 'Invoice updated', invoice });
  } catch (error) {
    console.error('Update invoice error:', error);
    res.status(500).json({ error: 'Failed to update invoice' });
  }
});

// Update invoice status
router.patch('/:id/status', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['draft', 'pending', 'paid', 'overdue', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const invoice = await Invoice.findOne({ _id: id, businessId: req.user.businessId });
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // If invoice is finalized (status changed from draft to pending/paid), update stock
    if (invoice.status === 'draft' && (status === 'pending' || status === 'paid')) {
      // Deduct stock for each item
      for (const item of invoice.items) {
        await Product.findByIdAndUpdate(
          item.productId,
          { $inc: { stock: -item.quantity } }
        );
      }
    }

    const updated = await Invoice.findOneAndUpdate(
      { _id: id, businessId: req.user.businessId },
      { status },
      { new: true }
    );
    res.json({ message: 'Invoice status updated', invoice: updated });
  } catch (error) {
    console.error('Update invoice status error:', error);
    res.status(500).json({ error: 'Failed to update invoice status' });
  }
});

// Generate invoice PDF
router.get('/:id/pdf', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const query = { _id: id };
    
    if (req.user.userType === 'admin') {
      query.businessId = req.user.businessId;
    } else if (req.user.userType === 'customer') {
      query.customerId = req.user.id;
    }
    
    const invoice = await Invoice.findOne(query)
      .populate('customerId', 'name email phone companyName gstin state address');
    
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Get business and customer details
    const business = await User.findById(invoice.businessId);
    const customer = invoice.customerId;

    const pdfData = {
      invoiceNumber: invoice.invoiceNumber,
      date: invoice.date,
      dueDate: invoice.dueDate,
      business: {
        name: business.businessName || business.name,
        address: business.address,
        state: business.state,
        gstNumber: business.gstNumber
      },
      customer: {
        name: customer.name,
        companyName: customer.companyName,
        address: customer.billingAddress || customer.address,
        state: customer.state,
        gstin: customer.gstin
      },
      items: invoice.items,
      subtotal: invoice.subtotal,
      cgst: invoice.cgst,
      sgst: invoice.sgst,
      igst: invoice.igst,
      grandTotal: invoice.grandTotal,
      notes: invoice.notes
    };

    const pdfBuffer = await generateInvoicePDF(pdfData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.invoiceNumber}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Generate PDF error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// Delete invoice
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = await Invoice.findOneAndDelete({ _id: id, businessId: req.user.businessId });
    
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json({ message: 'Invoice deleted' });
  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
});

module.exports = router;

