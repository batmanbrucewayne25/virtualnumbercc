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
 * Shallow-merge partial fields into stored userData (e.g. after logo upload) and keep permissions.
 */
export const mergeUserData = (partial) => {
  const token = getAuthToken();
  const userData = getUserData();
  if (!token || !userData) return false;
  saveAuthToken(token, { ...userData, ...partial }, getUserPermissions());
  return true;
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

/**
 * Decode JWT payload without verifying signature (signature is verified server-side).
 * Returns null if token is missing or malformed.
 */
const decodeJwtPayload = (token) => {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload;
  } catch {
    return null;
  }
};

/**
 * Get the authenticated session from the JWT token.
 * Returns { id, role, email } sourced from the JWT payload.
 * Falls back to localStorage userData only when no JWT is present (e.g. dev/admin mode).
 * Returns null if not authenticated.
 */
export const getAuthSession = () => {
  const token = getAuthToken();
  if (token) {
    const payload = decodeJwtPayload(token);
    if (payload) {
      // Check token expiry
      if (payload.exp && Date.now() / 1000 > payload.exp) {
        clearAuth();
        return null;
      }
      return {
        id: payload.userId || payload.id || payload.sub || null,
        role: payload.role || null,
        email: payload.email || null,
      };
    }
  }
  // Fallback: use localStorage userData (less secure, but acceptable when no JWT)
  const userData = getUserData();
  if (!userData) return null;
  return {
    id: userData.id || null,
    role: userData.role || null,
    email: userData.email || null,
  };
};

/**
 * Returns true if the current session belongs to an admin or super_admin.
 */
export const isAdminSession = () => {
  const session = getAuthSession();
  return session?.role === 'admin' || session?.role === 'super_admin';
};

/**
 * Returns the reseller ID of the currently logged-in reseller.
 * Throws an error if the session is not a reseller (prevents privilege escalation).
 * Returns null if not authenticated.
 */
export const getResellerIdFromSession = () => {
  const session = getAuthSession();
  if (!session) return null;
  if (session.role !== 'reseller') return null;
  return session.id || null;
};
