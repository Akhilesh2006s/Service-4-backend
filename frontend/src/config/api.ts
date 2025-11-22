// API Configuration
// Use localhost for local development, Railway URL for production
const getApiBaseUrl = (): string => {
  // Check if running on localhost
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Check for localhost or local development
    if (hostname === 'localhost' || 
        hostname === '127.0.0.1' ||
        hostname === '' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.')) {
      return 'http://localhost:5000/api';
    }
  }
  
  // Default to Railway URL for production
  return 'https://web-production-84a3.up.railway.app/api';
};

const API_BASE_URL = getApiBaseUrl();

export default API_BASE_URL;

