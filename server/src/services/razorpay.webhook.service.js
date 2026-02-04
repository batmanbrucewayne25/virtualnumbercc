import crypto from "crypto";
import { getHasuraClient } from "../config/hasura.client.js";

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
    console.warn(
      "Webhook signature verification skipped - no webhook secret configured"
    );
    return true;
  }

  try {
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(body)
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error("Webhook signature verification error:", error);
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
    const result = await client.client.request(query, {
      reseller_id: resellerId,
    });
    return result.mst_razorpay_config?.[0] || null;
  } catch (error) {
    console.error("Error fetching reseller Razorpay config:", error);
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
    const result = await client.client.request(query, {
      reseller_id: resellerId,
    });
    return result.mst_reseller_by_pk || null;
  } catch (error) {
    console.error("Error fetching reseller info:", error);
    return null;
  }
}

/**
 * Check if webhook event was already processed (IDEMPOTENCY CHECK)
 * Uses webhook event ID to prevent duplicate processing
 * @param {string} eventId - Razorpay webhook event ID (e.g., event_...)
 * @param {string} resellerId - Reseller UUID
 * @returns {Promise<boolean>} True if event was already processed
 */
export async function isWebhookEventProcessed(eventId, resellerId) {
  if (!eventId) return false;

  const client = getHasuraClient();

  // Check if we have a webhook_events table, if not, fall back to old method
  const query = `
    query CheckWebhookEvent($event_id: String!, $reseller_id: uuid!) {
      mst_webhook_events(
        where: { 
          event_id: { _eq: $event_id }
          reseller_id: { _eq: $reseller_id }
        }
        limit: 1
      ) {
        id
        event_id
        processed_at
        transaction_id
      }
    }
  `;

  try {
    const result = await client.client.request(query, {
      event_id: eventId,
      reseller_id: resellerId,
    });

    const processed =
      result.mst_webhook_events && result.mst_webhook_events.length > 0;

    if (processed) {
      console.log(`[IDEMPOTENCY] Event ${eventId} already processed, skipping`);
    }

    return processed;
  } catch (error) {
    // If table doesn't exist, return false (will be created)
    if (
      error.message?.includes("mst_webhook_events") ||
      error.message?.includes("does not exist")
    ) {
      console.log(
        "[IDEMPOTENCY] Webhook events table not found, using payment ID fallback"
      );
      return false;
    }
    console.error("Error checking webhook event:", error);
    return false;
  }
}

/**
 * Record webhook event as processed (IDEMPOTENCY TRACKING)
 * @param {string} eventId - Razorpay webhook event ID
 * @param {string} resellerId - Reseller UUID
 * @param {string} transactionId - Transaction ID that was created/updated
 * @param {object} payload - Full webhook payload for audit
 * @returns {Promise<boolean>}
 */
export async function recordWebhookEvent(
  eventId,
  resellerId,
  transactionId,
  payload
) {
  if (!eventId) return false;

  const client = getHasuraClient();

  const mutation = `
    mutation RecordWebhookEvent(
      $event_id: String!
      $reseller_id: uuid!
      $transaction_id: uuid
      $event_type: String
      $payload: jsonb
    ) {
      insert_mst_webhook_events_one(
        object: {
          event_id: $event_id
          reseller_id: $reseller_id
          transaction_id: $transaction_id
          event_type: $event_type
          payload: $payload
          processed_at: "now()"
        }
        on_conflict: {
          constraint: mst_webhook_events_event_id_key
          update_columns: []
        }
      ) {
        id
        event_id
      }
    }
  `;

  try {
    await client.client.request(mutation, {
      event_id: eventId,
      reseller_id: resellerId,
      transaction_id: transactionId || null,
      event_type: payload.event || null,
      payload: payload || null,
    });
    console.log(`[IDEMPOTENCY] Recorded webhook event ${eventId}`);
    return true;
  } catch (error) {
    // If table doesn't exist, continue without recording
    if (
      error.message?.includes("mst_webhook_events") ||
      error.message?.includes("does not exist")
    ) {
      console.log(
        "[IDEMPOTENCY] Webhook events table not found, skipping recording"
      );
      return false;
    }
    console.error("Error recording webhook event:", error);
    return false;
  }
}

/**
 * Check if transaction already exists (to prevent duplicates)
 * @param {string} razorpayPaymentId - Razorpay payment ID
 * @returns {Promise<object|null>} Returns transaction object if exists, null otherwise
 */
export async function transactionExists(razorpayPaymentId) {
  if (!razorpayPaymentId) return null;

  const client = getHasuraClient();

  const query = `
    query CheckTransactionExists($razorpay_payment_id: String!) {
      mst_transaction(
        where: { razorpay_payment_id: { _eq: $razorpay_payment_id } }
        order_by: { created_at: desc }
        limit: 1
      ) {
        id
        transaction_number
        customer_id
        status
        razorpay_payment_id
        amount
        reseller_id
      }
    }
  `;

  try {
    const result = await client.client.request(query, {
      razorpay_payment_id: razorpayPaymentId,
    });
    return result.mst_transaction && result.mst_transaction.length > 0
      ? result.mst_transaction[0]
      : null;
  } catch (error) {
    console.error("Error checking transaction existence:", error);
    return null;
  }
}

/**
 * Find customer by email
 * @param {string} email - Customer email
 * @param {string} resellerId - Reseller UUID
 * @returns {Promise<object|null>}
 */
