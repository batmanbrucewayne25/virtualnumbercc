import crypto from 'crypto';
import { getHasuraClient } from '../config/hasura.client.js';

/**
 * Razorpay Webhook Service
 * Handles incoming payment webhooks from reseller Razorpay accounts
 * All transactions are stored in mst_transaction table for super admin monitoring
 */

/**
 * Verify Razorpay webhook signature
 * @param {string} body - Raw request body
 * @param {string} signature - X-Razorpay-Signature header
 * @param {string} webhookSecret - Webhook secret from reseller config
 * @returns {boolean}
 */
export function verifyWebhookSignature(body, signature, webhookSecret) {
  if (!webhookSecret || !signature) {
    // If no webhook secret configured, skip verification (not recommended for production)
    console.warn('Webhook signature verification skipped - no webhook secret configured');
    return true;
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error('Webhook signature verification error:', error);
    return false;
  }
}

/**
 * Get reseller's Razorpay config by reseller ID
 * @param {string} resellerId - Reseller UUID
 * @returns {Promise<object|null>}
 */
export async function getResellerRazorpayConfig(resellerId) {
  const client = getHasuraClient();

  const query = `
    query GetRazorpayConfig($reseller_id: uuid!) {
      mst_razorpay_config(
        where: { reseller_id: { _eq: $reseller_id }, is_active: { _eq: true } }
        limit: 1
      ) {
        id
        reseller_id
        key_id
        webhook_secret
        is_active
      }
    }
  `;

  try {
    const result = await client.client.request(query, { reseller_id: resellerId });
    return result.mst_razorpay_config?.[0] || null;
  } catch (error) {
    console.error('Error fetching reseller Razorpay config:', error);
    return null;
  }
}

/**
 * Get reseller info by ID
 * @param {string} resellerId - Reseller UUID
 * @returns {Promise<object|null>}
 */
export async function getResellerInfo(resellerId) {
  const client = getHasuraClient();

  const query = `
    query GetResellerInfo($reseller_id: uuid!) {
      mst_reseller_by_pk(id: $reseller_id) {
        id
        first_name
        last_name
        email
        business_name
      }
    }
  `;

  try {
    const result = await client.client.request(query, { reseller_id: resellerId });
    return result.mst_reseller_by_pk || null;
  } catch (error) {
    console.error('Error fetching reseller info:', error);
    return null;
  }
}

/**
 * Check if transaction already exists (to prevent duplicates)
 * @param {string} razorpayPaymentId - Razorpay payment ID
 * @returns {Promise<boolean>}
 */
export async function transactionExists(razorpayPaymentId) {
  if (!razorpayPaymentId) return false;

  const client = getHasuraClient();

  const query = `
    query CheckTransactionExists($razorpay_payment_id: String!) {
      mst_transaction(
        where: { razorpay_payment_id: { _eq: $razorpay_payment_id } }
        limit: 1
      ) {
        id
      }
    }
  `;

  try {
    const result = await client.client.request(query, { razorpay_payment_id: razorpayPaymentId });
    return result.mst_transaction && result.mst_transaction.length > 0;
  } catch (error) {
    console.error('Error checking transaction existence:', error);
    return false;
  }
}

/**
 * Create transaction record from Razorpay webhook payload
 * @param {string} resellerId - Reseller UUID
 * @param {object} paymentData - Payment data from webhook
 * @returns {Promise<object>}
 */
