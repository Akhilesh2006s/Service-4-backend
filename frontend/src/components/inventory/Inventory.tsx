import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import API_BASE_URL from '../../config/api';

interface InventoryItem {
  id: number;
  name: string;
  vegetable_name_hindi?: string;
  sku: string;
  category: string;
  stock_quantity: number;
  min_stock_level: number;
  price: number;
  purchase_price: number;
  unit: string;
  last_updated: string | null;
  status: string;
}

interface InventorySummary {
  low_stock: {
    items: number;
    quantity: number;
  };
  positive_stock: {
    items: number;
    quantity: number;
  };
  stock_value_sales_price: number;
  stock_value_purchase_price: number;
  total_products: number;
}

const Inventory: React.FC = () => {
  const navigate = useNavigate();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkType, setBulkType] = useState<'in' | 'out'>('in');
  const [bulkItems, setBulkItems] = useState<{product_id: number; quantity: number}[]>([]);
  const [showStockModal, setShowStockModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);
  const [stockQuantity, setStockQuantity] = useState('');
  const [stockType, setStockType] = useState<'in' | 'out'>('in');
  const [importingStock, setImportingStock] = useState(false);
  const [importStockResult, setImportStockResult] = useState<{
    success: boolean;
    imported?: number;
    skipped?: number;
    errors?: string[];
    error?: string;
  } | null>(null);

  useEffect(() => {
    const checkAuth = () => {
      const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
      const userType = localStorage.getItem('userType');
      
      if (!isAuthenticated || userType !== 'admin') {
        navigate('/login');
        return false;
      }
      return true;
    };

    if (checkAuth()) {
      loadInventory();
    }
  }, [navigate, searchTerm, selectedCategory]);

  const loadInventory = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedCategory && selectedCategory !== 'All') params.append('category', selectedCategory);
      
      const response = await fetch(`${API_BASE_URL}/products/inventory?${params.toString()}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setInventory(data.inventory || []);
          setSummary(data.summary || null);
        }
      } else {
        console.error('Failed to load inventory');
      }
    } catch (error) {
      console.error('Failed to load inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const categories = useMemo(() => {
    const cats = new Set<string>();
    inventory.forEach(item => {
      if (item.category) cats.add(item.category);
    });
    return Array.from(cats).sort();
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      const matchesSearch = !searchTerm || 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.vegetable_name_hindi && item.vegetable_name_hindi.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [inventory, searchTerm, selectedCategory]);

  const paginatedInventory = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredInventory.slice(start, end);
  }, [filteredInventory, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredInventory.length / itemsPerPage);

  const formatQuantity = (qty: number, unit: string) => {
    if (unit === 'KGS' || unit === 'KG') {
      return `${qty} KGS`;
    } else if (unit === 'GMS' || unit === 'GM') {
      return `${qty} GMS`;
    }
    return `${qty} ${unit}`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } else if (diffDays < 7) {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return `${days[date.getDay()]} ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    } else {
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) + ', ' +
             date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
  };

  const handleStockMovement = async (productId: number, type: 'in' | 'out', quantity: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/products/${productId}/stock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          movement_type: type,
          quantity: quantity,
          reference: 'Manual adjustment',
          notes: `Stock ${type === 'in' ? 'in' : 'out'} from inventory`
        })
      });
      
      const data = await response.json();
      if (data.success) {
        loadInventory();
        setShowStockModal(false);
        setSelectedProduct(null);
        setStockQuantity('');
      } else {
        alert(`Failed to update stock: ${data.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error updating stock:', error);
      alert(`Error updating stock: ${error.message}`);
    }
  };

  const handleBulkStock = async () => {
    if (bulkItems.length === 0) {
      alert('Please select at least one item');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/products/bulk-stock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          movement_type: bulkType,
          items: bulkItems,
          reference: 'Bulk operation',
          notes: `Bulk stock ${bulkType === 'in' ? 'in' : 'out'}`
        })
      });
      
      const data = await response.json();
      if (data.success) {
        alert(`Successfully processed ${data.processed} items`);
        if (data.errors && data.errors.length > 0) {
          console.warn('Errors:', data.errors);
        }
        loadInventory();
        setShowBulkModal(false);
        setBulkItems([]);
      } else {
        alert(`Failed to process bulk stock: ${data.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error processing bulk stock:', error);
      alert(`Error processing bulk stock: ${error.message}`);
    }
  };

  const handleImportStock = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.csv') && !fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      alert('Please select a CSV or Excel file (.csv, .xlsx, .xls)');
      return;
    }

    setImportingStock(true);
    setImportStockResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('movement_type', bulkType);

      const response = await fetch(`${API_BASE_URL}/import/stock`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        setImportStockResult({
          success: true,
          imported: data.imported,
          skipped: data.skipped,
          errors: data.errors || []
        });
        loadInventory();
      } else {
        setImportStockResult({
          success: false,
          error: data.error || 'Import failed'
        });
      }
    } catch (error: any) {
      setImportStockResult({
        success: false,
        error: error.message || 'Failed to import stock'
      });
    } finally {
      setImportingStock(false);
      e.target.value = '';
    }
  };

  const openStockModal = (product: InventoryItem, type: 'in' | 'out') => {
    setSelectedProduct(product);
    setStockType(type);
    setStockQuantity('');
    setShowStockModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading inventory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => {
                  setBulkType('in');
                  setShowBulkModal(true);
                }}
                className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                Bulk Items Stock In
              </button>
              <button
                onClick={() => {
                  setBulkType('out');
                  setShowBulkModal(true);
                }}
                className="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
                Bulk Items Stock Out
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Low Stock</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {summary.low_stock.items} Items ({summary.low_stock.quantity.toLocaleString('en-IN')} Qty)
                  </p>
                </div>
        </div>
                      </div>
            <div className="bg-green-50 rounded-lg shadow-sm border border-green-200 p-4">
                      <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-700 mb-1">Positive Stock</p>
                  <p className="text-lg font-semibold text-green-900">
                    {summary.positive_stock.items} Items ({summary.positive_stock.quantity.toLocaleString('en-IN')} Qty)
                  </p>
                      </div>
                      </div>
                    </div>
            <div className="bg-blue-50 rounded-lg shadow-sm border border-blue-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-1 mb-1">
                    <p className="text-sm text-blue-700">Stock Value Sales Price</p>
                    <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-lg font-semibold text-blue-900">
                    ₹{summary.stock_value_sales_price.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-orange-50 rounded-lg shadow-sm border border-orange-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-1 mb-1">
                    <p className="text-sm text-orange-700">Stock Value With Purchase Price</p>
                    <svg className="h-4 w-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-lg font-semibold text-orange-900">
                    ₹{summary.stock_value_purchase_price.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search Inventory"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="All">Select Category</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <select className="px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            <option>Actions</option>
          </select>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center space-x-1">
                      <span>Item</span>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
          </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center space-x-1">
                      <span>Qty</span>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Purchase Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sale Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Updated
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedInventory.length > 0 ? (
                  paginatedInventory.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{item.name}</div>
                          {item.vegetable_name_hindi && (
                            <div className="text-sm text-gray-500">{item.vegetable_name_hindi}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-medium px-2 py-1 rounded ${
                          item.stock_quantity < 0 
                            ? 'bg-pink-100 text-pink-800' 
                            : item.stock_quantity === 0
                            ? 'bg-red-100 text-red-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {formatQuantity(item.stock_quantity, item.unit)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">₹{item.purchase_price.toFixed(2)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">₹{item.price.toFixed(2)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{formatDate(item.last_updated)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => openStockModal(item, 'in')}
                            className="inline-flex items-center px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded transition-colors"
                          >
                            <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Stock In
                          </button>
              <button
                            onClick={() => openStockModal(item, 'out')}
                            className="inline-flex items-center px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded transition-colors"
              >
                            <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                            </svg>
                            Stock Out
              </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No inventory items found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-700">Items per page:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded text-sm text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  &lt;
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-1 border rounded text-sm ${
                        currentPage === pageNum
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                {totalPages > 5 && currentPage < totalPages - 2 && (
                  <span className="px-2 text-gray-500">...</span>
                )}
                {totalPages > 5 && (
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    className={`px-3 py-1 border rounded text-sm ${
                      currentPage === totalPages
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {totalPages}
              </button>
            )}
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded text-sm text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  &gt;
                </button>
              </div>
          </div>
        )}
        </div>
      </div>

      {/* Stock In/Out Modal */}
      {showStockModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Stock {stockType === 'in' ? 'In' : 'Out'} - {selectedProduct.name}
              </h2>
              <button
                onClick={() => {
                  setShowStockModal(false);
                  setSelectedProduct(null);
                  setStockQuantity('');
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
              <div className="space-y-4">
                <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Stock: <span className="font-semibold">{formatQuantity(selectedProduct.stock_quantity, selectedProduct.unit)}</span>
                  </label>
                </div>
                <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantity to {stockType === 'in' ? 'Add' : 'Remove'}
                  </label>
                  <input
                    type="number"
                    min="0"
                  step="0.01"
                  value={stockQuantity}
                  onChange={(e) => setStockQuantity(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter quantity"
                  autoFocus
                />
              </div>
              {stockType === 'out' && selectedProduct.stock_quantity < parseFloat(stockQuantity || '0') && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-800">
                    Warning: Insufficient stock. Available: {formatQuantity(selectedProduct.stock_quantity, selectedProduct.unit)}
                  </p>
                </div>
              )}
              </div>
              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => {
                  setShowStockModal(false);
                  setSelectedProduct(null);
                  setStockQuantity('');
                  }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2.5 px-4 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                onClick={() => {
                  const qty = parseFloat(stockQuantity);
                  if (isNaN(qty) || qty <= 0) {
                    alert('Please enter a valid quantity');
                    return;
                  }
                  if (stockType === 'out' && qty > selectedProduct.stock_quantity) {
                    alert('Insufficient stock');
                    return;
                  }
                  handleStockMovement(selectedProduct.id, stockType, qty);
                }}
                className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-colors text-white ${
                  stockType === 'in' 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                Confirm {stockType === 'in' ? 'Stock In' : 'Stock Out'}
                </button>
              </div>
          </div>
        </div>
      )}

      {/* Bulk Stock Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Bulk Stock {bulkType === 'in' ? 'In' : 'Out'}
              </h2>
              <button
                onClick={() => {
                  setShowBulkModal(false);
                  setBulkItems([]);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Select products and enter quantities for bulk {bulkType === 'in' ? 'stock in' : 'stock out'}.
                </p>
                <label className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer">
                  <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Import from Excel/CSV
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleImportStock}
                    className="hidden"
                    disabled={importingStock}
                  />
                </label>
              </div>
              {importingStock && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">Importing stock data...</p>
        </div>
      )}
              {importStockResult && (
                <div className={`border rounded-lg p-3 ${
                  importStockResult.success 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`}>
                  {importStockResult.success ? (
                    <div>
                      <p className="text-sm font-medium text-green-800">
                        Successfully imported {importStockResult.imported} items
                      </p>
                      {importStockResult.skipped && importStockResult.skipped > 0 && (
                        <p className="text-sm text-yellow-700 mt-1">
                          Skipped {importStockResult.skipped} items
                        </p>
                      )}
                      {importStockResult.errors && importStockResult.errors.length > 0 && (
                        <details className="mt-2">
                          <summary className="text-sm text-gray-700 cursor-pointer">View errors</summary>
                          <ul className="text-xs text-red-700 mt-1 space-y-1 list-disc list-inside">
                            {importStockResult.errors.map((error, idx) => (
                              <li key={idx}>{error}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-red-800">{importStockResult.error}</p>
                  )}
                  </div>
                )}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs font-medium text-blue-900 mb-1">Excel/CSV Format:</p>
                <p className="text-xs text-blue-700">
                  Required columns: <strong>Product ID</strong> (or <strong>SKU</strong> or <strong>Product Name</strong>), <strong>Quantity</strong> (or <strong>Qty</strong>)
                  <br />
                  Optional columns: <strong>Reference</strong>, <strong>Notes</strong>
                </p>
              </div>
              <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Stock</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {inventory.map((item) => {
                      const bulkItem = bulkItems.find(bi => bi.product_id === item.id);
                      return (
                        <tr key={item.id}>
                          <td className="px-4 py-3 text-sm text-gray-900">{item.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{formatQuantity(item.stock_quantity, item.unit)}</td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={bulkItem?.quantity || ''}
                              onChange={(e) => {
                                const qty = parseFloat(e.target.value) || 0;
                                if (qty > 0) {
                                  setBulkItems(prev => {
                                    const filtered = prev.filter(bi => bi.product_id !== item.id);
                                    return [...filtered, { product_id: item.id, quantity: qty }];
                                  });
                                } else {
                                  setBulkItems(prev => prev.filter(bi => bi.product_id !== item.id));
                                }
                              }}
                              className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="0"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => {
                    setShowBulkModal(false);
                    setBulkItems([]);
                  }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2.5 px-4 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
            <button
                  onClick={handleBulkStock}
                  className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-colors text-white ${
                    bulkType === 'in' 
                      ? 'bg-green-600 hover:bg-green-700' 
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  Process Bulk {bulkType === 'in' ? 'Stock In' : 'Stock Out'}
            </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
