// PDF Generation utility for invoices
const PDFDocument = require('pdfkit');

/**
 * Generate invoice PDF
 * @param {object} invoiceData - Invoice data object
 * @returns {Buffer} - PDF buffer
 */
const generateInvoicePDF = (invoiceData) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);

      // Header
      doc.fontSize(20).text('TAX INVOICE', { align: 'center' });
      doc.moveDown();

      // Business Details
      if (invoiceData.business) {
        doc.fontSize(14).text(invoiceData.business.name || 'Business Name', { align: 'left' });
        doc.fontSize(10);
        if (invoiceData.business.address) {
          doc.text(invoiceData.business.address);
        }
        if (invoiceData.business.state) {
          doc.text(`State: ${invoiceData.business.state}`);
        }
        if (invoiceData.business.gstNumber) {
          doc.text(`GSTIN: ${invoiceData.business.gstNumber}`);
        }
        doc.moveDown();
      }

      // Invoice Details
      doc.fontSize(12);
      doc.text(`Invoice Number: ${invoiceData.invoiceNumber || 'N/A'}`, { align: 'right' });
      doc.text(`Date: ${invoiceData.date || new Date().toLocaleDateString()}`, { align: 'right' });
      if (invoiceData.dueDate) {
        doc.text(`Due Date: ${invoiceData.dueDate}`, { align: 'right' });
      }
      doc.moveDown();

      // Customer Details
      if (invoiceData.customer) {
        doc.fontSize(12).text('Bill To:', { underline: true });
        doc.fontSize(10);
        doc.text(invoiceData.customer.name || 'Customer Name');
        if (invoiceData.customer.companyName) {
          doc.text(invoiceData.customer.companyName);
        }
        if (invoiceData.customer.address) {
          doc.text(invoiceData.customer.address);
        }
        if (invoiceData.customer.state) {
          doc.text(`State: ${invoiceData.customer.state}`);
        }
        if (invoiceData.customer.gstin) {
          doc.text(`GSTIN: ${invoiceData.customer.gstin}`);
        }
        doc.moveDown();
      }

      // Items Table
      doc.moveDown();
      const tableTop = doc.y;
      const itemHeight = 20;
      let currentY = tableTop;

      // Table Header
      doc.fontSize(10);
      doc.text('S.No', 50, currentY);
      doc.text('Item', 100, currentY);
      doc.text('HSN', 200, currentY);
      doc.text('Qty', 280, currentY);
      doc.text('Rate', 330, currentY);
      doc.text('GST %', 380, currentY);
      doc.text('Amount', 430, currentY);
      currentY += itemHeight;

      // Draw line
      doc.moveTo(50, currentY).lineTo(550, currentY).stroke();
      currentY += 5;

      // Items
      if (invoiceData.items && invoiceData.items.length > 0) {
        invoiceData.items.forEach((item, index) => {
          doc.text(String(index + 1), 50, currentY);
          doc.text(item.name || 'Item', 100, currentY, { width: 90 });
          doc.text(item.hsnCode || '-', 200, currentY);
          doc.text(`${item.quantity} ${item.unit || ''}`, 280, currentY);
          doc.text(`₹${item.unitPrice.toFixed(2)}`, 330, currentY);
          doc.text(`${item.gstRate || 0}%`, 380, currentY);
          doc.text(`₹${item.itemTotal.toFixed(2)}`, 430, currentY);
          currentY += itemHeight;
        });
      }

      // Totals
      currentY += 10;
      doc.moveTo(50, currentY).lineTo(550, currentY).stroke();
      currentY += 15;

      doc.text('Subtotal:', 350, currentY);
      doc.text(`₹${invoiceData.subtotal.toFixed(2)}`, 430, currentY, { align: 'right' });
      currentY += 15;

      if (invoiceData.cgst > 0) {
        doc.text('CGST:', 350, currentY);
        doc.text(`₹${invoiceData.cgst.toFixed(2)}`, 430, currentY, { align: 'right' });
        currentY += 15;
      }

      if (invoiceData.sgst > 0) {
        doc.text('SGST:', 350, currentY);
        doc.text(`₹${invoiceData.sgst.toFixed(2)}`, 430, currentY, { align: 'right' });
        currentY += 15;
      }

      if (invoiceData.igst > 0) {
        doc.text('IGST:', 350, currentY);
        doc.text(`₹${invoiceData.igst.toFixed(2)}`, 430, currentY, { align: 'right' });
        currentY += 15;
      }

      doc.moveTo(50, currentY).lineTo(550, currentY).stroke();
      currentY += 15;

      doc.fontSize(12).text('Grand Total:', 350, currentY);
      doc.fontSize(14).text(`₹${invoiceData.grandTotal.toFixed(2)}`, 430, currentY, { align: 'right' });

      // Notes
      if (invoiceData.notes) {
        currentY += 30;
        doc.fontSize(10).text('Notes:', 50, currentY);
        doc.text(invoiceData.notes, 50, currentY + 15, { width: 500 });
      }

      // Footer
      const pageHeight = doc.page.height;
      doc.fontSize(8)
         .text('This is a computer-generated invoice.', 50, pageHeight - 50, { align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = {
  generateInvoicePDF
};