export async function createTransactionFromWebhook(resellerId, paymentData) {
  const client = getHasuraClient();

  // Generate unique transaction number
  const transactionNumber = `TXN${Date.now()}${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

  // Map Razorpay status to our status
  const statusMap = {
    'authorized': 'authorized',
    'captured': 'success',
    'failed': 'failed',
    'refunded': 'refunded'
  };

  const status = statusMap[paymentData.status] || paymentData.status || 'pending';

  // Convert amount from paise to rupees for storage
  const amountInRupees = (paymentData.amount || 0) / 100;

  const mutation = `
    mutation CreateWebhookTransaction(
      $transaction_number: String!
      $reseller_id: uuid!
      $customer_id: uuid
      $transaction_type: String!
      $payment_mode: String
      $payment_method: String
      $amount: numeric!
      $status: String!
      $razorpay_payment_id: String
      $razorpay_order_id: String
      $razorpay_signature: String
      $reference_number: String
      $payment_date: date
      $failure_reason: String
      $customer_email: String
      $customer_phone: String
      $customer_name: String
      $currency: String
      $description: String
      $notes: jsonb
    ) {
      insert_mst_transaction_one(object: {
        transaction_number: $transaction_number
        reseller_id: $reseller_id
        customer_id: $customer_id
        transaction_type: $transaction_type
        payment_mode: $payment_mode
        payment_method: $payment_method
        amount: $amount
        status: $status
        razorpay_payment_id: $razorpay_payment_id
        razorpay_order_id: $razorpay_order_id
        razorpay_signature: $razorpay_signature
        reference_number: $reference_number
        payment_date: $payment_date
        failure_reason: $failure_reason
        customer_email: $customer_email
        customer_phone: $customer_phone
        customer_name: $customer_name
        currency: $currency
        description: $description
        notes: $notes
      }) {
        id
        transaction_number
        reseller_id
        amount
        status
        razorpay_payment_id
        created_at
      }
    }
  `;

  try {
    const result = await client.client.request(mutation, {
      transaction_number: transactionNumber,
      reseller_id: resellerId,
      customer_id: null, // Can be linked later if customer exists
      transaction_type: 'payment',
      payment_mode: 'razorpay',
      payment_method: paymentData.method || null,
      amount: amountInRupees,
      status: status,
      razorpay_payment_id: paymentData.id || null,
      razorpay_order_id: paymentData.order_id || null,
      razorpay_signature: null,
      reference_number: paymentData.invoice_id || null,
      payment_date: paymentData.created_at ? new Date(paymentData.created_at * 1000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      failure_reason: paymentData.error_description || paymentData.error_reason || null,
      customer_email: paymentData.email || paymentData.notes?.email || null,
      customer_phone: paymentData.contact || paymentData.notes?.phone || null,
      customer_name: paymentData.notes?.customer_name || null,
      currency: paymentData.currency || 'INR',
      description: paymentData.description || null,
      notes: paymentData.notes || null
    });

    if (result?.insert_mst_transaction_one) {
      return {
        success: true,
        data: result.insert_mst_transaction_one
      };
    }

    return {
      success: false,
      message: 'Failed to insert transaction'
    };
  } catch (error) {
    console.error('Error creating transaction from webhook:', error);
    return {
      success: false,
      message: error.message || 'Failed to create transaction'
    };
  }
}

/**
 * Update existing transaction status from webhook
 * @param {string} razorpayPaymentId - Razorpay payment ID
 * @param {string} status - New status
 * @param {string} failureReason - Failure reason if applicable
 * @returns {Promise<object>}
 */
export async function updateTransactionStatus(razorpayPaymentId, status, failureReason = null) {
  const client = getHasuraClient();

  const statusMap = {
    'authorized': 'authorized',
    'captured': 'success',
    'failed': 'failed',
    'refunded': 'refunded'
  };

  const mappedStatus = statusMap[status] || status;

  const mutation = `
    mutation UpdateTransactionStatus(
      $razorpay_payment_id: String!
      $status: String!
      $failure_reason: String
    ) {
      update_mst_transaction(
        where: { razorpay_payment_id: { _eq: $razorpay_payment_id } }
        _set: {
          status: $status
          failure_reason: $failure_reason
        }
      ) {
        affected_rows
        returning {
          id
          status
          updated_at
        }
      }
    }
  `;

  try {
    const result = await client.client.request(mutation, {
      razorpay_payment_id: razorpayPaymentId,
      status: mappedStatus,
      failure_reason: failureReason
    });

    if (result?.update_mst_transaction?.affected_rows > 0) {
      return {
        success: true,
        data: result.update_mst_transaction.returning[0]
      };
    }

    return {
      success: false,
      message: 'Transaction not found or not updated'
    };
  } catch (error) {
    console.error('Error updating transaction status:', error);
    return {
      success: false,
      message: error.message || 'Failed to update transaction'
    };
  }
}

/**
 * Process payment.authorized event
 * @param {string} resellerId - Reseller UUID
 * @param {object} payload - Webhook payload
 * @returns {Promise<object>}
 */
export async function processPaymentAuthorized(resellerId, payload) {
  const paymentData = payload.payload?.payment?.entity;
  if (!paymentData) {
    return { success: false, message: 'Invalid payment data in webhook payload' };
  }

  // Check if transaction already exists
  const exists = await transactionExists(paymentData.id);
  if (exists) {
    // Update status if it exists
    return await updateTransactionStatus(paymentData.id, 'authorized');
  }

  // Create new transaction
  return await createTransactionFromWebhook(resellerId, {
    ...paymentData,
    status: 'authorized'
  });
}

/**
 * Process payment.captured event
 * @param {string} resellerId - Reseller UUID
 * @param {object} payload - Webhook payload
 * @returns {Promise<object>}
 */
export async function processPaymentCaptured(resellerId, payload) {
  const paymentData = payload.payload?.payment?.entity;
  if (!paymentData) {
    return { success: false, message: 'Invalid payment data in webhook payload' };
  }

  // Check if transaction already exists
  const exists = await transactionExists(paymentData.id);
  if (exists) {
    // Update status if it exists
    return await updateTransactionStatus(paymentData.id, 'captured');
  }

  // Create new transaction
  return await createTransactionFromWebhook(resellerId, {
    ...paymentData,
    status: 'captured'
  });
}

/**
 * Process payment.failed event
 * @param {string} resellerId - Reseller UUID
 * @param {object} payload - Webhook payload
 * @returns {Promise<object>}
 */
export async function processPaymentFailed(resellerId, payload) {
  const paymentData = payload.payload?.payment?.entity;
  if (!paymentData) {
    return { success: false, message: 'Invalid payment data in webhook payload' };
  }

  const failureReason = paymentData.error_description || 
                        paymentData.error_reason || 
                        payload.payload?.error?.description ||
                        'Payment failed';

  // Check if transaction already exists
  const exists = await transactionExists(paymentData.id);
  if (exists) {
    // Update status if it exists
    return await updateTransactionStatus(paymentData.id, 'failed', failureReason);
  }

  // Create new transaction
  return await createTransactionFromWebhook(resellerId, {
    ...paymentData,
    status: 'failed',
    error_description: failureReason
  });
}

/**
 * Process refund.created event
 * @param {string} resellerId - Reseller UUID
 * @param {object} payload - Webhook payload
 * @returns {Promise<object>}
 */
export async function processRefundCreated(resellerId, payload) {
  const refundData = payload.payload?.refund?.entity;
  const paymentId = refundData?.payment_id;
  
  if (!refundData || !paymentId) {
    return { success: false, message: 'Invalid refund data in webhook payload' };
  }

  // Update the original transaction status to refunded
  return await updateTransactionStatus(paymentId, 'refunded', `Refund ID: ${refundData.id}`);
}

/**
 * Process order.paid event (for subscription payments)
 * @param {string} resellerId - Reseller UUID
 * @param {object} payload - Webhook payload
 * @returns {Promise<object>}
 */
export async function processOrderPaid(resellerId, payload) {
  const orderData = payload.payload?.order?.entity;
  const paymentData = payload.payload?.payment?.entity;
  
  if (!orderData && !paymentData) {
    return { success: false, message: 'Invalid order data in webhook payload' };
  }

  // If payment data exists, process as captured payment
  if (paymentData) {
    const exists = await transactionExists(paymentData.id);
    if (exists) {
      return await updateTransactionStatus(paymentData.id, 'captured');
    }

    return await createTransactionFromWebhook(resellerId, {
      ...paymentData,
      order_id: orderData?.id,
      status: 'captured'
    });
  }

  return { success: true, message: 'Order paid event processed' };
}

/**
 * Process subscription.charged event
 * @param {string} resellerId - Reseller UUID
 * @param {object} payload - Webhook payload
 * @returns {Promise<object>}
 */
export async function processSubscriptionCharged(resellerId, payload) {
  const subscriptionData = payload.payload?.subscription?.entity;
  const paymentData = payload.payload?.payment?.entity;
  
  if (!paymentData) {
    return { success: false, message: 'Invalid subscription payment data in webhook payload' };
  }

  // Check if transaction already exists
  const exists = await transactionExists(paymentData.id);
  if (exists) {
    return await updateTransactionStatus(paymentData.id, 'captured');
  }

  // Create new transaction with subscription info
  return await createTransactionFromWebhook(resellerId, {
    ...paymentData,
    status: 'captured',
    notes: {
      ...paymentData.notes,
      subscription_id: subscriptionData?.id,
      subscription_status: subscriptionData?.status
    }
  });
}

/**
 * Get all transactions for super admin dashboard
 * @param {object} options - Query options
 * @returns {Promise<object>}
 */
export async function getAllTransactions(options = {}) {
  const client = getHasuraClient();
  const { limit = 100, offset = 0, status, resellerId, startDate, endDate } = options;

  let whereClause = '';
  const conditions = [];

  // Helper function to check if value is valid (not undefined, null, empty, or string "undefined")
  const isValidValue = (val) => val && val !== 'all' && val !== 'undefined' && val !== '';

  if (isValidValue(status)) {
    conditions.push(`status: { _eq: "${status}" }`);
  }
  if (isValidValue(resellerId)) {
    conditions.push(`reseller_id: { _eq: "${resellerId}" }`);
  }
  if (isValidValue(startDate)) {
    conditions.push(`created_at: { _gte: "${startDate}" }`);
  }
  if (isValidValue(endDate)) {
    conditions.push(`created_at: { _lte: "${endDate}" }`);
  }

  // Build where clause for the query
  let transactionWhereArg = '';
  let aggregateWhereArg = '';
  
  if (conditions.length > 0) {
    whereClause = `where: { ${conditions.join(', ')} }`;
    transactionWhereArg = whereClause;
    aggregateWhereArg = `(${whereClause})`;
  }

  const query = `
    query GetAllTransactions($limit: Int!, $offset: Int!) {
      mst_transaction(
        ${transactionWhereArg}
        order_by: { created_at: desc }
        limit: $limit
        offset: $offset
      ) {
        id
        transaction_number
        reseller_id
        customer_id
        transaction_type
        payment_mode
        payment_method
        amount
        currency
        status
        razorpay_payment_id
        razorpay_order_id
        reference_number
        payment_date
        failure_reason
        customer_email
        customer_phone
        customer_name
        description
        notes
        created_at
        updated_at
        mst_reseller {
          id
          first_name
          last_name
          email
          business_name
        }
        mst_customer {
          id
          profile_name
          email
          phone
        }
      }
      mst_transaction_aggregate${aggregateWhereArg} {
        aggregate {
          count
          sum {
            amount
          }
        }
      }
    }
  `;

  try {
    const result = await client.client.request(query, { limit, offset });
    
    // Get statistics
    const transactions = result.mst_transaction || [];
    const aggregate = result.mst_transaction_aggregate?.aggregate || {};
    
    const successfulTransactions = transactions.filter(t => t.status === 'success' || t.status === 'captured');
    const failedTransactions = transactions.filter(t => t.status === 'failed');

    return {
      success: true,
      data: {
        transactions,
        summary: {
          total_transactions: aggregate.count || 0,
          total_amount: aggregate.sum?.amount || 0,
          total_amount_formatted: `₹${(aggregate.sum?.amount || 0).toFixed(2)}`,
          successful_count: successfulTransactions.length,
          failed_count: failedTransactions.length
        }
      }
    };
  } catch (error) {
    console.error('Error fetching all transactions:', error);
    return {
      success: false,
      message: error.message || 'Failed to fetch transactions'
    };
  }
}

/**
 * Get transaction statistics for super admin dashboard
 * @returns {Promise<object>}
 */
export async function getTransactionStats() {
  const client = getHasuraClient();

  const query = `
    query GetTransactionStats {
      total: mst_transaction_aggregate {
        aggregate {
          count
          sum {
            amount
          }
        }
      }
      successful: mst_transaction_aggregate(where: { status: { _in: ["success", "captured"] } }) {
        aggregate {
          count
          sum {
            amount
          }
        }
      }
      failed: mst_transaction_aggregate(where: { status: { _eq: "failed" } }) {
        aggregate {
          count
        }
      }
      pending: mst_transaction_aggregate(where: { status: { _in: ["pending", "authorized"] } }) {
        aggregate {
          count
        }
      }
      refunded: mst_transaction_aggregate(where: { status: { _eq: "refunded" } }) {
        aggregate {
          count
        }
      }
      today: mst_transaction_aggregate(
        where: { created_at: { _gte: "${new Date().toISOString().split('T')[0]}" } }
      ) {
        aggregate {
          count
          sum {
            amount
          }
        }
      }
      resellers_with_transactions: mst_transaction(distinct_on: reseller_id) {
        reseller_id
      }
    }
  `;

  try {
    const result = await client.client.request(query);

    return {
      success: true,
      data: {
        total_count: result.total?.aggregate?.count || 0,
        total_amount: result.total?.aggregate?.sum?.amount || 0,
        successful_count: result.successful?.aggregate?.count || 0,
        successful_amount: result.successful?.aggregate?.sum?.amount || 0,
        failed_count: result.failed?.aggregate?.count || 0,
        pending_count: result.pending?.aggregate?.count || 0,
        refunded_count: result.refunded?.aggregate?.count || 0,
        today_count: result.today?.aggregate?.count || 0,
        today_amount: result.today?.aggregate?.sum?.amount || 0,
        active_resellers: result.resellers_with_transactions?.length || 0
      }
    };
  } catch (error) {
    console.error('Error fetching transaction stats:', error);
    return {
      success: false,
      message: error.message || 'Failed to fetch transaction statistics'
    };
  }
}

/**
 * Generate webhook URL for a reseller
 * @param {string} resellerId - Reseller UUID
 * @param {string} baseUrl - API base URL
 * @returns {string}
 */
export function generateWebhookUrl(resellerId, baseUrl) {
  return `${baseUrl}/api/razorpay/webhook/${resellerId}`;
}
