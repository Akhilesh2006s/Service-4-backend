import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import API_BASE_URL from '../../config/api';

interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  gstin: string;
  billing_address: string;
  shipping_address: string;
  state: string;
  pincode: string;
  created_at: string;
  is_active: boolean;
}

interface Invoice {
  id: number;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  status: string;
  created_at: string;
}

interface Order {
  id: number;
  order_number: string;
  order_date: string;
  status: string;
  total_amount: number;
  created_at: string;
}

interface CustomerPrice {
  id: number;
  product_id: number;
  product_name: string;
  price: number;
  default_price: number;
}

const CustomerDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customerPrices, setCustomerPrices] = useState<CustomerPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'invoices' | 'orders' | 'pricing'>('details');

  useEffect(() => {
    if (id) {
      loadCustomerDetails();
    }
  }, [id]);

  const loadCustomerDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Ensure id is a valid number
      const customerId = id ? parseInt(id, 10) : null;
      if (!customerId || isNaN(customerId)) {
        setError('Invalid customer ID');
        setLoading(false);
        return;
      }
      
      // Load customer details
      const customerResponse = await fetch(`${API_BASE_URL}/admin/customers/${customerId}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (customerResponse.ok) {
        const customerData = await customerResponse.json();
        console.log('Customer data received:', customerData);
        
        if (customerData.success && customerData.customer) {
          setCustomer(customerData.customer);
          
          // Load customer invoices
          loadInvoices(customerData.customer.id);
          
          // Load customer orders
          loadOrders(customerData.customer.id);
          
          // Load customer-specific prices
          loadCustomerPrices(customerData.customer.id);
        } else {
          setError(customerData.message || 'Failed to load customer data');
        }
      } else {
        const errorData = await customerResponse.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.error || `HTTP ${customerResponse.status}: ${customerResponse.statusText}`;
        setError(errorMessage);
        console.error('Failed to load customer:', errorMessage);
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to load customer details';
      setError(errorMessage);
      console.error('Failed to load customer details:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadInvoices = async (customerId: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/invoices?customer_id=${customerId}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Invoices are already filtered by customer_id in the backend
          setInvoices((data.invoices || []).slice(0, 10)); // Show last 10 invoices
        }
      }
    } catch (error: any) {
      console.error('Failed to load invoices:', error);
    }
  };

  const loadOrders = async (customerId: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/orders?customer_id=${customerId}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Orders are already filtered by customer_id in the backend
          setOrders((data.orders || []).slice(0, 10)); // Show last 10 orders
        }
      }
    } catch (error: any) {
      console.error('Failed to load orders:', error);
    }
  };

  const loadCustomerPrices = async (customerId: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/products/customer-prices?customer_id=${customerId}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCustomerPrices(data.prices || []);
        }
      }
    } catch (error: any) {
      console.error('Failed to load customer prices:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading customer details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="h-20 w-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="h-10 w-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Error Loading Customer</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="flex space-x-4 justify-center">
            <button
              onClick={() => navigate('/customers')}
              className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Back to Customers
            </button>
            <button
              onClick={() => {
                setError(null);
                loadCustomerDetails();
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="h-20 w-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="h-10 w-10 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Customer Not Found</h2>
          <p className="text-gray-600 mb-6">The customer you're looking for doesn't exist or has been deleted.</p>
          <button
            onClick={() => navigate('/customers')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Back to Customers
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="backdrop-blur-xl bg-white/10 border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/customers')}
                className="bg-gray-600 hover:bg-gray-700 text-white p-2 rounded-xl transition-all duration-300"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div>
                <h1 className="text-3xl font-bold text-white">{customer.name}</h1>
                <p className="text-gray-300">Customer Details</p>
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => navigate(`/customers/${customer.id}/edit`)}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-xl font-medium transition-all duration-300"
              >
                Edit Customer
              </button>
              <button
                onClick={() => navigate(`/invoices/new?customer_id=${customer.id}`)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-medium transition-all duration-300"
              >
                Create Invoice
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="mb-8">
          <div className="flex space-x-4 border-b border-white/20">
            {[
              { key: 'details', label: 'Details', icon: '👤' },
              { key: 'invoices', label: 'Invoices', icon: '🧾' },
              { key: 'orders', label: 'Orders', icon: '📦' },
              { key: 'pricing', label: 'Pricing', icon: '💰' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`py-4 px-6 border-b-2 font-semibold text-lg transition-all duration-300 flex items-center space-x-2 ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="mt-8">
          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Customer Information Card */}
              <div className="backdrop-blur-xl bg-white/10 rounded-3xl shadow-2xl border border-white/20 p-6">
                <h2 className="text-2xl font-bold text-white mb-6">Customer Information</h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-gray-400 text-sm font-medium">Name</label>
                    <p className="text-white text-lg font-semibold">{customer.name}</p>
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm font-medium">Email</label>
                    <p className="text-white text-lg">{customer.email}</p>
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm font-medium">Phone</label>
                    <p className="text-white text-lg">{customer.phone}</p>
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm font-medium">GSTIN</label>
                    <p className="text-white text-lg">{customer.gstin || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm font-medium">Status</label>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      customer.is_active
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {customer.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm font-medium">Member Since</label>
                    <p className="text-white text-lg">{formatDate(customer.created_at)}</p>
                  </div>
                </div>
              </div>

              {/* Address Information Card */}
              <div className="backdrop-blur-xl bg-white/10 rounded-3xl shadow-2xl border border-white/20 p-6">
                <h2 className="text-2xl font-bold text-white mb-6">Address Information</h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-gray-400 text-sm font-medium">Billing Address</label>
                    <p className="text-white text-lg">{customer.billing_address}</p>
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm font-medium">Shipping Address</label>
                    <p className="text-white text-lg">{customer.shipping_address || customer.billing_address}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-gray-400 text-sm font-medium">State</label>
                      <p className="text-white text-lg">{customer.state}</p>
                    </div>
                    <div>
                      <label className="text-gray-400 text-sm font-medium">Pincode</label>
                      <p className="text-white text-lg">{customer.pincode}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Invoices Tab */}
          {activeTab === 'invoices' && (
            <div className="backdrop-blur-xl bg-white/10 rounded-3xl shadow-2xl border border-white/20 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Recent Invoices</h2>
                <button
                  onClick={() => navigate(`/invoices/new?customer_id=${customer.id}`)}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-medium transition-all duration-300"
                >
                  Create Invoice
                </button>
              </div>
              {invoices.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/20">
                        <th className="text-left py-3 px-4 text-gray-300 font-medium">Invoice Number</th>
                        <th className="text-left py-3 px-4 text-gray-300 font-medium">Date</th>
                        <th className="text-left py-3 px-4 text-gray-300 font-medium">Amount</th>
                        <th className="text-left py-3 px-4 text-gray-300 font-medium">Status</th>
                        <th className="text-left py-3 px-4 text-gray-300 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((invoice) => (
                        <tr key={invoice.id} className="border-b border-white/10 hover:bg-white/5">
                          <td className="py-3 px-4 text-white">{invoice.invoice_number}</td>
                          <td className="py-3 px-4 text-gray-300">{formatDate(invoice.invoice_date)}</td>
                          <td className="py-3 px-4 text-green-400 font-semibold">{formatCurrency(invoice.total_amount)}</td>
                          <td className="py-3 px-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              invoice.status === 'paid'
                                ? 'bg-green-500/20 text-green-400'
                                : invoice.status === 'pending'
                                ? 'bg-yellow-500/20 text-yellow-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}>
                              {invoice.status}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => navigate(`/invoices/${invoice.id}`)}
                              className="text-blue-400 hover:text-blue-300 font-medium"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-300">No invoices found for this customer</p>
                  <button
                    onClick={() => navigate(`/invoices/new?customer_id=${customer.id}`)}
                    className="mt-4 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-medium transition-all duration-300"
                  >
                    Create First Invoice
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Orders Tab */}
          {activeTab === 'orders' && (
            <div className="backdrop-blur-xl bg-white/10 rounded-3xl shadow-2xl border border-white/20 p-6">
              <h2 className="text-2xl font-bold text-white mb-6">Recent Orders</h2>
              {orders.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/20">
                        <th className="text-left py-3 px-4 text-gray-300 font-medium">Order Number</th>
                        <th className="text-left py-3 px-4 text-gray-300 font-medium">Date</th>
                        <th className="text-left py-3 px-4 text-gray-300 font-medium">Amount</th>
                        <th className="text-left py-3 px-4 text-gray-300 font-medium">Status</th>
                        <th className="text-left py-3 px-4 text-gray-300 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order) => (
                        <tr key={order.id} className="border-b border-white/10 hover:bg-white/5">
                          <td className="py-3 px-4 text-white">{order.order_number}</td>
                          <td className="py-3 px-4 text-gray-300">{formatDate(order.order_date)}</td>
                          <td className="py-3 px-4 text-green-400 font-semibold">{formatCurrency(order.total_amount)}</td>
                          <td className="py-3 px-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              order.status === 'completed'
                                ? 'bg-green-500/20 text-green-400'
                                : order.status === 'pending'
                                ? 'bg-yellow-500/20 text-yellow-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}>
                              {order.status}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => navigate(`/orders/${order.id}`)}
                              className="text-blue-400 hover:text-blue-300 font-medium"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-300">No orders found for this customer</p>
                </div>
              )}
            </div>
          )}

          {/* Pricing Tab */}
          {activeTab === 'pricing' && (
            <div className="backdrop-blur-xl bg-white/10 rounded-3xl shadow-2xl border border-white/20 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Customer-Specific Pricing</h2>
                <button
                  onClick={() => navigate(`/products?customer_id=${customer.id}`)}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl font-medium transition-all duration-300"
                >
                  Manage Prices
                </button>
              </div>
              {customerPrices.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/20">
                        <th className="text-left py-3 px-4 text-gray-300 font-medium">Product Name</th>
                        <th className="text-left py-3 px-4 text-gray-300 font-medium">Default Price</th>
                        <th className="text-left py-3 px-4 text-gray-300 font-medium">Customer Price</th>
                        <th className="text-left py-3 px-4 text-gray-300 font-medium">Difference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerPrices.map((price) => (
                        <tr key={price.id} className="border-b border-white/10 hover:bg-white/5">
                          <td className="py-3 px-4 text-white">{price.product_name}</td>
                          <td className="py-3 px-4 text-gray-300">{formatCurrency(price.default_price)}</td>
                          <td className="py-3 px-4 text-green-400 font-semibold">{formatCurrency(price.price)}</td>
                          <td className="py-3 px-4">
                            <span className={`font-semibold ${
                              price.price < price.default_price
                                ? 'text-green-400'
                                : price.price > price.default_price
                                ? 'text-red-400'
                                : 'text-gray-400'
                            }`}>
                              {price.price < price.default_price ? '-' : '+'}
                              {formatCurrency(Math.abs(price.price - price.default_price))}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-300 mb-4">No custom prices set for this customer</p>
                  <p className="text-gray-400 text-sm mb-6">All products will use their default prices</p>
                  <button
                    onClick={() => navigate(`/products?customer_id=${customer.id}`)}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-medium transition-all duration-300"
                  >
                    Set Custom Prices
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerDetail;
