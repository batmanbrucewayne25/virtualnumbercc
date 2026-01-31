/**
 * API utility functions for backend communication
 */

import { getApiBaseUrl } from './apiUrl.js';

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
    const API_BASE_URL = getApiBaseUrl();
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    
    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('Non-JSON response:', text.substring(0, 200));
      throw new Error(`Server returned non-JSON response. Status: ${response.status}. Please check if the endpoint exists.`);
    }
    
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
 * Change password for authenticated user
 */
export const changePassword = async (data) => {
  return apiRequest('/auth/change-password', {
    method: 'POST',
    body: data,
  });
};

/**
 * Dashboard API
 */
export const getDashboardStats = async () => {
  return apiRequest('/dashboard/stats');
};

export const getChartData = async () => {
  return apiRequest('/dashboard/charts');
};

// Alias for backward compatibility
export const getDashboardChartData = getChartData;

/**
 * Reseller Dashboard API
 */
export const getResellerDashboardStats = async () => {
  return apiRequest('/reseller-dashboard/stats');
};

/**
 * Get expiring numbers for Super Admin
 */
export const getAdminExpiringNumbers = async () => {
  return apiRequest('/dashboard/expiring-numbers');
};

export const getResellerDashboardCharts = async () => {
  return apiRequest('/reseller-dashboard/charts');
};

export const getExpiringNumbers = async () => {
  return apiRequest('/reseller-dashboard/expiring-numbers');
};

/**
 * KYC Verification API
 */
export const generateAadhaarOTP = async (idNumber) => {
  return apiRequest('/kyc/aadhaar/generate-otp', {
    method: 'POST',
    body: { id_number: idNumber },
  });
};

export const submitAadhaarOTP = async (requestId, otp) => {
  return apiRequest('/kyc/aadhaar/submit-otp', {
    method: 'POST',
    body: { request_id: requestId, otp },
  });
};

export const verifyPAN = async (panNumber, dob = null) => {
  return apiRequest('/kyc/pan/verify', {
    method: 'POST',
    body: { id_number: panNumber, ...(dob && { dob }) },
  });
};

export const verifyGST = async (gstNumber, filingStatusGet = true) => {
  return apiRequest('/kyc/gst/verify', {
    method: 'POST',
    body: { id_number: gstNumber, filing_status_get: filingStatusGet },
  });
};

export const verifyGSTSpecial = async (gstNumber, filingStatusGet = true) => {
  return apiRequest('/kyc/gst/verify-sp', {
    method: 'POST',
    body: { id_number: gstNumber, filing_status_get: filingStatusGet },
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