export async function findCustomerByEmail(email, resellerId) {
  if (!email) return null;

  const client = getHasuraClient();

  const query = `
    query FindCustomerByEmail($email: String!, $reseller_id: uuid!) {
      mst_customer(
        where: { 
          email: { _eq: $email }
          reseller_id: { _eq: $reseller_id }
        }
        limit: 1
      ) {
        id
        email
        profile_name
        phone
      }
    }
  `;

  try {
    const result = await client.client.request(query, {
      email,
      reseller_id: resellerId,
    });
    return result.mst_customer?.[0] || null;
  } catch (error) {
    console.error("Error finding customer by email:", error);
    return null;
  }
}

/**
 * Find existing pending transaction by customer_id and amount
 * Uses amount tolerance to handle floating point precision issues
 * Returns the pending transaction for updating (instead of deleting)
 * @param {string} customerId - Customer UUID
 * @param {number} amount - Transaction amount
 * @param {string} resellerId - Reseller UUID
 * @returns {Promise<object|null>} Returns the pending transaction if found
 */
export async function findPendingTransaction(
  customerId,
  amount,
  resellerId,
  orderId = null,
  paymentId = null
) {
  if ((!customerId && !orderId && !paymentId) || !amount) {
    return null;
  }

  const client = getHasuraClient();
  const amountTolerance = 0.01;
  const minAmount = amount - amountTolerance;
  const maxAmount = amount + amountTolerance;

  // Build dynamic where clause
  let whereClause = {
    amount: { _gte: minAmount, _lte: maxAmount },
    reseller_id: { _eq: resellerId },
    status: { _in: ["pending", "authorized"] },
  };

  // Search by payment_id if provided (most reliable)
  if (paymentId) {
    whereClause.razorpay_payment_id = { _eq: paymentId };
  }
  // Search by order_id
  else if (orderId) {
    whereClause.razorpay_order_id = { _eq: orderId };
  }
  // Search by customer_id (least reliable, only if no payment_id)
  else if (customerId) {
    whereClause.customer_id = { _eq: customerId };
    whereClause.razorpay_payment_id = { _is_null: true };
  } else {
    return null;
  }

  const query = `
    query FindPendingTransactions(
      $where: mst_transaction_bool_exp!
    ) {
      mst_transaction(
        where: $where
        order_by: { created_at: desc }
        limit: 1
      ) {
        id
        transaction_number
        customer_id
        amount
        status
        reseller_id
        razorpay_order_id
        razorpay_payment_id
        created_at
      }
    }
  `;

  try {
    const result = await client.client.request(query, {
      where: whereClause,
    });

    if (result.mst_transaction && result.mst_transaction.length > 0) {
      return result.mst_transaction[0];
    }
    return null;
  } catch (error) {
    console.error("[findPendingTransaction] Error:", error);
    return null;
  }
}

/**
 * Update pending transaction with Razorpay payment details
 * @param {string} transactionId - Transaction UUID to update
 * @param {object} paymentData - Payment data from Razorpay webhook
 * @param {string} status - Transaction status (authorized, captured, failed)
 * @returns {Promise<object>}
 */
