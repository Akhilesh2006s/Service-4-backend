const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');

// Import products from CSV/Excel
router.post('/import/products', requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    let products = [];

    if (fileExtension === '.csv') {
      // Parse CSV
      const results = [];
      await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (data) => results.push(data))
          .on('end', resolve)
          .on('error', reject);
      });

      const baseTimestamp = Date.now();
      products = results.map((row, index) => {
        // Handle vegetable format: English Name, Hindi Name, Quantity (gm), Quantity (kg), Rate (per gm), Rate (per kg)
        const vegetableName = row['Vegetable Name (English)'] || row['Vegetable Name'] || row.name || row.Name;
        const vegetableNameHindi = row['Vegetable Name (Hindi)'] || row['Name (Hindi)'] || row.nameHindi;
        const quantityGm = parseFloat(row['Quantity (gm)'] || row['Quantity(gm)'] || 0);
        const quantityKg = parseFloat(row['Quantity (kg)'] || row['Quantity(kg)'] || 0);
        const ratePerGm = parseFloat(row['Rate (per unit/gm)'] || row['Rate (per gm)'] || row['Rate(per gm)'] || 0);
        const ratePerKg = parseFloat(row['Rate (per kg)'] || row['Rate(per kg)'] || 0);
        
        // Determine if this is vegetable format
        const isVegetableFormat = vegetableName && (vegetableNameHindi || quantityKg > 0 || ratePerKg > 0);
        
        if (isVegetableFormat) {
          // Use rate per kg as price, quantity in kg as stock
          return {
            name: vegetableName,
            nameHindi: vegetableNameHindi || '',
            price: ratePerKg > 0 ? ratePerKg : (ratePerGm * 1000), // Convert per gm to per kg if needed
            stock: quantityKg > 0 ? quantityKg : (quantityGm / 1000), // Convert gm to kg if needed
            unit: 'kg',
            category: 'vegetables',
            gstRate: 0, // Default GST for vegetables, can be updated later
            purchasePrice: 0,
            minStock: 0,
            sku: `VEG-${baseTimestamp}-${index}-${Math.random().toString(36).substr(2, 5)}`,
            hsnCode: '',
            description: ''
          };
        }
        
        // Standard product format
        return {
          name: row.name || row.Name,
          sku: row.sku || row.SKU || `SKU-${baseTimestamp}-${index}-${Math.random().toString(36).substr(2, 5)}`,
          hsnCode: row.hsnCode || row['HSN Code'] || '',
          price: parseFloat(row.price || row.Price || 0),
          purchasePrice: parseFloat(row.purchasePrice || row['Purchase Price'] || 0),
          gstRate: parseFloat(row.gstRate || row['GST Rate'] || 0),
          stock: parseFloat(row.stock || row.Stock || 0),
          minStock: parseFloat(row.minStock || row['Min Stock'] || 0),
          unit: row.unit || row.Unit || 'pcs',
          category: row.category || row.Category || '',
          nameHindi: row.nameHindi || row['Name (Hindi)'] || '',
          description: row.description || row.Description || ''
        };
      });
    } else if (['.xlsx', '.xls'].includes(fileExtension)) {
      // Parse Excel
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      const baseTimestamp = Date.now();
      products = data.map((row, index) => {
        // Handle vegetable format: English Name, Hindi Name, Quantity (gm), Quantity (kg), Rate (per gm), Rate (per kg)
        const vegetableName = row['Vegetable Name (English)'] || row['Vegetable Name'] || row.name || row.Name;
        const vegetableNameHindi = row['Vegetable Name (Hindi)'] || row['Name (Hindi)'] || row.nameHindi;
        const quantityGm = parseFloat(row['Quantity (gm)'] || row['Quantity(gm)'] || 0);
        const quantityKg = parseFloat(row['Quantity (kg)'] || row['Quantity(kg)'] || 0);
        const ratePerGm = parseFloat(row['Rate (per unit/gm)'] || row['Rate (per gm)'] || row['Rate(per gm)'] || 0);
        const ratePerKg = parseFloat(row['Rate (per kg)'] || row['Rate(per kg)'] || 0);
        
        // Determine if this is vegetable format
        const isVegetableFormat = vegetableName && (vegetableNameHindi || quantityKg > 0 || ratePerKg > 0);
        
        if (isVegetableFormat) {
          // Use rate per kg as price, quantity in kg as stock
          return {
            name: vegetableName,
            nameHindi: vegetableNameHindi || '',
            price: ratePerKg > 0 ? ratePerKg : (ratePerGm * 1000), // Convert per gm to per kg if needed
            stock: quantityKg > 0 ? quantityKg : (quantityGm / 1000), // Convert gm to kg if needed
            unit: 'kg',
            category: 'vegetables',
            gstRate: 0, // Default GST for vegetables, can be updated later
            purchasePrice: 0,
            minStock: 0,
            sku: `VEG-${baseTimestamp}-${index}-${Math.random().toString(36).substr(2, 5)}`,
            hsnCode: '',
            description: ''
          };
        }
        
        // Standard product format
        return {
          name: row.name || row.Name,
          sku: row.sku || row.SKU || `SKU-${baseTimestamp}-${index}-${Math.random().toString(36).substr(2, 5)}`,
          hsnCode: row.hsnCode || row['HSN Code'] || '',
          price: parseFloat(row.price || row.Price || 0),
          purchasePrice: parseFloat(row.purchasePrice || row['Purchase Price'] || 0),
          gstRate: parseFloat(row.gstRate || row['GST Rate'] || 0),
          stock: parseFloat(row.stock || row.Stock || 0),
          minStock: parseFloat(row.minStock || row['Min Stock'] || 0),
          unit: row.unit || row.Unit || 'pcs',
          category: row.category || row.Category || '',
          nameHindi: row.nameHindi || row['Name (Hindi)'] || '',
          description: row.description || row.Description || ''
        };
      });
    } else {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'Unsupported file format. Use CSV or Excel files.' });
    }

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    // Validate and create products
    const validProducts = products.filter(p => p.name && p.price !== undefined);
    
    if (validProducts.length === 0) {
      return res.status(400).json({ error: 'No valid products found in file' });
    }

    const productsToInsert = validProducts.map(p => ({
      ...p,
      businessId: req.user.businessId
    }));
    const result = await Product.insertMany(productsToInsert);

    res.json({
      message: 'Products imported successfully',
      imported: result.length,
      total: products.length
    });
  } catch (error) {
    console.error('Import products error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Failed to import products' });
  }
});

