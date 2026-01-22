/**
 * Razorpay API service for payment gateway configuration and transactions
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

/**
 * Generic API request function
 */
const apiRequest = async (endpoint, options = {}) => {
  const token = localStorage.getItem('authToken');
  
  const config = {
    method: options.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  };

  if (options.body) {
    config.body = JSON.stringify(options.body);
  }

  // Handle query parameters for GET requests
  // Filter out undefined, null, and empty values
  if (options.queryParams) {
    const filteredParams = Object.entries(options.queryParams)
      .filter(([_, value]) => value !== undefined && value !== null && value !== '')
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
    
    if (Object.keys(filteredParams).length > 0) {
      const queryString = new URLSearchParams(filteredParams).toString();
      endpoint = `${endpoint}?${queryString}`;
    }
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    
    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('Non-JSON response received:', text.substring(0, 200));
      throw new Error(`Server returned non-JSON response. Status: ${response.status}. Please check if the API server is running.`);
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error('API request error:', error);
    if (error.message && error.message.includes('non-JSON')) {
      throw error;
    }
    throw new Error(error.message || 'Failed to connect to API server. Please check if the server is running.');
  }
};

// ==========================================
// CONFIGURATION APIs
// ==========================================

/**
 * Get Razorpay configuration for a reseller
 * @param {string} resellerId - Reseller UUID
 * @returns {Promise<object>} Configuration data
 */
export const getRazorpayConfig = async (resellerId) => {
  return apiRequest(`/razorpay/config/${resellerId}`, {
    method: 'GET'
  });
};

/**
 * Save Razorpay configuration for a reseller
 * @param {object} configData - Configuration data
 * @param {string} configData.reseller_id - Reseller UUID
 * @param {string} configData.key_id - Razorpay Key ID
 * @param {string} configData.key_secret - Razorpay Key Secret
 * @param {string} configData.webhook_secret - Webhook secret for signature verification
 * @returns {Promise<object>} Response with saved configuration
 */
export const saveRazorpayConfig = async (configData) => {
  return apiRequest('/razorpay/config', {
    method: 'POST',
    body: configData
  });
};

/**
 * Get webhook URL for a reseller
 * @param {string} resellerId - Reseller UUID
 * @returns {Promise<object>} Response with webhook URL and instructions
 */
export const getWebhookUrl = async (resellerId) => {
  return apiRequest(`/razorpay/webhook-url/${resellerId}`, {
    method: 'GET'
  });
};

// ==========================================
// TRANSACTION APIs (Super Admin)
// ==========================================

/**
 * Get all transactions for super admin dashboard
 * @param {object} options - Query options
 * @param {number} options.limit - Number of transactions to fetch
 * @param {number} options.offset - Offset for pagination
 * @param {string} options.status - Filter by status
 * @param {string} options.reseller_id - Filter by reseller
 * @param {string} options.start_date - Filter by start date
 * @param {string} options.end_date - Filter by end date
 * @returns {Promise<object>} Response with transactions and summary
 */
export const getAllTransactions = async (options = {}) => {
  return apiRequest('/razorpay/transactions', {
    method: 'GET',
    queryParams: options
  });
};

/**
 * Get transaction statistics for super admin dashboard
 * @returns {Promise<object>} Response with transaction statistics
 */
export const getTransactionStats = async () => {
  return apiRequest('/razorpay/transactions/stats', {
    method: 'GET'
  });
};

// ==========================================
// PLAN & SUBSCRIPTION APIs
// ==========================================

/**
 * Create a Razorpay plan
 * @param {object} planData - Plan data
 * @param {string} planData.reseller_id - Reseller UUID
 * @param {string} planData.plan_name - Plan name
 * @param {number} planData.amount - Amount in rupees
 * @param {string} planData.currency - Currency code (default: INR)
 * @param {number} planData.duration_days - Duration in days
 * @param {string} planData.description - Plan description (optional)
 * @returns {Promise<object>} Response with plan_id
 */
export const createRazorpayPlan = async (planData) => {
  return apiRequest('/razorpay/plan', {
    method: 'POST',
    body: planData
  });
};

/**
 * Create a Razorpay subscription
 * @param {object} subscriptionData - Subscription data
 * @param {string} subscriptionData.reseller_id - Reseller UUID
 * @param {string} subscriptionData.plan_id - Razorpay plan ID
 * @param {number} subscriptionData.total_count - Total billing cycles (optional)
 * @param {object} subscriptionData.customer - Customer details (optional)
 * @param {object} subscriptionData.notes - Additional notes (optional)
 * @returns {Promise<object>} Response with subscription_id
 */
export const createRazorpaySubscription = async (subscriptionData) => {
  return apiRequest('/razorpay/subscription', {
    method: 'POST',
    body: subscriptionData
  });
};

/**
 * Create both Razorpay plan and subscription in one call
 * @param {object} data - Combined plan and subscription data
 * @param {string} data.reseller_id - Reseller UUID
 * @param {string} data.plan_name - Plan name
 * @param {number} data.amount - Amount
 * @param {string} data.currency - Currency code (default: INR)
 * @param {number} data.duration_days - Duration in days
 * @param {string} data.description - Plan description (optional)
 * @param {number} data.total_count - Total billing cycles (optional)
 * @param {object} data.customer - Customer details (optional)
 * @param {object} data.notes - Additional notes (optional)
 * @returns {Promise<object>} Response with plan_id and subscription_id
 */
export const createRazorpayPlanAndSubscription = async (data) => {
  return apiRequest('/razorpay/plan-and-subscription', {
    method: 'POST',
    body: data
  });
};
