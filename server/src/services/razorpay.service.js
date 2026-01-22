import Razorpay from 'razorpay';
import { getHasuraClient } from '../config/hasura.client.js';

/**
 * Get Razorpay config from database by reseller ID
 * @param {string} resellerId - Reseller UUID
 * @returns {Promise<object|null>}
 */
async function getRazorpayConfig(resellerId) {
  const query = `
    query GetRazorpayConfig($reseller_id: uuid!) {
      mst_razorpay_config(where: { reseller_id: { _eq: $reseller_id }, is_active: { _eq: true } }, limit: 1) {
        id
        reseller_id
        key_id
        key_secret
        webhook_secret
        is_active
      }
    }
  `;

  try {
    const client = getHasuraClient();
    const data = await client.client.request(query, { reseller_id: resellerId });
    
    if (data.mst_razorpay_config && data.mst_razorpay_config.length > 0) {
      return data.mst_razorpay_config[0];
    }
    return null;
  } catch (error) {
    console.error('Error fetching Razorpay config:', error);
    throw new Error('Failed to fetch Razorpay configuration');
  }
}

/**
 * Initialize Razorpay instance with reseller credentials
 * @param {string} resellerId - Reseller UUID
 * @returns {Promise<Razorpay>}
 */
async function getRazorpayInstance(resellerId) {
  const config = await getRazorpayConfig(resellerId);
  
  if (!config) {
    throw new Error('Razorpay configuration not found for this reseller. Please configure Razorpay credentials first.');
  }

  if (!config.is_active) {
    throw new Error('Razorpay configuration is not active for this reseller.');
  }

  if (!config.key_id || !config.key_secret) {
    throw new Error('Razorpay API credentials not configured. Please add your Razorpay Key ID and Key Secret.');
  }

  return new Razorpay({
    key_id: config.key_id,
    key_secret: config.key_secret
  });
}

/**
 * Create a Razorpay plan
 * @param {string} resellerId - Reseller UUID
 * @param {object} planData - Plan data
 * @param {string} planData.plan_name - Plan name
 * @param {number} planData.amount - Amount in rupees
 * @param {string} planData.currency - Currency code (default: INR)
 * @param {number} planData.duration_days - Duration in days
 * @param {string} planData.description - Plan description (optional)
 * @returns {Promise<object>} Razorpay plan object
 */
export async function createRazorpayPlan(resellerId, planData) {
  try {
    const razorpay = await getRazorpayInstance(resellerId);

    // Convert amount to paise (smallest currency unit for INR)
    const amountInPaise = Math.round(planData.amount * 100);

    // Calculate interval based on duration_days
    let period = 'monthly';
    let interval = 1;

    if (planData.duration_days <= 7) {
      period = 'daily';
      interval = planData.duration_days;
    } else if (planData.duration_days <= 30) {
      period = 'daily';
      interval = planData.duration_days;
    } else if (planData.duration_days <= 90) {
      period = 'monthly';
      interval = Math.max(1, Math.round(planData.duration_days / 30));
    } else if (planData.duration_days <= 365) {
      period = 'monthly';
      interval = Math.max(1, Math.round(planData.duration_days / 30));
    } else {
      period = 'yearly';
      interval = Math.max(1, Math.round(planData.duration_days / 365));
    }

    const planOptions = {
      period: period,
      interval: interval,
      item: {
        name: planData.plan_name,
        amount: amountInPaise,
        currency: planData.currency || 'INR',
        description: planData.description || `${planData.plan_name} subscription plan`
      },
      notes: {
        duration_days: planData.duration_days.toString(),
        reseller_id: resellerId
      }
    };

    const plan = await razorpay.plans.create(planOptions);

    return {
      success: true,
      plan_id: plan.id,
      plan: plan
    };
  } catch (error) {
    console.error('Error creating Razorpay plan:', error);
    throw new Error(error.error?.description || error.message || 'Failed to create Razorpay plan');
  }
}

/**
 * Create a Razorpay subscription
 * @param {string} resellerId - Reseller UUID
 * @param {object} subscriptionData - Subscription data
 * @param {string} subscriptionData.plan_id - Razorpay plan ID
 * @param {number} subscriptionData.total_count - Total billing cycles (default: 1)
 * @param {object} subscriptionData.customer - Customer details (optional)
 * @param {object} subscriptionData.notes - Additional notes (optional)
 * @returns {Promise<object>} Razorpay subscription object
 */
export async function createRazorpaySubscription(resellerId, subscriptionData) {
  try {
    const razorpay = await getRazorpayInstance(resellerId);

    const notes = {
      reseller_id: resellerId,
      ...(subscriptionData.notes || {})
    };

    const subscriptionOptions = {
      plan_id: subscriptionData.plan_id,
      total_count: subscriptionData.total_count || 1,
      customer_notify: 1,
      ...(subscriptionData.customer && { customer: subscriptionData.customer }),
      notes: notes
    };

    const subscription = await razorpay.subscriptions.create(subscriptionOptions);

    return {
      success: true,
      subscription_id: subscription.id,
      subscription: subscription
    };
  } catch (error) {
    console.error('Error creating Razorpay subscription:', error);
    throw new Error(error.error?.description || error.message || 'Failed to create Razorpay subscription');
  }
}

