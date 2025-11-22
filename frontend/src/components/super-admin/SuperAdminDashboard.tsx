import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface PendingAdmin {
  id: number;
  username: string;
  email: string;
  business_name: string;
  business_reason: string;
  created_at: string;
}

interface ApprovedAdmin {
  id: number;
  username: string;
  email: string;
  business_name: string;
  approved_at: string;
}

interface DashboardStats {
  pending_admins: number;
  approved_admins: number;
  total_customers: number;
  total_products: number;
}

const SuperAdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    pending_admins: 0,
    approved_admins: 0,
    total_customers: 0,
    total_products: 0
  });
  const [pendingAdmins, setPendingAdmins] = useState<PendingAdmin[]>([]);
  const [approvedAdmins, setApprovedAdmins] = useState<ApprovedAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'approved'>('pending');
  const [processingAction, setProcessingAction] = useState<number | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Get stored user data
      const userData = localStorage.getItem('userData');
      const userType = localStorage.getItem('userType');
      
      if (!userData || userType !== 'super_admin') {
        // Redirect to login if not authenticated
        navigate('/login');
        return;
      }
      
      const response = await fetch('https://web-production-84a3.up.railway.app/api/super-admin/dashboard', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          // Unauthorized - clear storage and redirect to login
          localStorage.removeItem('isAuthenticated');
          localStorage.removeItem('userType');
          localStorage.removeItem('userData');
          navigate('/login');
          return;
        }
        throw new Error('Failed to fetch dashboard data');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setStats(data.stats);
        setPendingAdmins(data.pending_admins);
        setApprovedAdmins(data.approved_admins);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Error fetching dashboard data');
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (adminId: number) => {
    setProcessingAction(adminId);
    try {
      const response = await fetch(`https://web-production-84a3.up.railway.app/api/super-admin/approve-admin/${adminId}`, {
        method: 'POST',
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (data.success) {
        await fetchDashboardData();
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Error approving admin');
    } finally {
      setProcessingAction(null);
    }
  };

  const handleReject = async (adminId: number) => {
    if (!window.confirm('Are you sure you want to reject this admin registration? This action cannot be undone.')) {
      return;
    }
    
    setProcessingAction(adminId);
    try {
      const response = await fetch(`https://web-production-84a3.up.railway.app/api/super-admin/reject-admin/${adminId}`, {
        method: 'POST',
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (data.success) {
        await fetchDashboardData();
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Error rejecting admin');
    } finally {
      setProcessingAction(null);
    }
  };

  const handleLogout = async () => {
    try {
      // Clear local storage
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('userType');
      localStorage.removeItem('userData');
      
      // Call logout endpoint
      await fetch('https://web-production-84a3.up.railway.app/api/super-admin/logout', {
        method: 'POST',
        credentials: 'include'
      });
      
      // Navigate to login
      navigate('/login');
    } catch (err) {
      console.error('Error logging out:', err);
      // Even if logout fails, clear local storage and navigate
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('userType');
      localStorage.removeItem('userData');
      navigate('/login');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-20 w-20 border-b-2 border-blue-500 mx-auto mb-6"></div>
          <p className="text-gray-300 text-xl">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="backdrop-blur-xl bg-white/10 border-b border-white/20 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-16 w-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-6">
                <h1 className="text-4xl font-bold text-white">Super Admin Dashboard</h1>
                <p className="text-gray-300 text-lg">Manage admin registrations and platform overview</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-2xl text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-300 transform hover:scale-105 shadow-lg"
            >
              <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Message */}
        {error && (
          <div className="mb-8 bg-red-500/20 border border-red-500/30 text-red-300 px-6 py-4 rounded-2xl backdrop-blur-sm">
            <div className="flex items-center">
              <svg className="h-6 w-6 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="backdrop-blur-xl bg-white/10 rounded-3xl shadow-2xl border border-white/20 p-6 hover:shadow-3xl transition-all duration-300 transform hover:-translate-y-2">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-16 w-16 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-gray-300">Pending Admins</p>
                <p className="text-3xl font-bold text-white">{stats.pending_admins}</p>
              </div>
            </div>
          </div>

          <div className="backdrop-blur-xl bg-white/10 rounded-3xl shadow-2xl border border-white/20 p-6 hover:shadow-3xl transition-all duration-300 transform hover:-translate-y-2">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-16 w-16 bg-gradient-to-r from-green-400 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-gray-300">Approved Admins</p>
                <p className="text-3xl font-bold text-white">{stats.approved_admins}</p>
              </div>
            </div>
          </div>

          <div className="backdrop-blur-xl bg-white/10 rounded-3xl shadow-2xl border border-white/20 p-6 hover:shadow-3xl transition-all duration-300 transform hover:-translate-y-2">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-16 w-16 bg-gradient-to-r from-blue-400 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-gray-300">Total Customers</p>
                <p className="text-3xl font-bold text-white">{stats.total_customers}</p>
              </div>
            </div>
          </div>

          <div className="backdrop-blur-xl bg-white/10 rounded-3xl shadow-2xl border border-white/20 p-6 hover:shadow-3xl transition-all duration-300 transform hover:-translate-y-2">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-16 w-16 bg-gradient-to-r from-purple-400 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-gray-300">Total Products</p>
                <p className="text-3xl font-bold text-white">{stats.total_products}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Admin Management */}
        <div className="backdrop-blur-xl bg-white/10 rounded-3xl shadow-2xl border border-white/20">
          <div className="px-8 py-8">
            {/* Tab Navigation */}
            <div className="sm:hidden mb-8">
              <select
                value={activeTab}
                onChange={(e) => setActiveTab(e.target.value as 'pending' | 'approved')}
                className="block w-full px-6 py-4 border border-white/20 rounded-2xl bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
              >
                <option value="pending">Pending Admins ({pendingAdmins.length})</option>
                <option value="approved">Approved Admins ({approvedAdmins.length})</option>
              </select>
            </div>
            
            <div className="hidden sm:block mb-8">
              <nav className="flex space-x-8" aria-label="Tabs">
                <button
                  onClick={() => setActiveTab('pending')}
                  className={`py-4 px-6 border-b-2 font-semibold text-lg rounded-t-2xl transition-all duration-300 ${
                    activeTab === 'pending'
                      ? 'border-blue-500 text-blue-400 bg-blue-500/10'
                      : 'border-transparent text-gray-400 hover:text-white hover:border-gray-300'
                  }`}
                >
                  Pending Admins
                  <span className="ml-3 bg-gray-600 text-white py-1 px-3 rounded-full text-sm font-medium">
                    {pendingAdmins.length}
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('approved')}
                  className={`py-4 px-6 border-b-2 font-semibold text-lg rounded-t-2xl transition-all duration-300 ${
                    activeTab === 'approved'
                      ? 'border-green-500 text-green-400 bg-green-500/10'
                      : 'border-transparent text-gray-400 hover:text-white hover:border-gray-300'
                  }`}
                >
                  Approved Admins
                  <span className="ml-3 bg-gray-600 text-white py-1 px-3 rounded-full text-sm font-medium">
                    {approvedAdmins.length}
                  </span>
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            <div className="mt-8">
              {activeTab === 'pending' ? (
                <div className="space-y-6">
                  {pendingAdmins.length === 0 ? (
                    <div className="text-center py-20">
                      <div className="mx-auto h-20 w-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
                        <svg className="h-10 w-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <h3 className="text-2xl font-bold text-white mb-3">No pending admins</h3>
                      <p className="text-gray-400 text-lg">All admin registrations have been processed.</p>
                    </div>
                  ) : (
                    pendingAdmins.map((admin) => (
                      <div key={admin.id} className="backdrop-blur-xl bg-white/5 rounded-3xl p-8 border border-white/10 hover:shadow-2xl transition-all duration-300">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-6">
                              <div className="flex-shrink-0">
                                <div className="h-16 w-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                                  <span className="text-2xl font-bold text-white">
                                    {admin.business_name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="text-2xl font-bold text-white mb-2">
                                  {admin.business_name}
                                </h3>
                                <p className="text-gray-300 text-lg mb-1">{admin.email}</p>
                                <p className="text-gray-400">
                                  Requested: {new Date(admin.created_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <div className="mt-6">
                              <h4 className="text-lg font-semibold text-white mb-3">Business Reason:</h4>
                              <div className="bg-white/10 p-6 rounded-2xl border border-white/20 backdrop-blur-sm">
                                <p className="text-gray-300 leading-relaxed text-lg">{admin.business_reason}</p>
                              </div>
                            </div>
                          </div>
                          <div className="ml-8 flex-shrink-0 flex space-x-4">
                            <button
                              onClick={() => handleApprove(admin.id)}
                              disabled={processingAction === admin.id}
                              className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-semibold rounded-2xl text-white bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 shadow-lg"
                            >
                              {processingAction === admin.id ? (
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              ) : (
                                <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                              {processingAction === admin.id ? 'Processing...' : 'Approve'}
                            </button>
                            <button
                              onClick={() => handleReject(admin.id)}
                              disabled={processingAction === admin.id}
                              className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-semibold rounded-2xl text-white bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 shadow-lg"
                            >
                              {processingAction === admin.id ? (
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              ) : (
                                <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              )}
                              {processingAction === admin.id ? 'Processing...' : 'Reject'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {approvedAdmins.length === 0 ? (
                    <div className="text-center py-20">
                      <div className="mx-auto h-20 w-20 bg-gray-500/20 rounded-full flex items-center justify-center mb-6">
                        <svg className="h-10 w-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <h3 className="text-2xl font-bold text-white mb-3">No approved admins</h3>
                      <p className="text-gray-400 text-lg">No admin registrations have been approved yet.</p>
                    </div>
                  ) : (
                    approvedAdmins.map((admin) => (
                      <div key={admin.id} className="backdrop-blur-xl bg-white/5 rounded-3xl p-8 border border-white/10 hover:shadow-2xl transition-all duration-300">
                        <div className="flex items-center space-x-6">
                          <div className="flex-shrink-0">
                            <div className="h-16 w-16 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                              <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-2xl font-bold text-white mb-2">
                              {admin.business_name}
                            </h3>
                            <p className="text-gray-300 text-lg mb-1">{admin.email}</p>
                            <p className="text-gray-400">
                              Approved: {new Date(admin.approved_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex-shrink-0">
                            <span className="inline-flex items-center px-4 py-2 rounded-2xl text-sm font-semibold bg-green-500/20 text-green-400 border border-green-500/30">
                              <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Approved
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
