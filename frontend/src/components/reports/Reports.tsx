import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API_BASE_URL from '../../config/api';

interface InvoiceItem {
  id: number;
  product_id: number;
  product_name: string;
  product_name_hindi?: string;
  quantity: number;
  unit_price: number;
  gst_rate: number;
  gst_amount: number;
  total: number;
}

interface Invoice {
  id: number;
  invoice_number: string;
  customer_id: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  invoice_date: string;
  due_date: string;
  status: string;
  subtotal: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
  notes: string;
  items: InvoiceItem[];
  order_id?: number;
  created_at: string;
  shipping_address?: string;
}

interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  shipping_address?: string;
}

const Reports: React.FC = () => {
  const navigate = useNavigate();
  const [activeReport, setActiveReport] = useState<'sales' | 'purchases' | 'bill-wise' | 'stock-summary' | 'pl-statement' | 'overview'>('sales');
  const [activeCategory, setActiveCategory] = useState<string>('transaction-reports');
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceDetails, setInvoiceDetails] = useState<Invoice | null>(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [inventoryData, setInventoryData] = useState<any[]>([]);
  const [inventorySummary, setInventorySummary] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [includeStockValue, setIncludeStockValue] = useState(false);
  const [plData, setPlData] = useState<any>(null);
  const [purchases, setPurchases] = useState<any[]>([]);

  useEffect(() => {
    loadCustomers();
    if (activeReport === 'sales' || activeReport === 'bill-wise') {
      loadSalesData();
    }
    if (activeReport === 'bill-wise') {
      loadProducts();
    }
    if (activeReport === 'stock-summary') {
      loadInventoryData();
    }
    if (activeReport === 'pl-statement') {
      loadPLData();
    }
    if (activeReport === 'purchases') {
      loadPurchasesData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeReport, dateFrom, dateTo, selectedCustomer, searchTerm, includeStockValue]);

  const loadProducts = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/products/`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setProducts(data.products || []);
        }
      }
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  };

  const loadInventoryData = async () => {
    try {
      setLoading(true);
      const url = `${API_BASE_URL}/products/inventory${searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : ''}`;
      const response = await fetch(url, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setInventoryData(data.inventory || []);
          setInventorySummary(data.summary || null);
        }
      }
    } catch (error) {
      console.error('Failed to load inventory data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPurchasesData = async () => {
    try {
      setLoading(true);
      
      // Fetch stock movements with type 'in' (purchases)
      const response = await fetch(`${API_BASE_URL}/products/stock-movements?movement_type=in`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          let filteredMovements = data.movements || [];
          
          // Filter by date range
          if (dateFrom) {
            filteredMovements = filteredMovements.filter((mov: any) => {
              if (!mov.created_at) return false;
              const movDate = new Date(mov.created_at);
              const fromDate = new Date(dateFrom);
              return movDate >= fromDate;
            });
          }
          
          if (dateTo) {
            filteredMovements = filteredMovements.filter((mov: any) => {
              if (!mov.created_at) return false;
              const movDate = new Date(mov.created_at);
              const toDate = new Date(dateTo);
              toDate.setHours(23, 59, 59, 999);
              return movDate <= toDate;
            });
          }
          
          // Load products to get purchase prices
          if (products.length === 0) {
            await loadProducts();
          }
          
          // Enrich movements with product data
          const enrichedPurchases = filteredMovements.map((mov: any) => {
            const product = products.find(p => p.id === mov.product_id);
            const purchasePrice = product?.purchase_price || 0;
            const totalAmount = purchasePrice * (mov.quantity || 0);
            
            return {
              ...mov,
              product_name: product?.name || 'Unknown Product',
              product_name_hindi: product?.vegetable_name_hindi || '',
              purchase_price: purchasePrice,
              total_amount: totalAmount
            };
          });
          
          setPurchases(enrichedPurchases);
        }
      }
    } catch (error) {
      console.error('Failed to load purchases data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPLData = async () => {
    try {
      setLoading(true);
      
      // Load products first if not already loaded
      if (products.length === 0) {
        await loadProducts();
      }
      
      // Load inventory summary if includeStockValue is true
      if (includeStockValue && !inventorySummary) {
        await loadInventoryData();
      }
      
      // Fetch invoices for the date range
      const response = await fetch(`${API_BASE_URL}/invoices/`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          let filteredInvoices = data.invoices || [];
          
          // Filter by date range
          if (dateFrom) {
            filteredInvoices = filteredInvoices.filter((inv: Invoice) => {
              if (!inv.invoice_date) return false;
              const invDate = new Date(inv.invoice_date);
              const fromDate = new Date(dateFrom);
              return invDate >= fromDate;
            });
          }
          
          if (dateTo) {
            filteredInvoices = filteredInvoices.filter((inv: Invoice) => {
              if (!inv.invoice_date) return false;
              const invDate = new Date(inv.invoice_date);
              const toDate = new Date(dateTo);
              toDate.setHours(23, 59, 59, 999);
              return invDate <= toDate;
            });
          }
          
          // Calculate Sales (subtotal without tax)
          let totalSales = 0;
          let totalCOGS = 0; // Cost of Goods Sold
          
          for (const invoice of filteredInvoices) {
            // Sales = subtotal (without tax)
            totalSales += invoice.subtotal || 0;
            
            // Calculate COGS from invoice items
            if (invoice.items && invoice.items.length > 0) {
              for (const item of invoice.items) {
                // Find product to get purchase price
                const product = products.find(p => p.id === item.product_id);
                const purchasePrice = product?.purchase_price || 0;
                const quantity = item.quantity || 0;
                totalCOGS += purchasePrice * quantity;
              }
            }
          }
          
          // Gross Profit = Sales - COGS
          const grossProfit = totalSales - totalCOGS;
          
          // Expenses (for now, set to 0 - can be extended later)
          const expenses = 0;
          
          // Net Profit = Gross Profit - Expenses
          const netProfit = grossProfit - expenses;
          
          // Stock Value (if includeStockValue is true)
          let stockValue = 0;
          if (includeStockValue) {
            if (inventorySummary) {
              stockValue = inventorySummary.stock_value_purchase_price || 0;
            } else {
              // Try to get from inventory data
              const invResponse = await fetch(`${API_BASE_URL}/products/inventory`, {
                credentials: 'include',
                headers: {
                  'Content-Type': 'application/json'
                }
              });
              if (invResponse.ok) {
                const invData = await invResponse.json();
                if (invData.success && invData.summary) {
                  stockValue = invData.summary.stock_value_purchase_price || 0;
                  setInventorySummary(invData.summary);
                }
              }
            }
          }
          
          setPlData({
            sales: totalSales,
            cogs: totalCOGS,
            grossProfit: grossProfit,
            expenses: expenses,
            netProfit: netProfit,
            stockValue: stockValue
          });
        }
      }
    } catch (error) {
      console.error('Failed to load P&L data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/customers`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCustomers(data.customers || []);
        }
      }
    } catch (error) {
      console.error('Failed to load customers:', error);
    }
  };

  const loadSalesData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/invoices/`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          let filteredInvoices = data.invoices || [];
          
          // Filter by date range
          if (dateFrom) {
            filteredInvoices = filteredInvoices.filter((inv: Invoice) => {
              if (!inv.invoice_date) return false;
              const invDate = new Date(inv.invoice_date);
              const fromDate = new Date(dateFrom);
              return invDate >= fromDate;
            });
          }
          
          if (dateTo) {
            filteredInvoices = filteredInvoices.filter((inv: Invoice) => {
              if (!inv.invoice_date) return false;
              const invDate = new Date(inv.invoice_date);
              const toDate = new Date(dateTo);
              toDate.setHours(23, 59, 59, 999);
              return invDate <= toDate;
            });
          }
          
          // Filter by customer
          if (selectedCustomer) {
            filteredInvoices = filteredInvoices.filter((inv: Invoice) => 
              inv.customer_id === parseInt(selectedCustomer)
            );
          }
          
          // Sort by date (newest first)
          filteredInvoices.sort((a: Invoice, b: Invoice) => {
            const dateA = new Date(a.invoice_date || a.created_at).getTime();
            const dateB = new Date(b.invoice_date || b.created_at).getTime();
            return dateB - dateA;
          });
          
          setInvoices(filteredInvoices);
        }
      }
    } catch (error) {
      console.error('Failed to load sales data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const handleExportExcel = async () => {
    try {
      let csvRows: any[] = [];
      let filename = '';
      
      if (activeReport === 'bill-wise') {
        // Bill-wise export
        csvRows.push(['Product Name', 'Qty', 'Bill #', 'Party Shipping Details']);
        
        invoices.forEach((invoice) => {
          const customer = customers.find(c => c.id === invoice.customer_id);
          const shippingDetails = customer?.shipping_address || invoice.shipping_address || '';
          const items = invoice.items || [];
          
          items.forEach((item: InvoiceItem) => {
            const product = products.find(p => p.id === item.product_id);
            const productName = item.product_name || 'Unknown Product';
            const productNameHindi = product?.vegetable_name_hindi || item.product_name_hindi || '';
            const displayName = productNameHindi ? `${productName} - ${productNameHindi}` : productName;
            
            csvRows.push([
              displayName,
              item.quantity || 0,
              invoice.invoice_number || `INV-${invoice.id}`,
              shippingDetails
            ]);
          });
        });
        filename = `bill_wise_items_${dateFrom}_to_${dateTo}.csv`;
      } else if (activeReport === 'stock-summary') {
        // Stock Summary export
        csvRows.push(['Product Name', 'SKU', 'Category', 'Stock Quantity', 'Min Stock Level', 'Unit Price', 'Purchase Price', 'Stock Value', 'Status']);
        
        inventoryData.forEach((item) => {
          const productName = item.vegetable_name_hindi 
            ? `${item.name} - ${item.vegetable_name_hindi}`
            : item.name;
          const stockValue = (item.stock_quantity || 0) * (item.price || 0);
          
          csvRows.push([
            productName,
            item.sku || '',
            item.category || '',
            `${item.stock_quantity || 0} ${item.unit || 'PCS'}`,
            item.min_stock_level || 0,
            item.price || 0,
            item.purchase_price || 0,
            stockValue,
            item.status === 'out_of_stock' ? 'Out of Stock' :
            item.status === 'low_stock' ? 'Low Stock' : 'In Stock'
          ]);
        });
        filename = `stock_summary_${new Date().toISOString().split('T')[0]}.csv`;
      } else if (activeReport === 'pl-statement') {
        // P&L Statement export
        csvRows.push(['Transaction Type (without tax)', 'Total Amount']);
        
        if (plData) {
          csvRows.push(['Sales (+)', plData.sales || 0]);
          csvRows.push(['Gross Profit', plData.grossProfit || 0]);
          if (includeStockValue && plData.stockValue > 0) {
            csvRows.push(['Stock Value', plData.stockValue || 0]);
          }
          csvRows.push(['Net Profit', (plData.netProfit || 0) + (includeStockValue ? (plData.stockValue || 0) : 0)]);
        }
        filename = `pl_statement_${dateFrom}_to_${dateTo}.csv`;
      } else if (activeReport === 'purchases') {
        // Purchases export
        csvRows.push(['Date', 'Product Name', 'Quantity', 'Purchase Price', 'Total Amount', 'Reference']);
        
        purchases.forEach((purchase) => {
          const productName = purchase.product_name_hindi 
            ? `${purchase.product_name} - ${purchase.product_name_hindi}`
            : purchase.product_name;
          
          csvRows.push([
            formatDate(purchase.created_at),
            productName,
            purchase.quantity || 0,
            purchase.purchase_price || 0,
            purchase.total_amount || 0,
            purchase.reference || ''
          ]);
        });
        filename = `purchases_report_${dateFrom}_to_${dateTo}.csv`;
      } else {
        // Sales export
        csvRows.push(['Serial Number', 'Date', 'Total Amount', 'Party Name', 'Party Shipping Details']);
        
        invoices.forEach((invoice, index) => {
          const customer = customers.find(c => c.id === invoice.customer_id);
          const shippingDetails = customer?.shipping_address || invoice.shipping_address || invoice.customer_name || '';
          
          csvRows.push([
            invoice.invoice_number || `INV-${invoice.id}`,
            formatDate(invoice.invoice_date || invoice.created_at),
            invoice.total_amount || 0,
            invoice.customer_name || '',
            shippingDetails
          ]);
        });
        filename = `sales_report_${dateFrom}_to_${dateTo}.csv`;
      }
      
      const csvContent = csvRows.map(row => row.map((cell: any) => `"${cell}"`).join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Failed to export Excel:', error);
      alert('Failed to export to Excel');
    }
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleExportPDF = async () => {
    try {
      // For now, we'll use a simple approach - in production, you'd call a backend endpoint
      alert('PDF export functionality will be implemented via backend API');
    } catch (error) {
      console.error('Failed to export PDF:', error);
      alert('Failed to export to PDF');
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Sales Report',
        text: `Sales Report from ${dateFrom} to ${dateTo}`,
        url: window.location.href
      }).catch(err => console.error('Error sharing:', err));
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href).then(() => {
        alert('Link copied to clipboard!');
      });
    }
  };

  const handleInvoiceClick = async (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowInvoiceModal(true);
    setLoadingInvoice(true);
    
    try {
      // Fetch full invoice details
      const response = await fetch(`${API_BASE_URL}/invoices/${invoice.id}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Merge with items from the invoice if available
          const fullInvoice = {
            ...invoice,
            ...data.invoice,
            items: data.invoice.items || invoice.items || []
          };
          setInvoiceDetails(fullInvoice);
        } else {
          // Use the invoice data we already have
          setInvoiceDetails(invoice);
        }
      } else {
        // Use the invoice data we already have
        setInvoiceDetails(invoice);
      }
    } catch (error) {
      console.error('Failed to load invoice details:', error);
      // Use the invoice data we already have
      setInvoiceDetails(invoice);
    } finally {
      setLoadingInvoice(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar Navigation */}
      <div className="w-64 bg-white border-r border-gray-200 h-screen overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center space-x-2 mb-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-gray-600 hover:text-gray-900"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-xl font-bold text-gray-900">Reports</h2>
          </div>
        </div>
        
        <div className="p-2">
          {/* Taxes */}
          <div className="mb-2">
            <button
              onClick={() => setActiveCategory(activeCategory === 'taxes' ? '' : 'taxes')}
              className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md"
            >
              <span>Taxes</span>
              <svg
                className={`h-4 w-4 transform transition-transform ${activeCategory === 'taxes' ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Transaction Reports */}
          <div className="mb-2">
            <button
              onClick={() => setActiveCategory(activeCategory === 'transaction-reports' ? '' : 'transaction-reports')}
              className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md"
            >
              <span>Transaction Reports</span>
              <svg
                className={`h-4 w-4 transform transition-transform ${activeCategory === 'transaction-reports' ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {activeCategory === 'transaction-reports' && (
              <div className="ml-4 mt-1 space-y-1">
                <button
                  onClick={() => setActiveReport('sales')}
                  className={`w-full text-left px-3 py-2 text-sm rounded-md ${
                    activeReport === 'sales'
                      ? 'bg-gray-200 text-gray-900 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Sales
                </button>
                <button
                  onClick={() => setActiveReport('purchases')}
                  className={`w-full text-left px-3 py-2 text-sm rounded-md ${
                    activeReport === 'purchases'
                      ? 'bg-gray-200 text-gray-900 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Purchases
                </button>
              </div>
            )}
          </div>

          {/* Bill-wise Item Reports */}
          <div className="mb-2">
            <button
              onClick={() => {
                const newCategory = activeCategory === 'bill-wise' ? '' : 'bill-wise';
                setActiveCategory(newCategory);
                if (newCategory === 'bill-wise') {
                  setActiveReport('bill-wise');
                }
              }}
              className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md ${
                activeReport === 'bill-wise'
                  ? 'bg-gray-200 text-gray-900'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>Bill-wise Item Reports</span>
              <svg
                className={`h-4 w-4 transform transition-transform ${activeCategory === 'bill-wise' ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Item Reports */}
          <div className="mb-2">
            <button
              onClick={() => {
                const newCategory = activeCategory === 'item-reports' ? '' : 'item-reports';
                setActiveCategory(newCategory);
              }}
              className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md"
            >
              <span>Item Reports</span>
              <svg
                className={`h-4 w-4 transform transition-transform ${activeCategory === 'item-reports' ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {activeCategory === 'item-reports' && (
              <div className="ml-4 mt-1 space-y-1">
                <button
                  onClick={() => setActiveReport('stock-summary')}
                  className={`w-full text-left px-3 py-2 text-sm rounded-md ${
                    activeReport === 'stock-summary'
                      ? 'bg-gray-200 text-gray-900 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Stock Summary
                </button>
              </div>
            )}
          </div>

          {/* P&L Statement */}
          <div className="mb-2">
            <button
              onClick={() => {
                const newCategory = activeCategory === 'pl-statement' ? '' : 'pl-statement';
                setActiveCategory(newCategory);
                if (newCategory === 'pl-statement') {
                  setActiveReport('pl-statement');
                }
              }}
              className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md ${
                activeReport === 'pl-statement'
                  ? 'bg-gray-200 text-gray-900'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>P&L Statement</span>
              <svg
                className={`h-4 w-4 transform transition-transform ${activeCategory === 'pl-statement' ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {activeReport === 'sales' && (
          <div className="p-6">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <h1 className="text-2xl font-bold text-gray-900">Sales</h1>
                  <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleExportExcel}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Excel
                  </button>
                  <button
                    onClick={handleExportPDF}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    PDF
                  </button>
                  <button
                    onClick={handleShare}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Share
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setShowColumnsMenu(!showColumnsMenu)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Columns
                    </button>
                    {showColumnsMenu && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                        <div className="p-2">
                          <label className="flex items-center px-3 py-2 hover:bg-gray-50 rounded cursor-pointer">
                            <input type="checkbox" defaultChecked className="mr-2" />
                            <span className="text-sm text-gray-700">Serial Number</span>
                          </label>
                          <label className="flex items-center px-3 py-2 hover:bg-gray-50 rounded cursor-pointer">
                            <input type="checkbox" defaultChecked className="mr-2" />
                            <span className="text-sm text-gray-700">Date</span>
                          </label>
                          <label className="flex items-center px-3 py-2 hover:bg-gray-50 rounded cursor-pointer">
                            <input type="checkbox" defaultChecked className="mr-2" />
                            <span className="text-sm text-gray-700">Total Amount</span>
                          </label>
                          <label className="flex items-center px-3 py-2 hover:bg-gray-50 rounded cursor-pointer">
                            <input type="checkbox" defaultChecked className="mr-2" />
                            <span className="text-sm text-gray-700">Party Name</span>
                          </label>
                          <label className="flex items-center px-3 py-2 hover:bg-gray-50 rounded cursor-pointer">
                            <input type="checkbox" defaultChecked className="mr-2" />
                            <span className="text-sm text-gray-700">Party Shipping Details</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Filters */}
              <div className="flex items-center space-x-4 mb-4">
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-gray-700">Date Range:</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-gray-500">→</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-gray-700">Customer:</label>
                  <select
                    value={selectedCustomer}
                    onChange={(e) => setSelectedCustomer(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]"
                  >
                    <option value="">Select customer</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="border-b border-gray-200">
                <div className="px-4 py-2">
                  <span className="text-sm font-medium text-gray-700">SALES</span>
                </div>
              </div>
              
              {loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading sales data...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <div className="flex items-center space-x-1">
                            <span>Serial Number</span>
                            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                            </svg>
                          </div>
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <div className="flex items-center space-x-1">
                            <span>Date</span>
                            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                            </svg>
                          </div>
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <div className="flex items-center space-x-1">
                            <span>Total Amount</span>
                            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                            </svg>
                          </div>
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Party Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Party Shipping Details
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {invoices.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                            No sales data found for the selected filters
                          </td>
                        </tr>
                      ) : (
                        invoices.map((invoice, index) => {
                          const customer = customers.find(c => c.id === invoice.customer_id);
                          const shippingDetails = customer?.shipping_address || invoice.shipping_address || '';
                          
                          return (
                            <tr key={invoice.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <button
                                  onClick={() => handleInvoiceClick(invoice)}
                                  className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                                >
                                  {invoice.invoice_number || `INV-${invoice.id}`}
                                </button>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {formatDate(invoice.invoice_date || invoice.created_at)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-green-50">
                                {formatCurrency(invoice.total_amount || 0)}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-900">
                                {invoice.customer_name || 'Unknown Customer'}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-900">
                                {shippingDetails || '-'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeReport === 'purchases' && (
          <div className="p-6">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <h1 className="text-2xl font-bold text-gray-900">Purchases</h1>
                  <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleExportExcel}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Excel
                  </button>
                  <button
                    onClick={handleExportPDF}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    PDF
                  </button>
                  <button
                    onClick={handleShare}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Share
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="flex items-center space-x-4 mb-4">
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-gray-700">Date Range:</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-gray-500">→</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="border-b border-gray-200">
                <div className="px-4 py-2">
                  <span className="text-sm font-medium text-gray-700">PURCHASES</span>
                </div>
              </div>
              
              {loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading purchases data...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Product Name
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Quantity
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Purchase Price
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Amount
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Reference
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {purchases.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                            No purchases found for the selected date range
                          </td>
                        </tr>
                      ) : (
                        purchases.map((purchase) => {
                          const productName = purchase.product_name_hindi 
                            ? `${purchase.product_name} - ${purchase.product_name_hindi}`
                            : purchase.product_name;
                          
                          return (
                            <tr key={purchase.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {formatDate(purchase.created_at)}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-900">
                                {productName}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                {purchase.quantity || 0}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                {formatCurrency(purchase.purchase_price || 0)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-green-50 text-right">
                                {formatCurrency(purchase.total_amount || 0)}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500">
                                {purchase.reference || '-'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    {purchases.length > 0 && (
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td colSpan={4} className="px-6 py-4 text-sm font-bold text-gray-900 text-right">
                            Total:
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                            {formatCurrency(purchases.reduce((sum, p) => sum + (p.total_amount || 0), 0))}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeReport === 'pl-statement' && (
          <div className="p-6">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <h1 className="text-2xl font-bold text-gray-900">P&L Statement</h1>
                  <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleExportExcel}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Excel
                  </button>
                  <button
                    onClick={handleExportPDF}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    PDF
                  </button>
                  <button
                    onClick={handleShare}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Share
                  </button>
                  <button
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="flex items-center space-x-6 mb-4">
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-2">Date Range</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-gray-500">→</span>
                    <div className="relative">
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8"
                      />
                      <svg className="absolute right-2 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-2">Include Stock Value</label>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setIncludeStockValue(!includeStockValue)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        includeStockValue ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          includeStockValue ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <span className="text-sm text-gray-600">Include Stock Value</span>
                  </div>
                </div>
              </div>
            </div>

            {/* P&L Statement Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="border-b border-gray-200">
                <div className="px-4 py-2">
                  <span className="text-sm font-medium text-blue-600 border-b-2 border-blue-600 pb-2 inline-block">PL STATEMENT</span>
                </div>
              </div>
              
              {loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading P&L Statement...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Transaction Type (without tax)
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {plData ? (
                        <>
                          <tr className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                              Sales (+)
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                              {formatCurrency(plData.sales || 0)}
                            </td>
                          </tr>
                          <tr className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                              Gross Profit
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                              {formatCurrency(plData.grossProfit || 0)}
                            </td>
                          </tr>
                          {includeStockValue && plData.stockValue > 0 && (
                            <tr className="hover:bg-gray-50">
                              <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                Stock Value
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                                {formatCurrency(plData.stockValue || 0)}
                              </td>
                            </tr>
                          )}
                          <tr className="hover:bg-gray-50 bg-green-50">
                            <td className="px-6 py-4 text-sm font-bold text-gray-900">
                              Net Profit
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                              {formatCurrency((plData.netProfit || 0) + (includeStockValue ? (plData.stockValue || 0) : 0))}
                            </td>
                          </tr>
                        </>
                      ) : (
                        <tr>
                          <td colSpan={2} className="px-6 py-8 text-center text-gray-500">
                            No P&L data available for the selected date range
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeReport === 'stock-summary' && (
          <div className="p-6">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <h1 className="text-2xl font-bold text-gray-900">Stock Summary</h1>
                  <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleExportExcel}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Excel
                  </button>
                  <button
                    onClick={handleExportPDF}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    PDF
                  </button>
                  <button
                    onClick={handleShare}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Share
                  </button>
                </div>
              </div>

              {/* Search Filter */}
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Summary Cards */}
              {inventorySummary && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <p className="text-sm font-medium text-gray-600 mb-1">Total Products</p>
                    <p className="text-2xl font-bold text-gray-900">{inventorySummary.total_products || 0}</p>
                  </div>
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <p className="text-sm font-medium text-gray-600 mb-1">Low Stock Items</p>
                    <p className="text-2xl font-bold text-red-600">{inventorySummary.low_stock?.items || 0}</p>
                  </div>
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <p className="text-sm font-medium text-gray-600 mb-1">Stock Value (Sales)</p>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(inventorySummary.stock_value_sales_price || 0)}</p>
                  </div>
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <p className="text-sm font-medium text-gray-600 mb-1">Stock Value (Purchase)</p>
                    <p className="text-2xl font-bold text-blue-600">{formatCurrency(inventorySummary.stock_value_purchase_price || 0)}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Stock Summary Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="border-b border-gray-200">
                <div className="px-4 py-2">
                  <span className="text-sm font-medium text-gray-700">STOCK SUMMARY</span>
                </div>
              </div>
              
              {loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading stock summary...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Product Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          SKU
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Category
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Stock Quantity
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Min Stock Level
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Unit Price
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Purchase Price
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Stock Value
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {inventoryData.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                            No stock data found
                          </td>
                        </tr>
                      ) : (
                        inventoryData.map((item) => {
                          const stockValue = (item.stock_quantity || 0) * (item.price || 0);
                          const isLowStock = item.status === 'low_stock' || item.status === 'out_of_stock';
                          
                          return (
                            <tr key={item.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 text-sm text-gray-900">
                                {item.vegetable_name_hindi 
                                  ? `${item.name} - ${item.vegetable_name_hindi}`
                                  : item.name}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {item.sku || '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {item.category || '-'}
                              </td>
                              <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                                isLowStock ? 'text-red-600' : 'text-gray-900'
                              }`}>
                                {item.stock_quantity || 0} {item.unit || 'PCS'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                {item.min_stock_level || 0}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                {formatCurrency(item.price || 0)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                {formatCurrency(item.purchase_price || 0)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right bg-green-50">
                                {formatCurrency(stockValue)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  item.status === 'out_of_stock' ? 'bg-red-100 text-red-800' :
                                  item.status === 'low_stock' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-green-100 text-green-800'
                                }`}>
                                  {item.status === 'out_of_stock' ? 'Out of Stock' :
                                   item.status === 'low_stock' ? 'Low Stock' :
                                   'In Stock'}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeReport === 'bill-wise' && (
          <div className="p-6">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <h1 className="text-2xl font-bold text-gray-900">Bill-wise Item Reports</h1>
                  <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleExportExcel}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Excel
                  </button>
                  <button
                    onClick={handleExportPDF}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    PDF
                  </button>
                  <button
                    onClick={handleShare}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Share
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="flex items-center space-x-4 mb-4">
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-gray-700">Date Range:</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-gray-500">→</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-gray-700">Customer:</label>
                  <select
                    value={selectedCustomer}
                    onChange={(e) => setSelectedCustomer(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]"
                  >
                    <option value="">Select customer</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Bill-wise Items Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="border-b border-gray-200">
                <div className="px-4 py-2">
                  <span className="text-sm font-medium text-gray-700">SALES</span>
                </div>
              </div>
              
              {loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading bill-wise items...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Product Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <button
                            onClick={() => handleSort('quantity')}
                            className="flex items-center space-x-1 hover:text-gray-700"
                          >
                            <span>Qty</span>
                            <div className="flex flex-col">
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              </svg>
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </button>
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <button
                            onClick={() => handleSort('bill')}
                            className="flex items-center space-x-1 hover:text-gray-700"
                          >
                            <span>Bill #</span>
                            <div className="flex flex-col">
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              </svg>
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                            <svg className="h-4 w-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                            </svg>
                          </button>
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Party Shipping Details
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {(() => {
                        // Flatten all invoice items into a single array
                        let allItems: Array<{
                          invoice: Invoice;
                          item: InvoiceItem;
                          product: any;
                          shippingDetails: string;
                        }> = [];

                        invoices.forEach((invoice) => {
                          const customer = customers.find(c => c.id === invoice.customer_id);
                          const shippingDetails = customer?.shipping_address || invoice.shipping_address || '';
                          const items = invoice.items || [];
                          
                          items.forEach((item: InvoiceItem) => {
                            const product = products.find(p => p.id === item.product_id);
                            allItems.push({
                              invoice,
                              item,
                              product: product || null,
                              shippingDetails
                            });
                          });
                        });

                        // Apply sorting
                        if (sortConfig) {
                          allItems.sort((a, b) => {
                            let aVal: any, bVal: any;
                            
                            if (sortConfig.key === 'quantity') {
                              aVal = a.item.quantity || 0;
                              bVal = b.item.quantity || 0;
                            } else if (sortConfig.key === 'bill') {
                              aVal = a.invoice.invoice_number || `INV-${a.invoice.id}`;
                              bVal = b.invoice.invoice_number || `INV-${b.invoice.id}`;
                            } else {
                              return 0;
                            }
                            
                            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                            return 0;
                          });
                        }

                        if (allItems.length === 0) {
                          return (
                            <tr>
                              <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                                No bill-wise items found for the selected filters
                              </td>
                            </tr>
                          );
                        }

                        return allItems.map(({ invoice, item, product, shippingDetails }, index) => {
                          const productName = item.product_name || 'Unknown Product';
                          const productNameHindi = product?.vegetable_name_hindi || item.product_name_hindi || '';
                          const displayName = productNameHindi ? `${productName} - ${productNameHindi}` : productName;
                          
                          return (
                            <tr key={`${invoice.id}-${item.id || index}`} className="hover:bg-gray-50">
                              <td className="px-6 py-4 text-sm text-gray-900">
                                {displayName}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {item.quantity || 0}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                                <button
                                  onClick={() => handleInvoiceClick(invoice)}
                                  className="hover:underline"
                                >
                                  {invoice.invoice_number || `INV-${invoice.id}`}
                                </button>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-900">
                                {shippingDetails || '-'}
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Invoice Details Modal */}
      {showInvoiceModal && invoiceDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                Invoice Details - {invoiceDetails.invoice_number || `INV-${invoiceDetails.id}`}
              </h2>
              <button
                onClick={() => {
                  setShowInvoiceModal(false);
                  setSelectedInvoice(null);
                  setInvoiceDetails(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {loadingInvoice ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading invoice details...</p>
              </div>
            ) : (
              <div className="p-6">
                {/* Invoice Header Info */}
                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Customer Information</h3>
                    <p className="text-sm text-gray-900 font-medium">{invoiceDetails.customer_name || 'Unknown Customer'}</p>
                    <p className="text-sm text-gray-600">{invoiceDetails.customer_email || ''}</p>
                    <p className="text-sm text-gray-600">{invoiceDetails.customer_phone || ''}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Invoice Information</h3>
                    <p className="text-sm text-gray-900">
                      <span className="font-medium">Date:</span> {formatDate(invoiceDetails.invoice_date || invoiceDetails.created_at)}
                    </p>
                    {invoiceDetails.due_date && (
                      <p className="text-sm text-gray-900">
                        <span className="font-medium">Due Date:</span> {formatDate(invoiceDetails.due_date)}
                      </p>
                    )}
                    <p className="text-sm text-gray-900">
                      <span className="font-medium">Status:</span>{' '}
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        invoiceDetails.status === 'paid' ? 'bg-green-100 text-green-800' :
                        invoiceDetails.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        invoiceDetails.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {invoiceDetails.status?.toUpperCase() || 'PENDING'}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Invoice Items Table */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Invoice Items</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product Name</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">GST Rate</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">GST Amount</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {invoiceDetails.items && invoiceDetails.items.length > 0 ? (
                          invoiceDetails.items.map((item: any, index: number) => (
                            <tr key={item.id || index}>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{index + 1}</td>
                              <td className="px-4 py-3 text-sm text-gray-900">{item.product_name || 'Unknown Product'}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">{item.quantity || 0}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(item.unit_price || 0)}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">{item.gst_rate || 0}%</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(item.gst_amount || 0)}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 text-right">{formatCurrency(item.total || 0)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                              No items found in this invoice
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Invoice Summary */}
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex justify-end">
                    <div className="w-64 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Subtotal:</span>
                        <span className="text-gray-900 font-medium">{formatCurrency(invoiceDetails.subtotal || 0)}</span>
                      </div>
                      {invoiceDetails.cgst_amount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">CGST:</span>
                          <span className="text-gray-900 font-medium">{formatCurrency(invoiceDetails.cgst_amount || 0)}</span>
                        </div>
                      )}
                      {invoiceDetails.sgst_amount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">SGST:</span>
                          <span className="text-gray-900 font-medium">{formatCurrency(invoiceDetails.sgst_amount || 0)}</span>
                        </div>
                      )}
                      {invoiceDetails.igst_amount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">IGST:</span>
                          <span className="text-gray-900 font-medium">{formatCurrency(invoiceDetails.igst_amount || 0)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
                        <span className="text-gray-900">Total Amount:</span>
                        <span className="text-gray-900">{formatCurrency(invoiceDetails.total_amount || 0)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {invoiceDetails.notes && (
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Notes</h3>
                    <p className="text-sm text-gray-900">{invoiceDetails.notes}</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      const url = `${API_BASE_URL}/invoices/${invoiceDetails.id}/pdf`;
                      window.open(url, '_blank');
                    }}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                  >
                    Download PDF
                  </button>
                  <button
                    onClick={() => {
                      setShowInvoiceModal(false);
                      setSelectedInvoice(null);
                      setInvoiceDetails(null);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