// Import customers from CSV/Excel
router.post('/import/customers', requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    let customers = [];

    if (fileExtension === '.csv') {
      const results = [];
      await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (data) => results.push(data))
          .on('end', resolve)
          .on('error', reject);
      });

      customers = results.map(row => ({
        name: row.name || row.Name,
        email: row.email || row.Email,
        phone: row.phone || row.Phone,
        gstin: row.gstin || row.GSTIN,
        companyName: row.companyName || row['Company Name'],
        state: row.state || row.State,
        pincode: row.pincode || row.Pincode,
        address: row.address || row.Address,
        openingBalance: parseFloat(row.openingBalance || row['Opening Balance'] || 0),
        creditLimit: parseFloat(row.creditLimit || row['Credit Limit'] || 0),
        discountPercentage: parseFloat(row.discountPercentage || row['Discount %'] || 0)
      }));
    } else if (['.xlsx', '.xls'].includes(fileExtension)) {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      customers = data.map(row => ({
        name: row.name || row.Name,
        email: row.email || row.Email,
        phone: row.phone || row.Phone,
        gstin: row.gstin || row.GSTIN,
        companyName: row.companyName || row['Company Name'],
        state: row.state || row.State,
        pincode: row.pincode || row.Pincode,
        address: row.address || row.Address,
        openingBalance: parseFloat(row.openingBalance || row['Opening Balance'] || 0),
        creditLimit: parseFloat(row.creditLimit || row['Credit Limit'] || 0),
        discountPercentage: parseFloat(row.discountPercentage || row['Discount %'] || 0)
      }));
    } else {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'Unsupported file format. Use CSV or Excel files.' });
    }

    fs.unlinkSync(filePath);

    const validCustomers = customers.filter(c => c.name && c.phone);
    
    if (validCustomers.length === 0) {
      return res.status(400).json({ error: 'No valid customers found in file' });
    }

    const customersToInsert = validCustomers.map(c => ({
      ...c,
      businessId: req.user.businessId
    }));
    const result = await Customer.insertMany(customersToInsert);

    res.json({
      message: 'Customers imported successfully',
      imported: result.length,
      total: customers.length
    });
  } catch (error) {
    console.error('Import customers error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Failed to import customers' });
  }
});

// Export products to CSV
router.get('/export/products', requireAdmin, async (req, res) => {
  try {
    const products = await Product.find({ businessId: req.user.businessId });
    
    // Convert to CSV
    const csvHeader = 'Name,SKU,HSN Code,Price,Purchase Price,GST Rate,Stock,Min Stock,Unit,Category\n';
    const csvRows = products.map(p => 
      `"${p.name}","${p.sku || ''}","${p.hsnCode || ''}",${p.price},${p.purchasePrice || 0},${p.gstRate},${p.stock},${p.minStock || 0},"${p.unit || 'pcs'}","${p.category || ''}"`
    ).join('\n');
    
    const csv = csvHeader + csvRows;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=products-export.csv');
    res.send(csv);
  } catch (error) {
    console.error('Export products error:', error);
    res.status(500).json({ error: 'Failed to export products' });
  }
});

// Export customers to CSV
router.get('/export/customers', requireAdmin, async (req, res) => {
  try {
    const customers = await Customer.find({ businessId: req.user.businessId });
    
    const csvHeader = 'Name,Email,Phone,GSTIN,Company Name,State,Address,Pincode,Opening Balance,Credit Limit,Discount %\n';
    const csvRows = customers.map(c => 
      `"${c.name}","${c.email || ''}","${c.phone}","${c.gstin || ''}","${c.companyName || ''}","${c.state || ''}","${c.address || ''}","${c.pincode || ''}",${c.openingBalance || 0},${c.creditLimit || 0},${c.discountPercentage || 0}`
    ).join('\n');
    
    const csv = csvHeader + csvRows;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=customers-export.csv');
    res.send(csv);
  } catch (error) {
    console.error('Export customers error:', error);
    res.status(500).json({ error: 'Failed to export customers' });
  }
});

// Export invoices to CSV
router.get('/export/invoices', requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const query = { businessId: req.user.businessId };
    if (startDate && endDate) {
      query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    const invoices = await Invoice.find(query)
      .populate('customerId', 'name')
      .sort({ date: -1 });
    
    const csvHeader = 'Invoice Number,Date,Customer,Subtotal,CGST,SGST,IGST,Grand Total,Status\n';
    const csvRows = invoices.map(inv => 
      `"${inv.invoiceNumber}","${inv.date}","${inv.customerId?.name || ''}",${inv.subtotal},${inv.cgst || 0},${inv.sgst || 0},${inv.igst || 0},${inv.grandTotal},"${inv.status}"`
    ).join('\n');
    
    const csv = csvHeader + csvRows;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=invoices-export-${startDate || 'all'}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Export invoices error:', error);
    res.status(500).json({ error: 'Failed to export invoices' });
  }
});

module.exports = router;

