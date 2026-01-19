// Authentication utility functions

/**
 * Generate a simple token (for production, use JWT)
 */
export const generateToken = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return btoa(`${timestamp}-${random}-${Date.now()}`).replace(/[^a-zA-Z0-9]/g, '');
};

/**
 * Save authentication token and user data
 */
export const saveAuthToken = (token, userData, permissions = null) => {
  localStorage.setItem('authToken', token);
  localStorage.setItem('userData', JSON.stringify(userData));
  localStorage.setItem('isAuthenticated', 'true');
  localStorage.setItem('tokenExpiry', (Date.now() + 7 * 24 * 60 * 60 * 1000).toString()); // 7 days
  if (permissions) {
    localStorage.setItem('userPermissions', JSON.stringify(permissions));
  }
};

/**
 * Get user permissions from localStorage
 */
export const getUserPermissions = () => {
  const permissions = localStorage.getItem('userPermissions');
  if (permissions) {
    try {
      return JSON.parse(permissions);
    } catch (e) {
      return null;
    }
  }
  return null;
};

/**
 * Get authentication token
 */
export const getAuthToken = () => {
  return localStorage.getItem('authToken');
};

/**
 * Get user data from localStorage
 */
export const getUserData = () => {
  const userData = localStorage.getItem('userData');
  if (userData) {
    try {
      return JSON.parse(userData);
    } catch (e) {
      return null;
    }
  }
  return null;
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = () => {
  const token = getAuthToken();
  const isAuth = localStorage.getItem('isAuthenticated') === 'true';
  const expiry = localStorage.getItem('tokenExpiry');
  
  if (!token || !isAuth) {
    return false;
  }
  
  // Check if token is expired
  if (expiry && Date.now() > parseInt(expiry)) {
    clearAuth();
    return false;
  }
  
  return true;
};

/**
 * Clear authentication data
 */
export const clearAuth = () => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('userData');
  localStorage.removeItem('isAuthenticated');
  localStorage.removeItem('tokenExpiry');
  localStorage.removeItem('userPermissions');
};

/**
 * Verify password (simple comparison - in production, use bcrypt or similar)
 * Note: This assumes passwords are stored as plain text or you have a way to verify hashed passwords
 */
export const verifyPassword = (inputPassword, storedPasswordHash) => {
  // If passwords are stored as plain text (as seen in signup), do direct comparison
  // For production, you should use bcrypt.compare or similar
  return inputPassword === storedPasswordHash;
};
