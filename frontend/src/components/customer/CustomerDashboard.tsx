import React, { useState, useEffect } from 'react';
import API_BASE_URL from '../../config/api';

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  default_price?: number;
  stock_quantity: number;
  image_url?: string;
  has_custom_price?: boolean;
  sku?: string;
  category?: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface CustomerOrder {
  id: number;
  order_number: string;
  order_date: string;
  status: string;
  total_amount: number;
  notes: string;
  items: any[];
  created_at: string;
}

interface CustomerInvoice {
  id: number;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  status: string;
  total_amount: number;
  notes: string;
  items: any[];
  created_at: string;
}

interface CustomerDashboardProps {
  onLogout: () => void;
}

const CustomerDashboard: React.FC<CustomerDashboardProps> = ({ onLogout }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showOrders, setShowOrders] = useState(false);
  const [showInvoices, setShowInvoices] = useState(false);
  const [orderNotes, setOrderNotes] = useState('');
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [stockUpdateAnimation, setStockUpdateAnimation] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadProducts();
    // Auto-refresh products every 5 seconds to get latest stock
    const interval = setInterval(() => {
      loadProducts();
    }, 5000);
    return () => clearInterval(interval);
  }, [searchTerm]);

  // Sync cart with latest product stock
  useEffect(() => {
    setCart(prevCart => {
      return prevCart.map(item => {
        const updatedProduct = products.find(p => p.id === item.product.id);
        if (updatedProduct) {
          // Update product data in cart
          const newQuantity = Math.min(item.quantity, updatedProduct.stock_quantity);
          if (newQuantity !== item.quantity) {
            // Trigger animation
            setStockUpdateAnimation(prev => new Set(prev).add(updatedProduct.id));
            setTimeout(() => {
              setStockUpdateAnimation(prev => {
                const newSet = new Set(prev);
                newSet.delete(updatedProduct.id);
                return newSet;
              });
            }, 1000);
          }
          return {
            ...item,
            product: updatedProduct,
            quantity: newQuantity
          };
        }
        return item;
      }).filter(item => item.quantity > 0); // Remove items with 0 quantity
    });
  }, [products]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      // Build URL with search parameter if provided
      let url = `${API_BASE_URL}/customer-auth/products`;
      if (searchTerm) {
        url += `?search=${encodeURIComponent(searchTerm)}`;
      }
      
      console.log('[DEBUG] Fetching products from:', url);
      const response = await fetch(url, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('[DEBUG] Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('[DEBUG] Products data:', data);
        console.log('[DEBUG] Products count:', data.products ? data.products.length : 0);
        if (data.success) {
          setProducts(data.products || []);
          console.log('[DEBUG] Products set in state:', data.products || []);
        } else {
          console.error('[ERROR] API returned success=false:', data.error || data.message);
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        console.error('[ERROR] Failed to load products:', response.status, response.statusText, errorData);
      }
    } catch (error: any) {
      console.error('[ERROR] Exception loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async () => {
    try {
      setOrdersLoading(true);
      const response = await fetch(`${API_BASE_URL}/customers/orders`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders || []);
      } else {
        console.error('Failed to load orders:', response.status, response.statusText);
        setOrders([]);
      }
    } catch (error: any) {
      console.error('Failed to load orders:', error);
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  };

  const loadInvoices = async () => {
    try {
      setInvoicesLoading(true);
      const response = await fetch(`${API_BASE_URL}/customers/invoices`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setInvoices(data.invoices || []);
      } else {
        console.error('Failed to load invoices:', response.status, response.statusText);
        setInvoices([]);
      }
    } catch (error: any) {
      console.error('Failed to load invoices:', error);
      setInvoices([]);
    } finally {
      setInvoicesLoading(false);
    }
  };

  const handleLogout = () => {
    // Call the parent's logout function
    onLogout();
  };

  const getCartQuantity = (productId: number): number => {
    const cartItem = cart.find(item => item.product.id === productId);
    return cartItem ? cartItem.quantity : 0;
  };

  const addToCart = (product: Product) => {
    const currentQuantity = getCartQuantity(product.id);
    if (currentQuantity >= product.stock_quantity) {
      alert(`Only ${product.stock_quantity} items available in stock`);
      return;
    }
    
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.product.id === product.id);
      if (existingItem) {
        return prevCart.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: Math.min(item.quantity + 1, product.stock_quantity) }
            : item
        );
      } else {
        return [...prevCart, { product, quantity: 1 }];
      }
    });
    
    // Trigger animation
    setStockUpdateAnimation(prev => new Set(prev).add(product.id));
    setTimeout(() => {
      setStockUpdateAnimation(prev => {
        const newSet = new Set(prev);
        newSet.delete(product.id);
        return newSet;
      });
    }, 500);
  };

  const removeFromCart = (productId: number) => {
    setCart(prevCart => prevCart.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: number, delta: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const currentQuantity = getCartQuantity(productId);
    const newQuantity = currentQuantity + delta;
    
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }
    
    if (newQuantity > product.stock_quantity) {
      alert(`Only ${product.stock_quantity} items available in stock`);
      return;
    }
    
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.product.id === productId);
      if (existingItem) {
        return prevCart.map(item =>
          item.product.id === productId
            ? { ...item, quantity: newQuantity, product }
            : item
        );
      } else {
        return [...prevCart, { product, quantity: newQuantity }];
      }
    });
    
    // Trigger animation
    setStockUpdateAnimation(prev => new Set(prev).add(productId));
    setTimeout(() => {
      setStockUpdateAnimation(prev => {
        const newSet = new Set(prev);
        newSet.delete(productId);
        return newSet;
      });
    }, 500);
  };

  const getTotalAmount = () => {
    return cart.reduce((total, item) => total + (item.product.price * item.quantity), 0);
  };

  const handleSubmitOrder = async () => {
    try {
      // Validate cart is not empty
      if (cart.length === 0) {
        alert('Your cart is empty. Please add products to cart before placing an order.');
        return;
      }

      // Validate all items have valid quantities
      for (const item of cart) {
        if (item.quantity <= 0) {
          alert(`Invalid quantity for ${item.product.name}. Please update your cart.`);
          return;
        }
        if (item.quantity > item.product.stock_quantity) {
          alert(`Insufficient stock for ${item.product.name}. Available: ${item.product.stock_quantity}, In cart: ${item.quantity}`);
          return;
        }
      }

      const orderData = {
        items: cart.map(item => ({
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: item.product.price
        })),
        notes: orderNotes,
        total_amount: getTotalAmount()
      };

      console.log('[ORDER SUBMIT] Submitting order:', orderData);

      const response = await fetch(`${API_BASE_URL}/customers/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(orderData)
      });

      const responseText = await response.text();
      console.log('[ORDER SUBMIT] Response status:', response.status);
      console.log('[ORDER SUBMIT] Response text:', responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('[ORDER SUBMIT] Failed to parse response:', parseError);
        alert(`Server error: ${response.status}\n\nResponse: ${responseText.substring(0, 200)}`);
        return;
      }

      if (response.ok) {
        if (data.success) {
          alert('Order submitted successfully!');
          setCart([]);
          setOrderNotes('');
          setShowOrderModal(false);
          setShowCart(false);
          loadOrders(); // Reload orders to show the new one
          loadProducts(); // Reload products to update stock
        } else {
          alert(data.error || 'Failed to submit order');
        }
      } else {
        const errorMessage = data.error || data.message || `HTTP ${response.status}: ${response.statusText}`;
        alert(`Failed to submit order: ${errorMessage}`);
        console.error('[ORDER SUBMIT] Error response:', data);
      }
    } catch (error: any) {
      console.error('Failed to submit order:', error);
      alert(`Failed to submit order: ${error.message || 'Network error. Please check your connection and try again.'}`);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Products are now filtered on the server side
  const filteredProducts = products;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-20 w-20 border-b-2 border-blue-600 mx-auto mb-6"></div>
          <p className="text-gray-600 text-xl">Loading products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="h-12 w-12 bg-green-600 rounded-lg flex items-center justify-center">
                <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Product Catalog</h1>
                <p className="text-gray-600 text-sm">Browse and order products</p>
              </div>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowOrders(true);
                  loadOrders();
                }}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>My Orders ({orders.length})</span>
              </button>
              <button
                onClick={() => {
                  setShowInvoices(true);
                  loadInvoices();
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>My Invoices ({invoices.length})</span>
              </button>
              <button
                onClick={() => setShowCart(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5m6-5v6a2 2 0 01-2 2H9a2 2 0 01-2-2v-6m6 0V9a2 2 0 00-2-2H9a2 2 0 00-2 2v4.01" />
                </svg>
                <span>Cart ({cart.length})</span>
              </button>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <svg className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="text-right">
              <p className="text-gray-600 text-sm">{filteredProducts.length} products found</p>
            </div>
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <div key={product.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              <div className="aspect-w-16 aspect-h-9 bg-gray-100">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-48 object-cover"
                  />
                ) : (
                  <div className="w-full h-48 bg-gray-100 flex items-center justify-center">
                    <svg className="h-16 w-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{product.name}</h3>
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">{product.description}</p>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex flex-col">
                    <span className="text-xl font-bold text-gray-900">{formatCurrency(product.price)}</span>
                    {product.has_custom_price && product.default_price !== product.price && (
                      <span className="text-xs text-gray-500 line-through">
                        {formatCurrency(product.default_price)}
                      </span>
                    )}
                  </div>
                </div>
                {product.has_custom_price && (
                  <div className="mb-2">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Special Price
                    </span>
                  </div>
                )}
                
                {/* Stock and Cart Controls */}
                <div className={`mt-3 transition-all duration-300 ${stockUpdateAnimation.has(product.id) ? 'animate-pulse bg-yellow-50 p-2 rounded-lg' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-medium ${
                      product.stock_quantity === 0 
                        ? 'text-red-600' 
                        : product.stock_quantity <= 5 
                        ? 'text-orange-600' 
                        : 'text-green-600'
                    }`}>
                      {product.stock_quantity === 0 
                        ? 'Out of Stock' 
                        : `${product.stock_quantity} in stock`}
                    </span>
                    {getCartQuantity(product.id) > 0 && (
                      <span className="text-xs text-blue-600 font-medium">
                        {getCartQuantity(product.id)} in cart
                      </span>
                    )}
                  </div>
                  
                  {product.stock_quantity > 0 ? (
                    <div className="flex items-center justify-center space-x-3">
                      {getCartQuantity(product.id) === 0 ? (
                        <button
                          onClick={() => addToCart(product)}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 transform hover:scale-105 shadow-md"
                        >
                          Add
                        </button>
                      ) : (
                        <div className="flex items-center space-x-3 bg-white border-2 border-green-500 rounded-lg px-2 py-1">
                          <button
                            onClick={() => updateQuantity(product.id, -1)}
                            className="w-8 h-8 bg-green-600 hover:bg-green-700 text-white rounded-full flex items-center justify-center font-bold text-lg transition-all duration-200 transform hover:scale-110 shadow-md"
                          >
                            -
                          </button>
                          <span className="text-gray-900 font-bold text-lg min-w-[2rem] text-center">
                            {getCartQuantity(product.id)}
                          </span>
                          <button
                            onClick={() => updateQuantity(product.id, 1)}
                            disabled={getCartQuantity(product.id) >= product.stock_quantity}
                            className="w-8 h-8 bg-green-600 hover:bg-green-700 text-white rounded-full flex items-center justify-center font-bold text-lg transition-all duration-200 transform hover:scale-110 shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-full bg-gray-200 text-gray-500 py-2 px-4 rounded-lg text-sm font-medium text-center">
                      Out of Stock
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <div className="h-24 w-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No products found</h3>
            <p className="text-gray-600">Try adjusting your search criteria</p>
          </div>
        )}
      </div>

      {/* Cart Modal */}
      {showCart && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Shopping Cart</h2>
              <button
                onClick={() => setShowCart(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {cart.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600 mb-4">Your cart is empty</p>
                <button
                  onClick={() => setShowCart(false)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Continue Shopping
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-4 mb-6">
                  {cart.map((item) => (
                    <div key={item.product.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                          {item.product.image_url ? (
                            <img
                              src={item.product.image_url}
                              alt={item.product.name}
                              className="w-full h-full object-cover rounded-lg"
                            />
                          ) : (
                            <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <h3 className="text-gray-900 font-medium">{item.product.name}</h3>
                          <p className="text-gray-600 text-sm">{formatCurrency(item.product.price)}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => updateQuantity(item.product.id, -1)}
                          className="w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center font-bold transition-all duration-200 transform hover:scale-110"
                        >
                          -
                        </button>
                        <span className="text-gray-900 font-bold text-lg w-10 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product.id, 1)}
                          disabled={item.quantity >= item.product.stock_quantity}
                          className="w-8 h-8 bg-green-600 hover:bg-green-700 text-white rounded-full flex items-center justify-center font-bold transition-all duration-200 transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                        >
                          +
                        </button>
                        {item.quantity >= item.product.stock_quantity && (
                          <span className="text-xs text-red-600 ml-1">Max</span>
                        )}
                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="text-red-600 hover:text-red-700 ml-2"
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-200 pt-4 mb-6">
                  <div className="flex justify-between items-center text-xl font-bold text-gray-900">
                    <span>Total:</span>
                    <span>{formatCurrency(getTotalAmount())}</span>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowCart(false)}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2.5 rounded-lg text-sm font-medium transition-colors"
                  >
                    Continue Shopping
                  </button>
                  <button
                    onClick={() => {
                      setShowCart(false);
                      setShowOrderModal(true);
                    }}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
                  >
                    Place Order
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Order Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Confirm Order</h2>
              <button
                onClick={() => setShowOrderModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-gray-900 font-medium mb-2">Order Summary:</h3>
                <div className="space-y-2">
                  {cart.map((item) => (
                    <div key={item.product.id} className="flex justify-between text-gray-700">
                      <span>{item.product.name} x {item.quantity}</span>
                      <span>{formatCurrency(item.product.price * item.quantity)}</span>
                    </div>
                  ))}
                  <div className="border-t border-gray-200 pt-2">
                    <div className="flex justify-between text-gray-900 font-bold">
                      <span>Total:</span>
                      <span>{formatCurrency(getTotalAmount())}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-gray-700 text-sm font-medium mb-2">Order Notes (Optional)</label>
                <textarea
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Any special instructions or notes..."
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => setShowOrderModal(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitOrder}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                  Confirm Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Orders Modal */}
      {showOrders && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Your Orders</h2>
              <button
                onClick={() => setShowOrders(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {ordersLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading orders...</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600 mb-4">You have no orders yet.</p>
                <button
                  onClick={() => setShowOrders(false)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Back to Products
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <div key={order.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Order #{order.order_number}</h3>
                      <span className="text-gray-600 text-sm">Date: {formatDate(order.order_date)}</span>
                    </div>
                    <p className="text-gray-600 text-sm mb-4">Status: <span className={`font-medium ${order.status === 'Completed' ? 'text-green-600' : order.status === 'Pending' ? 'text-yellow-600' : 'text-red-600'}`}>{order.status}</span></p>
                    <div className="flex justify-between items-center text-lg font-bold text-gray-900 mb-4">
                      <span>Total:</span>
                      <span>{formatCurrency(order.total_amount)}</span>
                    </div>
                    <p className="text-gray-600 text-sm mb-4">Notes: {order.notes || 'No notes'}</p>
                    <div className="text-gray-700 text-sm font-medium mb-2">Items:</div>
                    <ul className="space-y-1">
                      {order.items.map((item: any) => (
                        <li key={item.id} className="text-gray-600 text-sm">
                          {item.product_name} x {item.quantity} ({formatCurrency(item.unit_price)})
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Invoices Modal */}
      {showInvoices && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Your Invoices</h2>
              <button
                onClick={() => setShowInvoices(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {invoicesLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading invoices...</p>
              </div>
            ) : invoices.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600 mb-4">You have no invoices yet.</p>
                <button
                  onClick={() => setShowInvoices(false)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Back to Products
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {invoices.map((invoice) => (
                  <div key={invoice.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Invoice #{invoice.invoice_number}</h3>
                      <span className="text-gray-600 text-sm">Date: {formatDate(invoice.invoice_date)}</span>
                    </div>
                    <p className="text-gray-600 text-sm mb-4">Status: <span className={`font-medium ${invoice.status === 'paid' ? 'text-green-600' : invoice.status === 'pending' ? 'text-yellow-600' : 'text-red-600'}`}>{invoice.status}</span></p>
                    <div className="flex justify-between items-center text-lg font-bold text-gray-900 mb-4">
                      <span>Total:</span>
                      <span>{formatCurrency(invoice.total_amount)}</span>
                    </div>
                    <p className="text-gray-600 text-sm mb-4">Due Date: {formatDate(invoice.due_date)}</p>
                    <p className="text-gray-600 text-sm mb-4">Notes: {invoice.notes || 'No notes'}</p>
                    <div className="text-gray-700 text-sm font-medium mb-2">Items:</div>
                    <ul className="space-y-1">
                      {invoice.items.map((item: any) => (
                        <li key={item.id} className="text-gray-600 text-sm">
                          {item.product_name} x {item.quantity} ({formatCurrency(item.unit_price)})
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    );
  };

export default CustomerDashboard;