export async function updatePendingTransactionWithPayment(
  transactionId,
  paymentData,
  status
) {
  const client = getHasuraClient();

  // Map Razorpay status to our status
  const statusMap = {
    authorized: "authorized",
    captured: "success",
    failed: "failed",
    refunded: "refunded",
  };

  const mappedStatus = statusMap[status] || status;

  const mutation = `
    mutation UpdatePendingTransaction(
      $transaction_id: uuid!
      $status: String!
      $razorpay_payment_id: String
      $razorpay_order_id: String
      $razorpay_signature: String
      $reference_number: String
      $payment_date: date
      $payment_method: String
      $customer_email: String
      $customer_phone: String
      $customer_name: String
      $description: String
      $notes: jsonb
      $failure_reason: String
    ) {
      update_mst_transaction_by_pk(
        pk_columns: { id: $transaction_id }
        _set: {
          status: $status
          razorpay_payment_id: $razorpay_payment_id
          razorpay_order_id: $razorpay_order_id
          razorpay_signature: $razorpay_signature
          reference_number: $reference_number
          payment_date: $payment_date
          payment_method: $payment_method
          payment_mode: "razorpay"
          customer_email: $customer_email
          customer_phone: $customer_phone
          customer_name: $customer_name
          description: $description
          notes: $notes
          failure_reason: $failure_reason
        }
      ) {
        id
        transaction_number
        customer_id
        reseller_id
        status
        razorpay_payment_id
        razorpay_order_id
        amount
        updated_at
      }
    }
  `;

  try {
    const result = await client.client.request(mutation, {
      transaction_id: transactionId,
      status: mappedStatus,
      razorpay_payment_id: paymentData.id || null,
      razorpay_order_id: paymentData.order_id || null,
      razorpay_signature: null,
      reference_number: paymentData.invoice_id || null,
      payment_date: paymentData.created_at
        ? new Date(paymentData.created_at * 1000).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      payment_method: paymentData.method || null,
      customer_email:
        paymentData.email ||
        paymentData.notes?.email ||
        paymentData.notes?.customer_email ||
        null,
      customer_phone: paymentData.contact || paymentData.notes?.phone || null,
      customer_name: paymentData.notes?.customer_name || null,
      description: paymentData.description || null,
      notes: paymentData.notes || null,
      failure_reason:
        paymentData.error_description || paymentData.error_reason || null,
    });

    if (result?.update_mst_transaction_by_pk) {
      console.log(
        `[updatePendingTransaction] Successfully updated transaction ${transactionId} to ${mappedStatus}`
      );
      return {
        success: true,
        data: result.update_mst_transaction_by_pk,
      };
    }

    return {
      success: false,
      message: "Failed to update pending transaction",
    };
  } catch (error) {
    console.error("[updatePendingTransaction] Error:", error);
    return {
      success: false,
      message: error.message || "Failed to update pending transaction",
    };
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
  const transactionNumber = `TXN${Date.now()}${Math.random()
    .toString(36)
    .substring(2, 9)
    .toUpperCase()}`;

  // Map Razorpay status to our status
  const statusMap = {
    authorized: "authorized",
    captured: "success",
    failed: "failed",
    refunded: "refunded",
  };

  const status =
    statusMap[paymentData.status] || paymentData.status || "pending";

  // Convert amount from paise to rupees for storage
  const amountInRupees = (paymentData.amount || 0) / 100;

  // Extract customer_id from notes first (most reliable)
  let customerId = paymentData.notes?.customer_id || null;

  // Fallback: Find by email
  if (!customerId) {
    const customerEmail =
      paymentData.email ||
      paymentData.notes?.email ||
      paymentData.notes?.customer_email;
    if (customerEmail) {
      const customer = await findCustomerByEmail(customerEmail, resellerId);
      if (customer) {
        customerId = customer.id;
      }
    }
  }

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
    // CRITICAL: Double-check that transaction doesn't already exist before creating
    // This is a final safeguard against race conditions
    if (paymentData.id) {
      const finalCheck = await transactionExists(paymentData.id);
      if (finalCheck) {
        console.log(
          `[FINAL CHECK] Transaction ${paymentData.id} already exists, returning existing transaction`
        );
        return {
          success: true,
          data: finalCheck,
          message: "Transaction already exists",
        };
      }
    }

    // Get customer name if customer found
    let customerName = paymentData.notes?.customer_name || null;
    if (customerId && !customerName) {
      const customer = await findCustomerByEmail(customerEmail, resellerId);
      if (customer) {
        customerName = customer.profile_name || customer.email;
      }
    }

    const result = await client.client.request(mutation, {
      transaction_number: transactionNumber,
      reseller_id: resellerId,
      customer_id: customerId, // Link customer if found
      transaction_type: "payment",
      payment_mode: "razorpay",
      payment_method: paymentData.method || null,
      amount: amountInRupees,
      status: status,
      razorpay_payment_id: paymentData.id || null,
      razorpay_order_id: paymentData.order_id || null,
      razorpay_signature: null,
      reference_number: paymentData.invoice_id || null,
      payment_date: paymentData.created_at
        ? new Date(paymentData.created_at * 1000).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      failure_reason:
        paymentData.error_description || paymentData.error_reason || null,
      customer_email: customerEmail || null,
      customer_phone: paymentData.contact || paymentData.notes?.phone || null,
      customer_name: customerName,
      currency: paymentData.currency || "INR",
      description: paymentData.description || null,
      notes: paymentData.notes || null,
    });

    if (result?.insert_mst_transaction_one) {
      // Update customer status to "active" if payment is successful
      if (customerId && (status === "success" || status === "authorized")) {
        await updateCustomerStatusAfterPayment(customerId, resellerId);
      }

      return {
        success: true,
        data: result.insert_mst_transaction_one,
      };
    }

    return {
      success: false,
      message: "Failed to insert transaction",
    };
  } catch (error) {
    console.error("Error creating transaction from webhook:", error);

    // If error is due to duplicate (unique constraint violation), try to fetch and return existing transaction
    if (
      paymentData.id &&
      (error.message?.includes("duplicate") ||
        error.message?.includes("unique"))
    ) {
      console.log(
        `[DUPLICATE ERROR] Detected duplicate transaction for ${paymentData.id}, fetching existing`
      );
      const existing = await transactionExists(paymentData.id);
      if (existing) {
        return {
          success: true,
          data: existing,
          message: "Transaction already exists (caught duplicate error)",
        };
      }
    }

    return {
      success: false,
      message: error.message || "Failed to create transaction",
    };
  }
}

/**
 * Update customer status to active after successful payment
 * @param {string} customerId - Customer UUID
 * @param {string} resellerId - Reseller UUID
 */
async function updateCustomerStatusAfterPayment(customerId, resellerId) {
  if (!customerId) {
    return false;
  }

  const client = getHasuraClient();

  const mutation = `
    mutation UpdateCustomerStatus($customer_id: uuid!, $status: String!, $kyc_status: String!) {
      update_mst_customer_by_pk(
        pk_columns: { id: $customer_id }
        _set: { status: $status, kyc_status: $kyc_status }
      ) {
        id
        status
        kyc_status
        updated_at
      }
    }
  `;

  try {
    const result = await client.client.request(mutation, {
      customer_id: customerId,
      status: "active",
      kyc_status: "verified",
    });

    return result?.update_mst_customer_by_pk ? true : false;
  } catch (error) {
    console.error("[updateCustomerStatus] Error:", error.message);
    return false;
  }
}

/**
 * Update existing transaction status from webhook
 * @param {string} razorpayPaymentId - Razorpay payment ID
 * @param {string} status - New status
 * @param {string} failureReason - Failure reason if applicable
 * @param {string} transactionId - Optional transaction ID to update
 * @param {object} paymentData - Optional payment data to update additional fields
 * @returns {Promise<object>}
 */
