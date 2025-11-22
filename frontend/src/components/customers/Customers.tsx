import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API_BASE_URL from '../../config/api';

interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  billing_address: string;
  state: string;
  pincode: string;
  created_at: string;
  is_active: boolean;
}

const Customers: React.FC = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    phone_country_code: '+91',
    billing_address: '',
    shipping_address: '',
    state: '',
    pincode: '',
    password: '',
    gstin: '',
    company_name: '',
    bank_name: '',
    bank_account_number: '',
    bank_ifsc: '',
    opening_balance_type: 'debit',
    opening_balance: '',
    notes: '',
    tags: '',
    discount: '',
    cc_emails: '',
    credit_limit: ''
  });
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [showBillingAddress, setShowBillingAddress] = useState(false);
  const [showShippingAddress, setShowShippingAddress] = useState(false);
  const [showBankDetails, setShowBankDetails] = useState(false);
  const [fetchingGstin, setFetchingGstin] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/admin/customers`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Only show customers from database (filter out any invalid data)
          const validCustomers = (data.customers || []).filter((c: Customer) => 
            c && c.id && c.name && c.email
          );
          setCustomers(validCustomers);
          console.log(`Loaded ${validCustomers.length} customers from database`);
        } else {
          console.error('Failed to load customers:', data.error || 'Unknown error');
          alert(`Failed to load customers: ${data.error || 'Unknown error'}`);
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        console.error('Failed to load customers:', response.status, errorData);
        alert(`Failed to load customers: ${errorData.error || response.statusText} (Status: ${response.status})`);
      }
    } catch (error: any) {
      console.error('Failed to load customers:', error);
      alert(`Failed to load customers: ${error.message || 'Network error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // Validate required fields
    if (!formData.name || !formData.email) {
      alert('Name and Email are required fields');
      return;
    }
    
    try {
      // Prepare data for submission
      const phoneValue = formData.phone ? (formData.phone_country_code + formData.phone) : '';
      
      const submitData: any = {
        name: formData.name,
        email: formData.email,
        phone: phoneValue,
        billing_address: formData.billing_address || '',
        shipping_address: formData.shipping_address || '',
        state: formData.state || '',
        pincode: formData.pincode || '',
        password: formData.password || 'default123',
        gstin: formData.gstin || '',
        company_name: formData.company_name || ''
      };
      
      // Add optional fields if provided
      if (formData.bank_name) submitData.bank_name = formData.bank_name;
      if (formData.bank_account_number) submitData.bank_account_number = formData.bank_account_number;
      if (formData.bank_ifsc) submitData.bank_ifsc = formData.bank_ifsc;
      if (formData.opening_balance) submitData.opening_balance = parseFloat(formData.opening_balance);
      if (formData.opening_balance_type) submitData.opening_balance_type = formData.opening_balance_type;
      if (formData.notes) submitData.notes = formData.notes;
      if (formData.tags) submitData.tags = formData.tags;
      if (formData.discount) submitData.discount = parseFloat(formData.discount);
      if (formData.credit_limit) submitData.credit_limit = parseFloat(formData.credit_limit);
      if (formData.cc_emails) submitData.cc_emails = formData.cc_emails;
      
      console.log('Submitting customer data:', submitData);
      
      const response = await fetch(`${API_BASE_URL}/admin/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(submitData)
      });

      const responseText = await response.text();
      console.log('Response status:', response.status);
      console.log('Response text:', responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse response:', parseError);
        alert(`Server error: ${response.status}\n\nResponse: ${responseText.substring(0, 300)}`);
        return;
      }

      if (response.ok) {
        if (data.success) {
          alert('Customer created successfully!');
          setShowAddModal(false);
          setFormData({
            name: '',
            email: '',
            phone: '',
            phone_country_code: '+91',
            billing_address: '',
            shipping_address: '',
            state: '',
            pincode: '',
            password: '',
            gstin: '',
            company_name: '',
            bank_name: '',
            bank_account_number: '',
            bank_ifsc: '',
            opening_balance_type: 'debit',
            opening_balance: '',
            notes: '',
            tags: '',
            discount: '',
            cc_emails: '',
            credit_limit: ''
          });
          setShowMoreDetails(false);
          setShowBillingAddress(false);
          setShowShippingAddress(false);
          setShowBankDetails(false);
          await loadCustomers();
        } else {
          alert(`Failed to create customer: ${data.error || 'Unknown error'}`);
        }
      } else {
        const errorMsg = data.error || data.message || responseText || 'Unknown error';
        alert(`Failed to create customer (${response.status}): ${errorMsg}`);
        console.error('Error details:', data);
      }
    } catch (error: any) {
      console.error('Failed to create customer:', error);
      alert(`Failed to create customer: ${error.message || 'Network error'}`);
    }
  };

  const handleDeleteCustomer = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this customer? This action cannot be undone.')) {
      try {
        const response = await fetch(`${API_BASE_URL}/admin/customers/${id}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
          alert('Customer deleted successfully!');
          await loadCustomers();
        } else {
          alert(data.message || data.error || 'Failed to delete customer');
        }
      } catch (error: any) {
        console.error('Failed to delete customer:', error);
        alert('Failed to delete customer: ' + (error.message || 'Network error'));
      }
    }
  };

  const handleToggleCustomerStatus = async (customer: Customer) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/customers/${customer.id}/toggle-status`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Update the customer in the list
          setCustomers(customers.map(c => 
            c.id === customer.id ? { ...c, is_active: data.is_active } : c
          ));
          alert(data.message || `Customer ${data.is_active ? 'activated' : 'deactivated'} successfully`);
        } else {
          alert(data.error || 'Failed to toggle customer status');
        }
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to toggle customer status');
      }
    } catch (error: any) {
      console.error('Failed to toggle customer status:', error);
      alert(`Failed to toggle customer status: ${error.message}`);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = 
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone.includes(searchTerm);
    
    return matchesSearch;
  });

  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading customers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Customers</h1>
                <p className="text-sm text-gray-500">Manage your customer database</p>
              </div>
            </div>
            
            <div className="flex space-x-3 flex-wrap gap-2">
              <button
                onClick={() => navigate('/dashboard')}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-xl font-medium transition-all duration-300 flex items-center space-x-2"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Back to Dashboard</span>
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 py-2 rounded-xl font-medium transition-all duration-300 flex items-center space-x-2 hover:from-green-700 hover:to-emerald-700"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Add Customer</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Summary */}
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
                  placeholder="Search customers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="text-right">
              <p className="text-gray-600 text-sm">{filteredCustomers.length} customers found</p>
            </div>
          </div>
        </div>

        {/* Customers List */}
        <div className="space-y-4">
          {paginatedCustomers.map((customer) => (
            <div key={customer.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{customer.name}</h3>
                    <p className="text-gray-600">{customer.email}</p>
                    <p className="text-gray-500 text-sm">Phone: {customer.phone}</p>
                    <p className="text-gray-500 text-sm">Added: {formatDate(customer.created_at)}</p>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="mb-2">
                    <button
                      onClick={() => handleToggleCustomerStatus(customer)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        customer.is_active 
                          ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                          : 'bg-red-100 text-red-800 hover:bg-red-200'
                      }`}
                      title={`Click to ${customer.is_active ? 'deactivate' : 'activate'} customer`}
                    >
                      {customer.is_active ? '✓ Active' : '✗ Inactive'}
                    </button>
                  </div>
                  <p className="text-gray-600 text-sm">{customer.state} - {customer.pincode}</p>
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => navigate(`/customers/${customer.id}`)}
                    className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors"
                  >
                    View
                  </button>
                  <button
                    onClick={() => navigate(`/customers/${customer.id}/edit`)}
                    className="bg-amber-600 hover:bg-amber-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteCustomer(customer.id)}
                    className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex justify-center">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex space-x-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === page
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {filteredCustomers.length === 0 && (
          <div className="text-center py-12">
            <div className="h-20 w-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="h-10 w-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No customers found</h3>
            <p className="text-gray-600 mb-6">Try adjusting your search or add your first customer</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Add Your First Customer
            </button>
          </div>
        )}
      </div>

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Add Customer</h2>
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
                >
                  <span>Save</span>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Details Section */}
              <div className="border-b border-gray-200 pb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Basic Details</h3>
                  <button
                    type="button"
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Add Custom fields
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2">
                      <span className="text-red-500">*</span> Name
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter customer name"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2">Phone</label>
                    <div className="flex space-x-2">
                      <select
                        value={formData.phone_country_code}
                        onChange={(e) => setFormData({...formData, phone_country_code: e.target.value})}
                        className="px-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="+91">+91</option>
                        <option value="+1">+1</option>
                        <option value="+44">+44</option>
                      </select>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Phone number"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="name@example.com"
                    />
                  </div>
                </div>
              </div>

              {/* Company Details Section */}
              <div className="border-b border-gray-200 pb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Company Details (Optional)</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2">GSTIN</label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={formData.gstin}
                        onChange={(e) => setFormData({...formData, gstin: e.target.value})}
                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="29AABCT1332L000"
                        maxLength={15}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (formData.gstin) {
                            setFetchingGstin(true);
                            // Simulate GSTIN fetch - replace with actual API call
                            setTimeout(() => {
                              setFetchingGstin(false);
                              alert('GSTIN details fetched (implement API call)');
                            }, 1000);
                          }
                        }}
                        disabled={!formData.gstin || fetchingGstin}
                        className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {fetchingGstin ? 'Fetching...' : 'Fetch Details'}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2">Company Name</label>
                    <input
                      type="text"
                      value={formData.company_name}
                      onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Company Name"
                    />
                  </div>
                </div>
              </div>

              {/* More Details Collapsible Section */}
              <div className="border-b border-gray-200 pb-6">
                <button
                  type="button"
                  onClick={() => setShowMoreDetails(!showMoreDetails)}
                  className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 transition-colors"
                >
                  <svg className={`h-5 w-5 transition-transform ${showMoreDetails ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="font-medium">More Details?</span>
                </button>
                <p className="text-sm text-gray-500 ml-7 mt-1">Add Notes, Tags, Discount, CC Emails, Pricelist, Credit Limit</p>
                {showMoreDetails && (
                  <div className="mt-4 space-y-4 ml-7">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-gray-700 text-sm font-medium mb-2">Notes</label>
                        <textarea
                          value={formData.notes}
                          onChange={(e) => setFormData({...formData, notes: e.target.value})}
                          rows={3}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                          placeholder="Add notes"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-700 text-sm font-medium mb-2">Tags</label>
                        <input
                          type="text"
                          value={formData.tags}
                          onChange={(e) => setFormData({...formData, tags: e.target.value})}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Comma separated tags"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-700 text-sm font-medium mb-2">Discount (%)</label>
                        <input
                          type="number"
                          value={formData.discount}
                          onChange={(e) => setFormData({...formData, discount: e.target.value})}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-700 text-sm font-medium mb-2">Credit Limit (₹)</label>
                        <input
                          type="number"
                          value={formData.credit_limit}
                          onChange={(e) => setFormData({...formData, credit_limit: e.target.value})}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="0"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-gray-700 text-sm font-medium mb-2">CC Emails</label>
                        <input
                          type="text"
                          value={formData.cc_emails}
                          onChange={(e) => setFormData({...formData, cc_emails: e.target.value})}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="email1@example.com, email2@example.com"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Address and Bank Details */}
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => setShowBillingAddress(!showBillingAddress)}
                  className="flex items-center space-x-2 text-red-600 hover:text-red-700 font-medium"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Billing Address</span>
                </button>
                {showBillingAddress && (
                  <div className="ml-7 space-y-4">
                    <div>
                      <label className="block text-gray-700 text-sm font-medium mb-2">Billing Address</label>
                      <textarea
                        value={formData.billing_address}
                        onChange={(e) => setFormData({...formData, billing_address: e.target.value})}
                        rows={3}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        placeholder="Enter billing address"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-gray-700 text-sm font-medium mb-2">State</label>
                        <input
                          type="text"
                          value={formData.state}
                          onChange={(e) => setFormData({...formData, state: e.target.value})}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="State"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-700 text-sm font-medium mb-2">Pincode</label>
                        <input
                          type="text"
                          value={formData.pincode}
                          onChange={(e) => setFormData({...formData, pincode: e.target.value})}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Pincode"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowShippingAddress(!showShippingAddress)}
                  className="flex items-center space-x-2 text-red-600 hover:text-red-700 font-medium"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Shipping Address</span>
                </button>
                {showShippingAddress && (
                  <div className="ml-7">
                    <label className="block text-gray-700 text-sm font-medium mb-2">Shipping Address</label>
                    <textarea
                      value={formData.shipping_address}
                      onChange={(e) => setFormData({...formData, shipping_address: e.target.value})}
                      rows={3}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      placeholder="Enter shipping address"
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowBankDetails(!showBankDetails)}
                  className="flex items-center space-x-2 text-red-600 hover:text-red-700 font-medium"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Bank Details</span>
                </button>
                {showBankDetails && (
                  <div className="ml-7 space-y-4">
                    <div>
                      <label className="block text-gray-700 text-sm font-medium mb-2">Bank Name</label>
                      <input
                        type="text"
                        value={formData.bank_name}
                        onChange={(e) => setFormData({...formData, bank_name: e.target.value})}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Bank Name"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-gray-700 text-sm font-medium mb-2">Account Number</label>
                        <input
                          type="text"
                          value={formData.bank_account_number}
                          onChange={(e) => setFormData({...formData, bank_account_number: e.target.value})}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Account Number"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-700 text-sm font-medium mb-2">IFSC Code</label>
                        <input
                          type="text"
                          value={formData.bank_ifsc}
                          onChange={(e) => setFormData({...formData, bank_ifsc: e.target.value})}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="IFSC Code"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Optional Details - Opening Balance */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Optional Details</h3>
                <div>
                  <label className="block text-gray-700 text-sm font-medium mb-2">Opening Balance</label>
                  <div className="flex items-center space-x-4 mb-3">
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        value="debit"
                        checked={formData.opening_balance_type === 'debit'}
                        onChange={(e) => setFormData({...formData, opening_balance_type: e.target.value})}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Debit</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        value="credit"
                        checked={formData.opening_balance_type === 'credit'}
                        onChange={(e) => setFormData({...formData, opening_balance_type: e.target.value})}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Credit</span>
                    </label>
                  </div>
                  <input
                    type="number"
                    value={formData.opening_balance}
                    onChange={(e) => setFormData({...formData, opening_balance: e.target.value})}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={`Enter ${formData.opening_balance_type === 'debit' ? 'Debit' : 'Credit'} Amount`}
                  />
                  <p className="text-sm text-red-600 mt-1">Customer pays you ?</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2.5 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
                >
                  <span>Save</span>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Customers;

