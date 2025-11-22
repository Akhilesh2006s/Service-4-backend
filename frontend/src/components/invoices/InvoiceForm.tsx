import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  stock_quantity: number;
  image_url: string;
}

interface InvoiceItem {
  product_id: number;
  quantity: number;
  unit_price: number;
  total: number;
  product?: Product;
}

interface InvoiceFormData {
  business_name: string;
  business_address: string;
  business_phone: string;
  customer_name: string;
  customer_address: string;
  customer_phone: string;
  invoice_date: string;
  notes: string;
  items: InvoiceItem[];
  custom_columns: { [key: string]: string };
}

interface Invoice {
  id: number;
  invoice_number: string;
  customer_name: string;
  business_name: string;
  total_amount: number;
  created_at: string;
  status: string;
}

const InvoiceForm: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [formData, setFormData] = useState<InvoiceFormData>({
    business_name: 'My Business Name',
    business_address: '123 Business Street, City, State 12345',
    business_phone: '+91 9876543210',
    customer_name: 'John Doe',
    customer_address: '456 Customer Avenue, City, State 67890',
    customer_phone: '+91 1234567890',
    invoice_date: new Date().toISOString().split('T')[0],
    notes: 'Thank you for your business!',
    items: [],
    custom_columns: {}
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [selectedProductIndex, setSelectedProductIndex] = useState<number>(-1);
  const [customColumns, setCustomColumns] = useState<{ [key: string]: string }>({});
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = products.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredProducts(filtered);
    } else {
      setFilteredProducts([]);
    }
  }, [searchTerm, products]);

  const loadProducts = async () => {
    try {
      const response = await fetch('/api/products/', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setProducts(data.products || []);
      }
    } catch (error: any) {
      console.error('Failed to load products:', error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCustomColumnChange = (key: string, value: string) => {
    setCustomColumns(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const addCustomColumn = () => {
    const columnName = prompt('Enter column name:');
    if (columnName && columnName.trim()) {
      setCustomColumns(prev => ({
        ...prev,
        [columnName.trim()]: ''
      }));
    }
  };

  const removeCustomColumn = (key: string) => {
    const newColumns = { ...customColumns };
    delete newColumns[key];
    setCustomColumns(newColumns);
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, {
        product_id: 0,
        quantity: 1,
        unit_price: 0,
        total: 0
      }]
    }));
  };

  const removeItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      
      // Recalculate total
      if (field === 'quantity' || field === 'unit_price') {
        newItems[index].total = newItems[index].quantity * newItems[index].unit_price;
      }
      
      return { ...prev, items: newItems };
    });
  };

  const selectProduct = (index: number) => {
    setSelectedProductIndex(index);
    setShowProductSearch(true);
  };

  const handleProductSelect = (product: Product) => {
    if (selectedProductIndex >= 0) {
      updateItem(selectedProductIndex, 'product_id', product.id);
      updateItem(selectedProductIndex, 'unit_price', product.price);
      updateItem(selectedProductIndex, 'product', product);
    }
    setShowProductSearch(false);
    setSelectedProductIndex(-1);
    setSearchTerm('');
  };

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => sum + item.total, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const requestData = {
      ...formData,
      total_amount: calculateTotal(),
      custom_columns: customColumns
    };

    console.log('Sending invoice data:', requestData);

    try {
      const response = await fetch('https://web-production-84a3.up.railway.app/api/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(requestData)
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);

      if (response.ok) {
        const data = await response.json();
        console.log('Response data:', data);
        if (data.success) {
          navigate('/invoices');
        } else {
          setError(data.error || 'Failed to create invoice');
        }
      } else {
        const errorText = await response.text();
        console.log('Error response:', errorText);
        setError('Failed to create invoice');
      }
    } catch (error: any) {
      console.error('Fetch error:', error);
      setError('Failed to create invoice');
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = () => {
    setCurrentInvoice({
      id: 0,
      invoice_number: 'PREVIEW',
      customer_name: formData.customer_name,
      business_name: formData.business_name,
      total_amount: calculateTotal(),
      created_at: formData.invoice_date,
      status: 'draft'
    });
    setShowInvoicePreview(true);
  };

  const downloadPDF = async () => {
    try {
      // Create a temporary div with the invoice content
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = `
        <div style="padding: 20px; font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #333; margin-bottom: 10px; font-size: 28px;">${formData.business_name}</h1>
            <p style="color: #666; margin: 5px 0; font-size: 14px;">${formData.business_address}</p>
            <p style="color: #666; margin: 5px 0; font-size: 14px;">Phone: ${formData.business_phone}</p>
          </div>
          
          <div style="margin-bottom: 30px;">
            <h2 style="color: #333; text-align: center; margin-bottom: 20px; font-size: 24px;">INVOICE</h2>
            <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
              <div>
                <strong>Invoice #:</strong> PREVIEW<br>
                <strong>Date:</strong> ${new Date(formData.invoice_date).toLocaleDateString()}
              </div>
            </div>
          </div>
          
          <div style="margin-bottom: 30px;">
            <h3 style="color: #333; font-size: 18px;">Bill To:</h3>
            <p style="margin: 5px 0; font-weight: bold; font-size: 16px;">${formData.customer_name}</p>
            <p style="margin: 5px 0; color: #666; font-size: 14px;">${formData.customer_address}</p>
            <p style="margin: 5px 0; color: #666; font-size: 14px;">Phone: ${formData.customer_phone}</p>
          </div>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
            <thead>
              <tr style="background-color: #f8f9fa;">
                <th style="border: 1px solid #ddd; padding: 12px; text-align: left; font-size: 14px;">Item</th>
                <th style="border: 1px solid #ddd; padding: 12px; text-align: center; font-size: 14px;">Quantity</th>
                <th style="border: 1px solid #ddd; padding: 12px; text-align: right; font-size: 14px;">Unit Price</th>
                <th style="border: 1px solid #ddd; padding: 12px; text-align: right; font-size: 14px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${formData.items.map((item) => `
                <tr>
                  <td style="border: 1px solid #ddd; padding: 12px; font-size: 14px;">
                    ${item.product ? item.product.name : 'Product'}
                  </td>
                  <td style="border: 1px solid #ddd; padding: 12px; text-align: center; font-size: 14px;">${item.quantity}</td>
                  <td style="border: 1px solid #ddd; padding: 12px; text-align: right; font-size: 14px;">₹${item.unit_price.toFixed(2)}</td>
                  <td style="border: 1px solid #ddd; padding: 12px; text-align: right; font-size: 14px; font-weight: bold;">₹${item.total.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr style="background-color: #f8f9fa;">
                <td colspan="3" style="border: 1px solid #ddd; padding: 12px; text-align: right; font-size: 16px;"><strong>Total:</strong></td>
                <td style="border: 1px solid #ddd; padding: 12px; text-align: right; font-size: 16px;"><strong>₹${calculateTotal().toFixed(2)}</strong></td>
              </tr>
            </tfoot>
          </table>
          
          ${Object.keys(customColumns).length > 0 ? `
            <div style="margin-bottom: 30px;">
              <h3 style="color: #333; font-size: 18px;">Additional Information:</h3>
              ${Object.entries(customColumns).map(([key, value]) => `
                <p style="margin: 5px 0; font-size: 14px;"><strong>${key}:</strong> ${value}</p>
              `).join('')}
            </div>
          ` : ''}
          
          ${formData.notes ? `
            <div style="margin-bottom: 30px;">
              <h3 style="color: #333; font-size: 18px;">Notes:</h3>
              <p style="color: #666; font-size: 14px;">${formData.notes}</p>
            </div>
          ` : ''}
          
          <div style="text-align: center; margin-top: 50px; color: #666; font-size: 14px;">
            <p>Thank you for your business!</p>
            <p style="font-size: 12px;">This is a computer generated invoice. No signature required.</p>
          </div>
        </div>
      `;
      
      document.body.appendChild(tempDiv);
      
      // Use html2pdf library for client-side PDF generation
      const html2pdf = (await import('html2pdf.js')).default;
      
      const opt = {
        margin: 0.5,
        filename: `invoice_preview.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
      };
      
      await html2pdf().set(opt).from(tempDiv).save();
      
      document.body.removeChild(tempDiv);
    } catch (error: any) {
      console.error('PDF generation error:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/invoices')}
                className="mr-4 p-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div className="flex-shrink-0">
                <div className="h-12 w-12 bg-green-600 rounded-lg flex items-center justify-center">
                  <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
              <div className="ml-6">
                <h1 className="text-2xl font-semibold text-gray-900">
                  {isEditing ? 'Edit Invoice' : 'Create New Invoice'}
                </h1>
                <p className="text-gray-600 text-sm">Fill in the details below</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Business Information */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Business Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 text-sm font-medium mb-2">Business Name</label>
                <input
                  type="text"
                  name="business_name"
                  value={formData.business_name}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 text-sm font-medium mb-2">Business Phone</label>
                <input
                  type="text"
                  name="business_phone"
                  value={formData.business_phone}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-gray-700 text-sm font-medium mb-2">Business Address</label>
                <textarea
                  name="business_address"
                  value={formData.business_address}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>
          </div>

          {/* Customer Information */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 text-sm font-medium mb-2">Customer Name</label>
                <input
                  type="text"
                  name="customer_name"
                  value={formData.customer_name}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 text-sm font-medium mb-2">Customer Phone</label>
                <input
                  type="text"
                  name="customer_phone"
                  value={formData.customer_phone}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-gray-700 text-sm font-medium mb-2">Customer Address</label>
                <textarea
                  name="customer_address"
                  value={formData.customer_address}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>
          </div>

          {/* Invoice Details */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Invoice Items</h2>
              <button
                type="button"
                onClick={addItem}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Add Item</span>
              </button>
            </div>

            {formData.items.map((item, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2">Product</label>
                    <button
                      type="button"
                      onClick={() => selectProduct(index)}
                      className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 text-left hover:bg-gray-50 transition-colors"
                    >
                      {item.product ? item.product.name : 'Select Product'}
                    </button>
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2">Quantity</label>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                      min="1"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2">Unit Price</label>
                    <input
                      type="number"
                      value={item.unit_price}
                      onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                      min="0"
                      step="0.01"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex items-end space-x-2">
                    <div className="flex-1">
                      <label className="block text-gray-700 text-sm font-medium mb-2">Total</label>
                      <div className="px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900">
                        ₹{item.total.toFixed(2)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="p-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {formData.items.length === 0 && (
              <div className="text-center py-12">
                <div className="h-16 w-16 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-gray-600 text-base">No items added yet</p>
                <p className="text-gray-500 text-sm">Click "Add Item" to start building your invoice</p>
              </div>
            )}

            {formData.items.length > 0 && (
              <div className="mt-6 text-right">
                <div className="text-xl font-bold text-gray-900">
                  Total: ₹{calculateTotal().toFixed(2)}
                </div>
              </div>
            )}
          </div>

          {/* Custom Columns */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Custom Columns</h2>
              <button
                type="button"
                onClick={addCustomColumn}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Add Column</span>
              </button>
            </div>
            
            {Object.keys(customColumns).length === 0 ? (
              <div className="text-center py-8">
                <div className="h-16 w-16 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-gray-600 text-base">No custom columns added</p>
                <p className="text-gray-500 text-sm">Click "Add Column" to add custom fields to your invoice</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(customColumns).map(([key, value]) => (
                  <div key={key} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-gray-700 text-sm font-medium">{key}</label>
                      <button
                        type="button"
                        onClick={() => removeCustomColumn(key)}
                        className="p-1 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => handleCustomColumnChange(key, e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder={`Enter ${key}`}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Additional Information */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Additional Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 text-sm font-medium mb-2">Invoice Date</label>
                <input
                  type="date"
                  name="invoice_date"
                  value={formData.invoice_date}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 text-sm font-medium mb-2">Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between items-center">
            <button
              type="button"
              onClick={() => navigate('/invoices')}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={handlePreview}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                Preview
              </button>
              <button
                type="button"
                onClick={downloadPDF}
                disabled={formData.items.length === 0}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Download PDF
              </button>
              <button
                type="submit"
                disabled={loading || formData.items.length === 0}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                 {loading ? 'Creating...' : 'Create Invoice'}
               </button>
             </div>
          </div>

          {error && (
            <div className="backdrop-blur-xl bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
              <p className="text-red-400">{error}</p>
            </div>
          )}
        </form>
      </div>

      {/* Product Search Modal */}
      {showProductSearch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowProductSearch(false)}></div>
          <div className="backdrop-blur-xl bg-white/10 rounded-3xl shadow-2xl border border-white/20 p-8 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-white">Select Product</h3>
              <button
                onClick={() => setShowProductSearch(false)}
                className="p-2 rounded-2xl bg-white/10 text-white hover:bg-white/20 transition-all duration-300"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="mb-6">
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  onClick={() => handleProductSelect(product)}
                  className="backdrop-blur-xl bg-white/5 rounded-2xl p-4 border border-white/10 cursor-pointer hover:bg-white/10 transition-all duration-300"
                >
                  <div className="h-32 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl mb-4 flex items-center justify-center">
                    {product.image_url ? (
                      <img 
                        src={product.image_url} 
                        alt={product.name}
                        className="w-full h-full object-cover rounded-2xl"
                      />
                    ) : (
                      <span className="text-white text-4xl font-bold">
                        {product.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <h4 className="text-lg font-bold text-white mb-2">{product.name}</h4>
                  <p className="text-gray-300 text-sm mb-2 line-clamp-2">{product.description}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-green-400 font-bold">₹{product.price}</span>
                    <span className="text-gray-400 text-sm">{product.stock_quantity} in stock</span>
                  </div>
                </div>
              ))}
            </div>

            {filteredProducts.length === 0 && searchTerm && (
              <div className="text-center py-12">
                <p className="text-gray-300">No products found matching "{searchTerm}"</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Invoice Preview Modal */}
      {showInvoicePreview && currentInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowInvoicePreview(false)}></div>
          <div className="backdrop-blur-xl bg-white/10 rounded-3xl shadow-2xl border border-white/20 p-8 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-white">Invoice Preview</h3>
              <button
                onClick={() => setShowInvoicePreview(false)}
                className="p-2 rounded-2xl bg-white/10 text-white hover:bg-white/20 transition-all duration-300"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="bg-white rounded-2xl p-8 text-black">
              {/* Invoice Header */}
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h1 className="text-3xl font-bold text-gray-800">{formData.business_name}</h1>
                  <p className="text-gray-600 mt-2">{formData.business_address}</p>
                  <p className="text-gray-600">{formData.business_phone}</p>
                </div>
                <div className="text-right">
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">INVOICE</h2>
                  <p className="text-gray-600">Date: {formData.invoice_date}</p>
                  <p className="text-gray-600">Invoice #: {currentInvoice.invoice_number}</p>
                </div>
              </div>

              {/* Customer Info */}
              <div className="mb-8">
                <h3 className="text-lg font-bold text-gray-800 mb-2">Bill To:</h3>
                <p className="text-gray-600 font-semibold">{formData.customer_name}</p>
                <p className="text-gray-600">{formData.customer_address}</p>
                <p className="text-gray-600">{formData.customer_phone}</p>
              </div>

              {/* Invoice Items */}
              <div className="mb-8">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-300">
                      <th className="text-left py-3 px-4 font-bold text-gray-800">Item</th>
                      <th className="text-right py-3 px-4 font-bold text-gray-800">Quantity</th>
                      <th className="text-right py-3 px-4 font-bold text-gray-800">Unit Price</th>
                      <th className="text-right py-3 px-4 font-bold text-gray-800">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.items.map((item, index) => (
                      <tr key={index} className="border-b border-gray-200">
                        <td className="py-3 px-4 text-gray-800">
                          {item.product ? item.product.name : 'Product'}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-800">{item.quantity}</td>
                        <td className="py-3 px-4 text-right text-gray-800">₹{item.unit_price.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right text-gray-800 font-semibold">₹{item.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total */}
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-800">
                  Total: ₹{calculateTotal().toFixed(2)}
                </div>
              </div>

                             {/* Custom Columns */}
               {Object.keys(customColumns).length > 0 && (
                 <div className="mt-8 pt-8 border-t border-gray-300">
                   <h3 className="text-lg font-bold text-gray-800 mb-2">Additional Information:</h3>
                   {Object.entries(customColumns).map(([key, value]) => (
                     <p key={key} className="text-gray-600 mb-1">
                       <span className="font-semibold">{key}:</span> {value}
                     </p>
                   ))}
                 </div>
               )}

               {/* Notes */}
               {formData.notes && (
                 <div className="mt-8 pt-8 border-t border-gray-300">
                   <h3 className="text-lg font-bold text-gray-800 mb-2">Notes:</h3>
                   <p className="text-gray-600">{formData.notes}</p>
                 </div>
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceForm;
