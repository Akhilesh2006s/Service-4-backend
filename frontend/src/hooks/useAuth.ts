import { useState, useEffect } from 'react';
import API_BASE_URL from '../config/api';

interface User {
  id: number;
  username?: string;
  name?: string;
  email: string;
  business_name?: string;
}

interface AuthState {
  isAuthenticated: boolean;
  userType: 'admin' | 'customer' | null;
  user: User | null;
  loading: boolean;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    userType: null,
    user: null,
    loading: true
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
      const storedUserType = localStorage.getItem('userType') as 'admin' | 'customer' | null;
      const userData = localStorage.getItem('userData');

      if (isAuthenticated && storedUserType && userData) {
        // Verify with backend
        const checkEndpoint = storedUserType === 'admin' 
          ? `${API_BASE_URL}/auth/check`
          : `${API_BASE_URL}/customer-auth/profile`;

        const response = await fetch(checkEndpoint, {
          credentials: 'include'
        });

        if (response.ok) {
          setAuthState({
            isAuthenticated: true,
            userType: storedUserType,
            user: JSON.parse(userData),
            loading: false
          });
        } else {
          clearAuth();
        }
      } else {
        clearAuth();
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      clearAuth();
    }
  };

  const clearAuth = () => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userType');
    localStorage.removeItem('userData');
    setAuthState({
      isAuthenticated: false,
      userType: null,
      user: null,
      loading: false
    });
  };

  const logout = async () => {
    try {
      const endpoint = authState.userType === 'admin'
        ? `${API_BASE_URL}/auth/logout`
        : `${API_BASE_URL}/customer-auth/logout`;
      
      await fetch(endpoint, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearAuth();
    }
  };

  return {
    ...authState,
    logout,
    checkAuth
  };
};