export async function updateTransactionStatus(
  razorpayPaymentId,
  status,
  failureReason = null,
  transactionId = null,
  paymentData = null,
  resellerId = null
) {
  const client = getHasuraClient();

  const statusMap = {
    authorized: "authorized",
    captured: "success",
    failed: "failed",
    refunded: "refunded",
  };

  const mappedStatus = statusMap[status] || status;

  // Try to find customer by email from payment data to link customer_id
  let customerId = null;
  let resellerIdForLookup = resellerId || paymentData?.notes?.reseller_id;

  // If we have transactionId, fetch the transaction to get reseller_id and customer_id
  if (transactionId) {
    const fetchQuery = `
      query GetTransactionDetails($transaction_id: uuid!) {
        mst_transaction_by_pk(id: $transaction_id) {
          reseller_id
          customer_id
          notes
        }
      }
    `;
    try {
      const fetchResult = await client.client.request(fetchQuery, {
        transaction_id: transactionId,
      });
      if (fetchResult.mst_transaction_by_pk) {
        // Use reseller_id from transaction if not provided
        if (!resellerIdForLookup) {
          resellerIdForLookup = fetchResult.mst_transaction_by_pk.reseller_id;
        }
        // If transaction already has customer_id, use it (don't overwrite)
        if (fetchResult.mst_transaction_by_pk.customer_id) {
          customerId = fetchResult.mst_transaction_by_pk.customer_id;
        }
        // If customer_id is null but exists in notes, use it from notes
        else if (
          !customerId &&
          fetchResult.mst_transaction_by_pk.notes?.customer_id
        ) {
          customerId = fetchResult.mst_transaction_by_pk.notes.customer_id;
        }
      }
    } catch (error) {
      console.error("Error fetching transaction details:", error);
    }
  }

  // If we still don't have customerId, try to find customer by email
  if (!customerId && paymentData) {
    const customerEmail =
      paymentData.email ||
      paymentData.notes?.email ||
      paymentData.notes?.customer_email;

    if (customerEmail && resellerIdForLookup) {
      const customer = await findCustomerByEmail(
        customerEmail,
        resellerIdForLookup
      );
      if (customer) {
        customerId = customer.id;
      }
    }

    // Also check notes for customer_id (set when creating payment link)
    if (!customerId && paymentData.notes?.customer_id) {
      customerId = paymentData.notes.customer_id;
    }
  }

  // Build mutation based on identifier
  let mutation, variables;

  if (transactionId) {
    // Build mutation with conditional customer_id field
    const customerIdField = customerId ? "customer_id: $customer_id" : "";
    const customerIdVar = customerId ? "$customer_id: uuid" : "";

    mutation = `
    mutation UpdateTransactionStatus(
      $transaction_id: uuid!
      $status: String!
      $failure_reason: String
      $razorpay_payment_id: String
      $razorpay_order_id: String
      $reference_number: String
      $payment_date: date
      $payment_method: String
      $payment_mode: String
      ${customerIdVar}
    ) {
        update_mst_transaction(
          where: { id: { _eq: $transaction_id } }
          _set: {
            status: $status
            failure_reason: $failure_reason
            razorpay_payment_id: $razorpay_payment_id
            razorpay_order_id: $razorpay_order_id
            reference_number: $reference_number
            payment_date: $payment_date
            payment_method: $payment_method
            payment_mode: $payment_mode
            ${customerIdField}
          }
        ) {
          affected_rows
          returning {
            id
            transaction_number
            customer_id
            status
            razorpay_payment_id
            updated_at
          }
        }
      }
    `;
    variables = {
      transaction_id: transactionId,
      status: mappedStatus,
      failure_reason: failureReason || null,
      razorpay_payment_id: razorpayPaymentId || null,
      razorpay_order_id: paymentData?.order_id || null,
      reference_number: paymentData?.invoice_id || null,
      payment_date: paymentData?.created_at
        ? new Date(paymentData.created_at * 1000).toISOString().split("T")[0]
        : null,
      payment_method: paymentData?.method || null,
      payment_mode: "razorpay", // Always set payment_mode to razorpay for webhook transactions
      ...(customerId && { customer_id: customerId }), // Link customer_id if found
    };
  } else if (razorpayPaymentId) {
    // Build mutation with conditional customer_id field
    const customerIdField = customerId ? "customer_id: $customer_id" : "";
    const customerIdVar = customerId ? "$customer_id: uuid" : "";

    mutation = `
    mutation UpdateTransactionStatus(
      $razorpay_payment_id: String!
      $status: String!
      $failure_reason: String
      $razorpay_order_id: String
      $reference_number: String
      $payment_date: date
      $payment_method: String
      $payment_mode: String
      ${customerIdVar}
    ) {
        update_mst_transaction(
          where: { razorpay_payment_id: { _eq: $razorpay_payment_id } }
          _set: {
            status: $status
            failure_reason: $failure_reason
            razorpay_order_id: $razorpay_order_id
            reference_number: $reference_number
            payment_date: $payment_date
            payment_method: $payment_method
            payment_mode: $payment_mode
            ${customerIdField}
          }
        ) {
          affected_rows
          returning {
            id
            transaction_number
            customer_id
            status
            razorpay_payment_id
            updated_at
          }
        }
      }
    `;
    variables = {
      razorpay_payment_id: razorpayPaymentId,
      status: mappedStatus,
      failure_reason: failureReason || null,
      razorpay_order_id: paymentData?.order_id || null,
      reference_number: paymentData?.invoice_id || null,
      payment_date: paymentData?.created_at
        ? new Date(paymentData.created_at * 1000).toISOString().split("T")[0]
        : null,
      payment_method: paymentData?.method || null,
      payment_mode: "razorpay", // Always set payment_mode to razorpay for webhook transactions
      ...(customerId && { customer_id: customerId }), // Link customer_id if found
    };
  } else {
    return {
      success: false,
      message: "Transaction ID or Razorpay payment ID required",
    };
  }

  try {
    const result = await client.client.request(mutation, variables);

    if (result?.update_mst_transaction?.affected_rows > 0) {
      return {
        success: true,
        data: result.update_mst_transaction.returning[0],
      };
    }

    return {
      success: false,
      message: "Transaction not found or not updated",
    };
  } catch (error) {
    console.error("Error updating transaction status:", error);
    return {
      success: false,
      message: error.message || "Failed to update transaction",
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
    return {
      success: false,
      message: "Invalid payment data in webhook payload",
    };
  }

  // Check if transaction already exists by payment ID
  if (paymentData.id) {
    const existingTransaction = await transactionExists(paymentData.id);
    if (existingTransaction) {
      return {
        success: true,
        data: existingTransaction,
        message: "Transaction already exists",
      };
    }
  }

  const amountInRupees = (paymentData.amount || 0) / 100;

  // Extract customer_id from multiple possible locations
  let customerId = paymentData.notes?.customer_id || null;

  // If not in notes, try to find by email
  if (!customerId) {
    const customerEmail =
      paymentData.email ||
      paymentData.notes?.email ||
      paymentData.notes?.customer_email;
    if (customerEmail) {
      const customer = await findCustomerByEmail(customerEmail, resellerId);
      if (customer) {
        customerId = customer.id;
      }
    }
  }

  const orderId = paymentData.order_id || null;

  // Try to find and UPDATE the pending transaction
  const pendingTransaction = await findPendingTransaction(
    customerId,
    amountInRupees,
    resellerId,
    orderId,
    paymentData.id
  );

  if (pendingTransaction) {
    if (!customerId && pendingTransaction.customer_id) {
      customerId = pendingTransaction.customer_id;
    }

    const updateResult = await updatePendingTransactionWithPayment(
      pendingTransaction.id,
      paymentData,
      "authorized"
    );

    if (updateResult.success) {
      if (customerId) {
        await updateCustomerStatusAfterPayment(customerId, resellerId);
      }
      return updateResult;
    }
  }

  // Final check before creating
  if (paymentData.id) {
    const finalCheck = await transactionExists(paymentData.id);
    if (finalCheck) {
      return {
        success: true,
        data: finalCheck,
        message: "Transaction created by concurrent webhook",
      };
    }
  }

  // Create new transaction
  return await createTransactionFromWebhook(resellerId, {
    ...paymentData,
    status: "authorized",
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
  const eventId = payload.event_id || payload.id; // Razorpay event ID

  if (!paymentData) {
    return {
      success: false,
      message: "Invalid payment data in webhook payload",
    };
  }

  console.log(
    `[processPaymentCaptured] Processing payment ${paymentData.id}, Event: ${eventId}`
  );

  // ========================================
  // STEP 1: IDEMPOTENCY CHECK (Event-based)
  // ========================================
  if (eventId) {
    const alreadyProcessed = await isWebhookEventProcessed(eventId, resellerId);
    if (alreadyProcessed) {
      const existing = await transactionExists(paymentData.id);
      console.log(
        `[IDEMPOTENCY] Event ${eventId} already processed, returning existing transaction`
      );
      return {
        success: true,
        data: existing,
        message: "Webhook event already processed (idempotency)",
      };
    }
  }

  // ========================================
  // STEP 2: CHECK IF TRANSACTION EXISTS - UPDATE STATUS IF NEEDED
  // ========================================
  if (paymentData.id) {
    const existingTransaction = await transactionExists(paymentData.id);
    if (existingTransaction) {
      // If transaction exists but status is not "success", update it
      if (existingTransaction.status !== "success") {
        const updateResult = await updateTransactionStatus(
          paymentData.id,
          "captured",
          null,
          existingTransaction.id,
          paymentData,
          resellerId
        );

        // Update customer status if successful
        if (updateResult.success && existingTransaction.customer_id) {
          await updateCustomerStatusAfterPayment(
            existingTransaction.customer_id,
            resellerId
          );
        }

        // Record event
        if (eventId && updateResult.success) {
          await recordWebhookEvent(
            eventId,
            resellerId,
            existingTransaction.id,
            payload
          );
        }

        return updateResult;
      }

      // Transaction already exists and is "success", just record event
      if (eventId) {
        await recordWebhookEvent(
          eventId,
          resellerId,
          existingTransaction.id,
          payload
        );
      }
      return {
        success: true,
        data: existingTransaction,
        message: "Transaction already exists and is successful",
      };
    }
  }

  // ========================================
  // STEP 3: EXTRACT CUSTOMER ID
  // ========================================
  const amountInRupees = (paymentData.amount || 0) / 100;
  let customerId = paymentData.notes?.customer_id || null;
  const orderId = paymentData.order_id || null;

  // Fallback: Find by email
  if (!customerId) {
    const customerEmail =
      paymentData.email ||
      paymentData.notes?.email ||
      paymentData.notes?.customer_email;
    if (customerEmail) {
      const customer = await findCustomerByEmail(customerEmail, resellerId);
      if (customer) {
        customerId = customer.id;
      }
    }
  }

  // ========================================
  // STEP 4: UPDATE PENDING TRANSACTION
  // ========================================
  let result = null;
  let transactionId = null;

  // Try to find pending transaction by payment_id, order_id, or customer_id
  const pendingTransaction = await findPendingTransaction(
    customerId,
    amountInRupees,
    resellerId,
    orderId,
    paymentData.id
  );

  if (pendingTransaction) {
    // If customer_id wasn't found earlier, get it from pending transaction
    if (!customerId && pendingTransaction.customer_id) {
      customerId = pendingTransaction.customer_id;
    }

    const updateResult = await updatePendingTransactionWithPayment(
      pendingTransaction.id,
      paymentData,
      "captured"
    );

    if (updateResult.success) {
      result = updateResult;
      transactionId = pendingTransaction.id;

      // Update customer status to active after successful payment
      if (customerId) {
        await updateCustomerStatusAfterPayment(customerId, resellerId);
      }
    }
  }

  // ========================================
  // STEP 5: FINAL DUPLICATE CHECK & SKIP CREATE
  // ========================================
  if (!result && paymentData.id) {
    // One last check before giving up - maybe another webhook just processed it
    const finalCheck = await transactionExists(paymentData.id);
    if (finalCheck) {
      console.log(
        `[RACE CONDITION] Transaction created by concurrent webhook, returning it`
      );
      if (eventId) {
        await recordWebhookEvent(eventId, resellerId, finalCheck.id, payload);
      }
      return {
        success: true,
        data: finalCheck,
        message: "Transaction created by concurrent webhook",
      };
    }
  }

  // ========================================
  // STEP 6: CREATE NEW TRANSACTION (Last Resort)
  // ========================================
  if (!result) {
    result = await createTransactionFromWebhook(resellerId, {
      ...paymentData,
      status: "captured",
    });
    transactionId = result.data?.id;
  }

  // ========================================
  // STEP 7: RECORD EVENT (Idempotency)
  // ========================================
  if (eventId && transactionId) {
    await recordWebhookEvent(eventId, resellerId, transactionId, payload);
  }

  return result;
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
    return {
      success: false,
      message: "Invalid payment data in webhook payload",
    };
  }

  console.log(`[processPaymentFailed] Processing payment ${paymentData.id}`);

  // CRITICAL: Check if transaction already exists by payment ID FIRST
  // This prevents race conditions where multiple webhooks arrive simultaneously
  if (paymentData.id) {
    const existingTransaction = await transactionExists(paymentData.id);
    if (existingTransaction) {
      console.log(
        `[PRIORITY 0] Transaction already exists for payment ${paymentData.id}, updating status to failed`
      );
      const failureReason =
        paymentData.error_description ||
        paymentData.error_reason ||
        payload.payload?.error?.description ||
        "Payment failed";
      return await updateTransactionStatus(
        paymentData.id,
        "failed",
        failureReason,
        existingTransaction.id,
        paymentData,
        resellerId
      );
    }
  }

  const failureReason =
    paymentData.error_description ||
    paymentData.error_reason ||
    payload.payload?.error?.description ||
    "Payment failed";

  const amountInRupees = (paymentData.amount || 0) / 100;

  // Extract customer_id from multiple possible locations
  let customerId = paymentData.notes?.customer_id || null;

  // If not in notes, try to find by email
  if (!customerId) {
    const customerEmail =
      paymentData.email ||
      paymentData.notes?.email ||
      paymentData.notes?.customer_email;
    if (customerEmail) {
      const customer = await findCustomerByEmail(customerEmail, resellerId);
      if (customer) {
        customerId = customer.id;
      }
    }
  }

  console.log(
    `[processPaymentFailed] Customer: ${customerId}, Amount: ${amountInRupees}`
  );

  // Try to find and UPDATE the pending transaction
  let pendingTransaction = null;
  if (customerId) {
    pendingTransaction = await findPendingTransaction(
      customerId,
      amountInRupees,
      resellerId
    );
    if (pendingTransaction) {
      console.log(
        `[UPDATE] Found pending transaction ${pendingTransaction.transaction_number}, updating with failure details`
      );
      const updateResult = await updatePendingTransactionWithPayment(
        pendingTransaction.id,
        { ...paymentData, error_description: failureReason },
        "failed"
      );

      if (updateResult.success) {
        return updateResult;
      } else {
        console.error(
          `[ERROR] Failed to update pending transaction, will create new one: ${updateResult.message}`
        );
      }
    }
  }

  // Final check before creating
  if (paymentData.id) {
    const finalCheck = await transactionExists(paymentData.id);
    if (finalCheck) {
      console.log(`[RACE CONDITION] Transaction just created, skipping`);
      return {
        success: true,
        data: finalCheck,
        message: "Transaction created by concurrent webhook",
      };
    }
  }

  // Create new transaction only if no pending transaction found
  console.log(`[CREATE] Creating new transaction for ${paymentData.id}`);
  return await createTransactionFromWebhook(resellerId, {
    ...paymentData,
    status: "failed",
    error_description: failureReason,
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
    return {
      success: false,
      message: "Invalid refund data in webhook payload",
    };
  }

  // Update the original transaction status to refunded
  return await updateTransactionStatus(
    paymentId,
    "refunded",
    `Refund ID: ${refundData.id}`
  );
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
    return { success: false, message: "Invalid order data in webhook payload" };
  }

  // If payment data exists, process as captured payment
  // NOTE: order.paid and payment.captured can fire for the same payment
  // So we MUST check if transaction already exists first
  if (paymentData) {
    console.log(`[processOrderPaid] Processing payment ${paymentData.id}`);

    // Check if transaction already exists by payment ID FIRST
    if (paymentData.id) {
      const existingTransaction = await transactionExists(paymentData.id);
      if (existingTransaction) {
        console.log(
          `[DUPLICATE] Transaction exists for ${paymentData.id}, skipping`
        );
        return {
          success: true,
          data: existingTransaction,
          message: "Transaction already exists",
        };
      }
    }

    const amountInRupees = (paymentData.amount || 0) / 100;

    // Extract customer_id from multiple possible locations
    let customerId = paymentData.notes?.customer_id || null;

    // If not in notes, try to find by email
    if (!customerId) {
      const customerEmail =
        paymentData.email ||
        paymentData.notes?.email ||
        paymentData.notes?.customer_email;
      if (customerEmail) {
        const customer = await findCustomerByEmail(customerEmail, resellerId);
        if (customer) {
          customerId = customer.id;
        }
      }
    }

    console.log(
      `[processOrderPaid] Customer: ${customerId}, Amount: ${amountInRupees}`
    );

    // Try to find and UPDATE the pending transaction
    let pendingTransaction = null;
    if (customerId) {
      pendingTransaction = await findPendingTransaction(
        customerId,
        amountInRupees,
        resellerId
      );
      if (pendingTransaction) {
        console.log(
          `[UPDATE] Found pending transaction ${pendingTransaction.transaction_number}, updating with payment details`
        );
        const updateResult = await updatePendingTransactionWithPayment(
          pendingTransaction.id,
          { ...paymentData, order_id: orderData?.id },
          "captured"
        );

        if (updateResult.success) {
          // Update customer status to active after successful payment
          await updateCustomerStatusAfterPayment(customerId, resellerId);
          return updateResult;
        } else {
          console.error(
            `[ERROR] Failed to update pending transaction, will create new one: ${updateResult.message}`
          );
        }
      }
    }

    // Final check before creating
    if (paymentData.id) {
      const finalCheck = await transactionExists(paymentData.id);
      if (finalCheck) {
        console.log(`[RACE CONDITION] Transaction just created, skipping`);
        return {
          success: true,
          data: finalCheck,
          message: "Transaction created by concurrent webhook",
        };
      }
    }

    console.log(
      `[CREATE] Creating new transaction for ${paymentData.id} (order.paid)`
    );
    return await createTransactionFromWebhook(resellerId, {
      ...paymentData,
      order_id: orderData?.id,
      status: "captured",
    });
  }

  return { success: true, message: "Order paid event processed" };
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
    return {
      success: false,
      message: "Invalid subscription payment data in webhook payload",
    };
  }

  console.log(
    `[processSubscriptionCharged] Processing payment ${paymentData.id}`
  );

  // Check if transaction already exists by payment ID FIRST
  if (paymentData.id) {
    const existingTransaction = await transactionExists(paymentData.id);
    if (existingTransaction) {
      console.log(
        `[DUPLICATE] Transaction exists for ${paymentData.id}, skipping`
      );
      return {
        success: true,
        data: existingTransaction,
        message: "Transaction already exists",
      };
    }
  }

  const amountInRupees = (paymentData.amount || 0) / 100;

  // Extract customer_id from multiple possible locations
  let customerId = paymentData.notes?.customer_id || null;

  // If not in notes, try to find by email
  if (!customerId) {
    const customerEmail =
      paymentData.email ||
      paymentData.notes?.email ||
      paymentData.notes?.customer_email;
    if (customerEmail) {
      const customer = await findCustomerByEmail(customerEmail, resellerId);
      if (customer) {
        customerId = customer.id;
      }
    }
  }

  console.log(
    `[processSubscriptionCharged] Customer: ${customerId}, Amount: ${amountInRupees}`
  );

  // Try to find and UPDATE the pending transaction
  let pendingTransaction = null;
  if (customerId) {
    pendingTransaction = await findPendingTransaction(
      customerId,
      amountInRupees,
      resellerId
    );
    if (pendingTransaction) {
      console.log(
        `[UPDATE] Found pending transaction ${pendingTransaction.transaction_number}, updating with payment details`
      );
      const updateResult = await updatePendingTransactionWithPayment(
        pendingTransaction.id,
        {
          ...paymentData,
          notes: {
            ...paymentData.notes,
            subscription_id: subscriptionData?.id,
            subscription_status: subscriptionData?.status,
          },
        },
        "captured"
      );

      if (updateResult.success) {
        // Update customer status to active after successful payment
        await updateCustomerStatusAfterPayment(customerId, resellerId);
        return updateResult;
      } else {
        console.error(
          `[ERROR] Failed to update pending transaction, will create new one: ${updateResult.message}`
        );
      }
    }
  }

  // Final check before creating
  if (paymentData.id) {
    const finalCheck = await transactionExists(paymentData.id);
    if (finalCheck) {
      console.log(`[RACE CONDITION] Transaction just created, skipping`);
      return {
        success: true,
        data: finalCheck,
        message: "Transaction created by concurrent webhook",
      };
    }
  }

  // Create new transaction with subscription info only if no pending transaction found
  console.log(`[CREATE] Creating new transaction for ${paymentData.id}`);
  return await createTransactionFromWebhook(resellerId, {
    ...paymentData,
    status: "captured",
    notes: {
      ...paymentData.notes,
      subscription_id: subscriptionData?.id,
      subscription_status: subscriptionData?.status,
    },
  });
}

/**
 * Get all transactions for super admin dashboard
 * @param {object} options - Query options
 * @returns {Promise<object>}
 */
export async function getAllTransactions(options = {}) {
  const client = getHasuraClient();
  const {
    limit = 100,
    offset = 0,
    status,
    resellerId,
    startDate,
    endDate,
  } = options;

  let whereClause = "";
  const conditions = [];

  // Helper function to check if value is valid (not undefined, null, empty, or string "undefined")
  const isValidValue = (val) =>
    val && val !== "all" && val !== "undefined" && val !== "";

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
  let transactionWhereArg = "";
  let aggregateWhereArg = "";

  if (conditions.length > 0) {
    whereClause = `where: { ${conditions.join(", ")} }`;
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

    const successfulTransactions = transactions.filter(
      (t) => t.status === "success" || t.status === "captured"
    );
    const failedTransactions = transactions.filter(
      (t) => t.status === "failed"
    );

    return {
      success: true,
      data: {
        transactions,
        summary: {
          total_transactions: aggregate.count || 0,
          total_amount: aggregate.sum?.amount || 0,
          total_amount_formatted: `₹${(aggregate.sum?.amount || 0).toFixed(2)}`,
          successful_count: successfulTransactions.length,
          failed_count: failedTransactions.length,
        },
      },
    };
  } catch (error) {
    console.error("Error fetching all transactions:", error);
    return {
      success: false,
      message: error.message || "Failed to fetch transactions",
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
        where: { created_at: { _gte: "${
          new Date().toISOString().split("T")[0]
        }" } }
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
        active_resellers: result.resellers_with_transactions?.length || 0,
      },
    };
  } catch (error) {
    console.error("Error fetching transaction stats:", error);
    return {
      success: false,
      message: error.message || "Failed to fetch transaction statistics",
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

/**
 * Cleanup duplicate transactions for a customer
 * Finds duplicate transactions (pending + successful for same customer/amount)
 * and removes the pending ones, keeping only the successful transaction
 * @param {string} customerId - Customer UUID
 * @param {string} resellerId - Reseller UUID
 * @returns {Promise<object>}
 */
export async function cleanupDuplicateTransactions(customerId, resellerId) {
  if (!customerId || !resellerId) {
    return {
      success: false,
      message: "Customer ID and Reseller ID are required",
    };
  }

  const client = getHasuraClient();

  // Find all transactions for this customer
  const query = `
    query FindCustomerTransactions($customer_id: uuid!, $reseller_id: uuid!) {
      mst_transaction(
        where: {
          customer_id: { _eq: $customer_id }
          reseller_id: { _eq: $reseller_id }
          transaction_type: { _eq: "payment" }
        }
        order_by: { created_at: asc }
      ) {
        id
        transaction_number
        status
        amount
        razorpay_payment_id
        created_at
        updated_at
      }
    }
  `;

  try {
    const result = await client.client.request(query, {
      customer_id: customerId,
      reseller_id: resellerId,
    });

    const transactions = result.mst_transaction || [];

    if (transactions.length <= 1) {
      console.log(
        `[cleanupDuplicates] No duplicates found for customer ${customerId}`
      );
      return {
        success: true,
        message: "No duplicate transactions found",
        deleted_count: 0,
      };
    }

    // Group transactions by amount to find duplicates
    const transactionsByAmount = {};
    transactions.forEach((txn) => {
      const amountKey = Math.round(txn.amount * 100) / 100; // Round to 2 decimals
      if (!transactionsByAmount[amountKey]) {
        transactionsByAmount[amountKey] = [];
      }
      transactionsByAmount[amountKey].push(txn);
    });

    // Find duplicates: if there's a pending and a successful transaction with same amount
    const transactionsToDelete = [];

    Object.values(transactionsByAmount).forEach((group) => {
      if (group.length > 1) {
        const pendingTxns = group.filter((t) => t.status === "pending");
        const successfulTxns = group.filter(
          (t) =>
            t.status === "success" ||
            t.status === "authorized" ||
            t.status === "captured"
        );

        // If we have both pending and successful transactions, delete the pending ones
        if (pendingTxns.length > 0 && successfulTxns.length > 0) {
          console.log(
            `[cleanupDuplicates] Found ${pendingTxns.length} pending + ${successfulTxns.length} successful transactions for amount ${group[0].amount}`
          );
          transactionsToDelete.push(...pendingTxns);
        }
        // If we have multiple pending transactions (edge case), keep the newest one
        else if (pendingTxns.length > 1) {
          const sorted = pendingTxns.sort(
            (a, b) => new Date(b.created_at) - new Date(a.created_at)
          );
          transactionsToDelete.push(...sorted.slice(1)); // Delete all but the newest
        }
        // If we have multiple successful transactions with same razorpay_payment_id (shouldn't happen)
        else if (successfulTxns.length > 1) {
          // Group by razorpay_payment_id
          const byPaymentId = {};
          successfulTxns.forEach((txn) => {
            const key = txn.razorpay_payment_id || "no_payment_id";
            if (!byPaymentId[key]) byPaymentId[key] = [];
            byPaymentId[key].push(txn);
          });

          // If multiple transactions for same payment, keep only the oldest
          Object.values(byPaymentId).forEach((dupGroup) => {
            if (dupGroup.length > 1) {
              const sorted = dupGroup.sort(
                (a, b) => new Date(a.created_at) - new Date(b.created_at)
              );
              transactionsToDelete.push(...sorted.slice(1)); // Delete all but the oldest
            }
          });
        }
      }
    });

    if (transactionsToDelete.length === 0) {
      console.log(`[cleanupDuplicates] No duplicate transactions to delete`);
      return {
        success: true,
        message: "No duplicate transactions to cleanup",
        deleted_count: 0,
      };
    }

    // Delete duplicate transactions
    const deleteMutation = `
      mutation DeleteDuplicateTransactions($ids: [uuid!]!) {
        delete_mst_transaction(where: { id: { _in: $ids } }) {
          affected_rows
        }
      }
    `;

    const idsToDelete = transactionsToDelete.map((t) => t.id);
    const deleteResult = await client.client.request(deleteMutation, {
      ids: idsToDelete,
    });

    console.log(
      `[cleanupDuplicates] Deleted ${deleteResult.delete_mst_transaction.affected_rows} duplicate transaction(s)`
    );

    return {
      success: true,
      message: `Cleaned up ${deleteResult.delete_mst_transaction.affected_rows} duplicate transaction(s)`,
      deleted_count: deleteResult.delete_mst_transaction.affected_rows,
      deleted_transactions: transactionsToDelete.map((t) => ({
        id: t.id,
        transaction_number: t.transaction_number,
        status: t.status,
      })),
    };
  } catch (error) {
    console.error("[cleanupDuplicates] Error:", error);
    return {
      success: false,
      message: error.message || "Failed to cleanup duplicate transactions",
    };
  }
}
