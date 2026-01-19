/**
 * API utility functions for backend communication
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

/**
 * Generic API request function
 */
const apiRequest = async (endpoint, options = {}) => {
  const token = localStorage.getItem('authToken');
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    ...options,
  };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
};

/**
 * Authentication API
 */
export const login = async (email, password) => {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
};

export const register = async (userData) => {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: userData,
  });
};

export const forgotPassword = async (email) => {
  return apiRequest('/auth/forgot-password', {
    method: 'POST',
    body: { email },
  });
};

export const resetPassword = async (token, password) => {
  return apiRequest('/auth/reset-password', {
    method: 'POST',
    body: { token, password },
  });
};

/**
 * Admin Management API
 */
export const getAdmins = async () => {
  return apiRequest('/admin/list');
};

export const getAdminById = async (id) => {
  return apiRequest(`/admin/${id}`);
};

export const createAdmin = async (adminData) => {
  return apiRequest('/admin/create', {
    method: 'POST',
    body: adminData,
  });
};

export const updateAdmin = async (id, adminData) => {
  return apiRequest(`/admin/${id}`, {
    method: 'PUT',
    body: adminData,
  });
};

export const deleteAdmin = async (id) => {
  return apiRequest(`/admin/${id}`, {
    method: 'DELETE',
  });
};

export default {
  login,
  register,
  getAdmins,
  getAdminById,
  createAdmin,
  updateAdmin,
  deleteAdmin,
};