/**
 * Create both plan and subscription in one call
 * @param {string} resellerId - Reseller UUID
 * @param {object} planData - Plan data
 * @param {object} subscriptionData - Subscription data (optional)
 * @returns {Promise<object>} Combined result with plan and subscription
 */
export async function createRazorpayPlanAndSubscription(resellerId, planData, subscriptionData = {}) {
  try {
    // First create the plan
    const planResult = await createRazorpayPlan(resellerId, planData);

    // Then create subscription using the plan ID
    const subscriptionResult = await createRazorpaySubscription(resellerId, {
      plan_id: planResult.plan_id,
      ...subscriptionData,
      notes: {
        reseller_id: resellerId,
        ...(subscriptionData.notes || {})
      }
    });

    return {
      success: true,
      plan_id: planResult.plan_id,
      subscription_id: subscriptionResult.subscription_id,
      plan: planResult.plan,
      subscription: subscriptionResult.subscription
    };
  } catch (error) {
    console.error('Error creating Razorpay plan and subscription:', error);
    throw error;
  }
}

/**
 * Create a Razorpay order for one-time payment
 * @param {string} resellerId - Reseller UUID
 * @param {object} orderData - Order data
 * @param {number} orderData.amount - Amount in rupees
 * @param {string} orderData.currency - Currency code (default: INR)
 * @param {string} orderData.receipt - Receipt ID (optional)
 * @param {object} orderData.notes - Additional notes (optional)
 * @returns {Promise<object>} Razorpay order object
 */
export async function createRazorpayOrder(resellerId, orderData) {
  try {
    const razorpay = await getRazorpayInstance(resellerId);

    // Convert amount to paise
    const amountInPaise = Math.round(orderData.amount * 100);

    const orderOptions = {
      amount: amountInPaise,
      currency: orderData.currency || 'INR',
      receipt: orderData.receipt || `receipt_${Date.now()}`,
      notes: {
        reseller_id: resellerId,
        ...(orderData.notes || {})
      }
    };

    const order = await razorpay.orders.create(orderOptions);

    return {
      success: true,
      order_id: order.id,
      order: order
    };
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    throw new Error(error.error?.description || error.message || 'Failed to create Razorpay order');
  }
}

/**
 * Verify Razorpay payment signature
 * @param {string} orderId - Razorpay order ID
 * @param {string} paymentId - Razorpay payment ID
 * @param {string} signature - Razorpay signature
 * @param {string} keySecret - Razorpay key secret
 * @returns {boolean}
 */
export function verifyPaymentSignature(orderId, paymentId, signature, keySecret) {
  const crypto = require('crypto');
  const body = orderId + '|' + paymentId;
  
  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(body.toString())
    .digest('hex');
  
  return expectedSignature === signature;
}

/**
 * Fetch payment details from Razorpay
 * @param {string} resellerId - Reseller UUID
 * @param {string} paymentId - Razorpay payment ID
 * @returns {Promise<object>}
 */
export async function fetchPayment(resellerId, paymentId) {
  try {
    const razorpay = await getRazorpayInstance(resellerId);
    const payment = await razorpay.payments.fetch(paymentId);
    
    return {
      success: true,
      payment: payment
    };
  } catch (error) {
    console.error('Error fetching payment:', error);
    throw new Error(error.error?.description || error.message || 'Failed to fetch payment');
  }
}

/**
 * Capture a payment
 * @param {string} resellerId - Reseller UUID
 * @param {string} paymentId - Razorpay payment ID
 * @param {number} amount - Amount to capture in paise
 * @returns {Promise<object>}
 */
export async function capturePayment(resellerId, paymentId, amount) {
  try {
    const razorpay = await getRazorpayInstance(resellerId);
    const payment = await razorpay.payments.capture(paymentId, amount);
    
    return {
      success: true,
      payment: payment
    };
  } catch (error) {
    console.error('Error capturing payment:', error);
    throw new Error(error.error?.description || error.message || 'Failed to capture payment');
  }
}

/**
 * Create a refund
 * @param {string} resellerId - Reseller UUID
 * @param {string} paymentId - Razorpay payment ID
 * @param {number} amount - Amount to refund in rupees (optional - full refund if not provided)
 * @param {object} options - Additional options
 * @returns {Promise<object>}
 */
export async function createRefund(resellerId, paymentId, amount = null, options = {}) {
  try {
    const razorpay = await getRazorpayInstance(resellerId);
    
    const refundOptions = {
      ...(amount && { amount: Math.round(amount * 100) }),
      notes: {
        reseller_id: resellerId,
        ...(options.notes || {})
      },
      ...(options.speed && { speed: options.speed }),
      ...(options.receipt && { receipt: options.receipt })
    };

    const refund = await razorpay.payments.refund(paymentId, refundOptions);
    
    return {
      success: true,
      refund: refund
    };
  } catch (error) {
    console.error('Error creating refund:', error);
    throw new Error(error.error?.description || error.message || 'Failed to create refund');
  }
}
