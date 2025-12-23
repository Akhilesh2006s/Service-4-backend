// GST Calculation utilities

/**
 * Calculate GST for an item
 * @param {number} itemTotal - Total price for the item (quantity × unit price)
 * @param {number} gstRate - GST rate percentage (e.g., 18 for 18%)
 * @returns {number} - GST amount
 */
const calculateGST = (itemTotal, gstRate) => {
  return (itemTotal * gstRate) / 100;
};

/**
 * Calculate CGST and SGST (for same state transactions)
 * @param {number} totalGST - Total GST amount
 * @returns {object} - { cgst, sgst }
 */
const calculateCGSTSGST = (totalGST) => {
  const half = totalGST / 2;
  return {
    cgst: half,
    sgst: half
  };
};

/**
 * Calculate invoice totals with GST
 * @param {Array} items - Array of items with { quantity, unitPrice, gstRate }
 * @param {string} customerState - Customer's state
 * @param {string} businessState - Business owner's state
 * @returns {object} - Invoice totals breakdown
 */
const calculateInvoiceTotals = (items, customerState, businessState) => {
  let subtotal = 0;
  let totalGST = 0;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  // Calculate item totals and GST
  const itemsWithTotals = items.map(item => {
    const itemTotal = item.quantity * item.unitPrice;
    const itemGST = calculateGST(itemTotal, item.gstRate || 0);
    
    subtotal += itemTotal;
    totalGST += itemGST;

    return {
      ...item,
      itemTotal,
      itemGST
    };
  });

  // Determine tax type based on states
  const isSameState = customerState && businessState && 
                      customerState.toLowerCase() === businessState.toLowerCase();

  if (isSameState) {
    // Same state: CGST + SGST
    const taxes = calculateCGSTSGST(totalGST);
    cgst = taxes.cgst;
    sgst = taxes.sgst;
  } else {
    // Different state: IGST
    igst = totalGST;
  }

  const grandTotal = subtotal + cgst + sgst + igst;

  return {
    items: itemsWithTotals,
    subtotal: parseFloat(subtotal.toFixed(2)),
    cgst: parseFloat(cgst.toFixed(2)),
    sgst: parseFloat(sgst.toFixed(2)),
    igst: parseFloat(igst.toFixed(2)),
    totalGST: parseFloat(totalGST.toFixed(2)),
    grandTotal: parseFloat(grandTotal.toFixed(2)),
    isSameState
  };
};

/**
 * Generate unique invoice number
 * @param {string} userId - Business owner's user ID
 * @param {number} invoiceCount - Current invoice count for the user
 * @returns {string} - Invoice number (format: INV-{userId}-{number})
 */
const generateInvoiceNumber = (userId, invoiceCount) => {
  const invoiceNum = String(invoiceCount + 1).padStart(6, '0');
  return `INV-${userId}-${invoiceNum}`;
};

module.exports = {
  calculateGST,
  calculateCGSTSGST,
  calculateInvoiceTotals,
  generateInvoiceNumber
};




