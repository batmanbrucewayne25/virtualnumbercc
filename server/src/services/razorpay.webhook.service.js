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
export async function transactionExists(razorpayPaymentId, orderId = null) {
  if (!razorpayPaymentId && !orderId) return null;

  const client = getHasuraClient();

  // First try by payment_id (most specific)
  if (razorpayPaymentId) {
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
          razorpay_order_id
          amount
          reseller_id
          virtual_number_id
          notes
        }
      }
    `;
    try {
      const result = await client.client.request(query, { razorpay_payment_id: razorpayPaymentId });
      if (result.mst_transaction?.length > 0) return result.mst_transaction[0];
    } catch (error) {
      console.error("Error checking transaction existence by payment_id:", error);
    }
  }

  // Fallback: try by order_id (catches race where payment_id not yet written)
  if (orderId) {
    const orderQuery = `
      query CheckTransactionExistsByOrder($razorpay_order_id: String!) {
        mst_transaction(
          where: {
            razorpay_order_id: { _eq: $razorpay_order_id }
            status: { _in: ["success", "authorized", "captured"] }
          }
          order_by: { created_at: desc }
          limit: 1
        ) {
          id
          transaction_number
          customer_id
          status
          razorpay_payment_id
          razorpay_order_id
          amount
          reseller_id
          virtual_number_id
          notes
        }
      }
    `;
    try {
      const result = await client.client.request(orderQuery, { razorpay_order_id: orderId });
      if (result.mst_transaction?.length > 0) {
        console.log(`[transactionExists] Found by order_id=${orderId}: ${result.mst_transaction[0].id}`);
        return result.mst_transaction[0];
      }
    } catch (error) {
      console.error("Error checking transaction existence by order_id:", error);
    }
  }

  return null;
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
 * Find existing pending transaction by customer_id and amount.
 *
 * MATCHING STRATEGY (in priority order):
 *   1. By razorpay_order_id  — most reliable for order-based flows
 *   2. By customer_id with razorpay_payment_id IS NULL — for payment-link flows
 *      where the pending record was created before any Razorpay ID was known
 *   3. By customer_email column with razorpay_payment_id IS NULL — for STATIC
 *      payment links where Razorpay's notes has no customer_id embedded
 *   4. By customer_id alone (no amount filter) — fallback for amount mismatch
 *
 * NOTE: paymentId parameter is accepted but intentionally NOT used as a filter
 * for finding pending transactions. It is used only as a safeguard to skip the
 * lookup if a transaction with that payment_id already exists (handled by callers).
 *
 * @param {string|null} customerId    - Customer UUID
 * @param {number}      amount        - Payment amount in rupees
 * @param {string}      resellerId    - Reseller UUID
 * @param {string|null} orderId       - Razorpay order_id (if order-based flow)
 * @param {string|null} paymentId     - Razorpay payment_id (unused for filtering here)
 * @param {string|null} customerEmail - Customer email (fallback for static link flow)
 * @returns {Promise<object|null>}
 */
export async function findPendingTransaction(
  customerId,
  amount,
  resellerId,
  orderId = null,
  paymentId = null, // kept for API compat; not used as DB filter
  customerEmail = null
) {
  if ((!customerId && !orderId && !customerEmail) || !resellerId) {
    console.log(`[findPendingTransaction] Skipping — no customer/order/email identifier`);
    return null;
  }

  const client = getHasuraClient();
  // Use a generous tolerance to handle floating-point representation differences
  const amountTolerance = 1.0;
  const minAmount = amount ? amount - amountTolerance : null;
  const maxAmount = amount ? amount + amountTolerance : null;

  const baseWhere = {
    ...(amount ? { amount: { _gte: minAmount, _lte: maxAmount } } : {}),
    reseller_id: { _eq: resellerId },
    status: { _in: ["pending", "authorized"] },
  };

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
        customer_email
        amount
        status
        reseller_id
        razorpay_order_id
        razorpay_payment_id
        created_at
      }
    }
  `;

  // --- Attempt 1: match by order_id (most reliable for order-based flows) ---
  if (orderId) {
    try {
      const result = await client.client.request(query, {
        where: { ...baseWhere, razorpay_order_id: { _eq: orderId } },
      });
      if (result.mst_transaction?.length > 0) {
        console.log(
          `[findPendingTransaction] Found by order_id=${orderId}: ${result.mst_transaction[0].id}`
        );
        return result.mst_transaction[0];
      }
    } catch (error) {
      console.error("[findPendingTransaction] order_id lookup error:", error.message);
    }
  }

  // --- Attempt 2: match by customer_id where no payment_id yet ---
  // This is the critical path for Razorpay Payment Links:
  // The pending transaction was created with status="pending" and no payment_id.
  // We match it by customer + amount and claim it by writing the payment_id in.
  if (customerId) {
    try {
      const result = await client.client.request(query, {
        where: {
          ...baseWhere,
          customer_id: { _eq: customerId },
          razorpay_payment_id: { _is_null: true }, // only unclaimed pending records
        },
      });
      if (result.mst_transaction?.length > 0) {
        console.log(
          `[findPendingTransaction] Found by customer_id=${customerId}: ${result.mst_transaction[0].id}`
        );
        return result.mst_transaction[0];
      }
    } catch (error) {
      console.error("[findPendingTransaction] customer_id lookup error:", error.message);
    }
  }

  // --- Attempt 3: match by customer_email column (STATIC PAYMENT LINK path) ---
  // When a static payment link is used, Razorpay's notes has no customer_id.
  // But approveCustomer() stores customer_email on the pending transaction.
  // We match by email so we can still claim the pending record.
  if (customerEmail) {
    try {
      const result = await client.client.request(query, {
        where: {
          ...baseWhere,
          customer_email: { _eq: customerEmail },
          razorpay_payment_id: { _is_null: true },
        },
      });
      if (result.mst_transaction?.length > 0) {
        console.log(
          `[findPendingTransaction] Found by customer_email=${customerEmail}: ${result.mst_transaction[0].id}`
        );
        return result.mst_transaction[0];
      }
    } catch (error) {
      console.error("[findPendingTransaction] customer_email lookup error:", error.message);
    }
  }

  // --- Attempt 4: match by customer_id only (no amount filter) — amount mismatch fallback ---
  if (customerId) {
    try {
      const result = await client.client.request(query, {
        where: {
          reseller_id: { _eq: resellerId },
          status: { _in: ["pending", "authorized"] },
          customer_id: { _eq: customerId },
          razorpay_payment_id: { _is_null: true },
        },
      });
      if (result.mst_transaction?.length > 0) {
        console.log(
          `[findPendingTransaction] Found by customer_id (no amount filter)=${customerId}: ${result.mst_transaction[0].id} (amount=${result.mst_transaction[0].amount} vs expected=${amount})`
        );
        return result.mst_transaction[0];
      }
    } catch (error) {
      console.error("[findPendingTransaction] customer_id-only lookup error:", error.message);
    }
  }

  // --- Attempt 5: match by customer_id WITHOUT payment_id IS NULL filter ---
  // Covers the case where payment.authorized fired first and already set razorpay_payment_id
  // on the pending transaction. All previous attempts require payment_id IS NULL, so they miss it.
  // This attempt finds it even when payment_id is already populated.
  if (customerId) {
    try {
      const noPaymentIdFilter = `
        query FindPendingTransactionNoPaymentIdFilter(
          $reseller_id: uuid!
          $customer_id: uuid!
        ) {
          mst_transaction(
            where: {
              reseller_id: { _eq: $reseller_id }
              status: { _in: ["pending", "authorized"] }
              customer_id: { _eq: $customer_id }
            }
            order_by: { created_at: desc }
            limit: 1
          ) {
            id
            transaction_number
            customer_id
            customer_email
            amount
            status
            reseller_id
            razorpay_order_id
            razorpay_payment_id
            created_at
          }
        }
      `;
      const result = await client.client.request(noPaymentIdFilter, {
        reseller_id: resellerId,
        customer_id: customerId,
      });
      if (result.mst_transaction?.length > 0) {
        console.log(
          `[findPendingTransaction] Found by customer_id (no payment_id filter, authorized-first path)=${customerId}: ${result.mst_transaction[0].id} status=${result.mst_transaction[0].status} payment_id=${result.mst_transaction[0].razorpay_payment_id}`
        );
        return result.mst_transaction[0];
      }
    } catch (error) {
      console.error("[findPendingTransaction] customer_id no-payment-id-filter lookup error:", error.message);
    }
  }

  console.log(
    `[findPendingTransaction] No pending transaction found for customer=${customerId} email=${customerEmail} amount=${amount} reseller=${resellerId}`
  );
  return null;
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

  // Use update_mst_transaction with a where clause to prevent downgrading a
  // "success" transaction to "authorized" in a race between concurrent webhooks.
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
      update_mst_transaction(
        where: {
          id: { _eq: $transaction_id }
          status: { _nin: ["success", "refunded"] }
        }
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
        returning {
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

    const updated = result?.update_mst_transaction?.returning?.[0];
    if (updated) {
      console.log(
        `[updatePendingTransaction] Successfully updated transaction ${transactionId} to ${mappedStatus}`
      );
      return {
        success: true,
        data: updated,
      };
    }

    // 0 rows updated = the transaction was already at success/refunded (status guard fired)
    console.warn(
      `[updatePendingTransaction] Transaction ${transactionId} not updated — already at terminal status (success/refunded)`
    );
    return {
      success: false,
      message: "Transaction already at terminal status — update skipped",
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

  // CRITICAL: The webhook URL reseller_id may differ from the reseller who actually
  // created the payment link (notes.reseller_id). Always prefer notes.reseller_id
  // because the transaction FK must point to the reseller that exists in mst_reseller.
  const effectiveResellerId = paymentData.notes?.reseller_id || resellerId;
  if (effectiveResellerId !== resellerId) {
    console.log(`[createTransactionFromWebhook] Using notes.reseller_id=${effectiveResellerId} instead of webhook URL reseller_id=${resellerId}`);
  }

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

  // Declare customerEmail at function scope so it's accessible throughout
  const customerEmail =
    paymentData.email ||
    paymentData.notes?.email ||
    paymentData.notes?.customer_email ||
    null;

  // Fallback: Find by email using effective reseller id
  if (!customerId && customerEmail) {
    const customer = await findCustomerByEmail(customerEmail, effectiveResellerId);
    if (customer) {
      customerId = customer.id;
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
      const customer = await findCustomerByEmail(customerEmail, effectiveResellerId);
      if (customer) {
        customerName = customer.profile_name || customer.email;
      }
    }

    console.log(`[createTransactionFromWebhook] Inserting transaction reseller_id=${effectiveResellerId} customer_id=${customerId} status=${status}`);

    const result = await client.client.request(mutation, {
      transaction_number: transactionNumber,
      reseller_id: effectiveResellerId,
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
      const newTxnId = result.insert_mst_transaction_one.id;
      // Trigger full post-payment flow (virtual number + customer activation + email)
      if (customerId && (status === "success" || status === "authorized")) {
        await updateCustomerStatusAfterPayment(customerId, effectiveResellerId, newTxnId);
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
 * Complete post-payment flow after a successful Razorpay webhook:
 *   1. Check if customer already has a virtual number (idempotency)
 *   2. If not, generate + persist a virtual number
 *   3. Link the virtual number to the transaction record
 *   4. Update customer status → active / kyc_status → verified / approval → approved
 *   5. Send virtual-number email via reseller SMTP (best-effort, never throws)
 *
 * This function is idempotent: calling it twice for the same customer is safe.
 *
 * @param {string} customerId  - Customer UUID
 * @param {string} resellerId  - Reseller UUID
 * @param {string} transactionId - Transaction UUID (to link virtual number)
 * @returns {Promise<boolean>} true on full success
 */

/**
 * Extend virtual number expiry by N days (for renewal payments).
 * Non-fatal — logs and returns on failure.
 */
async function _extendVirtualNumberExpiry(client, virtualNumberId, daysToAdd) {
  try {
    const getQuery = `
      query GetVNExpiry($id: uuid!) {
        mst_virtual_number_by_pk(id: $id) {
          id
          expiry_date
        }
      }
    `;
    const vnResult = await client.client.request(getQuery, { id: virtualNumberId });
    const vn = vnResult?.mst_virtual_number_by_pk;
    if (!vn || !vn.expiry_date) {
      console.warn(`[postPayment][renewal] VN ${virtualNumberId} not found or no expiry_date`);
      return;
    }
    const currentExpiry = new Date(vn.expiry_date);
    const newExpiry = new Date(currentExpiry);
    newExpiry.setDate(newExpiry.getDate() + daysToAdd);
    const newExpiryStr = newExpiry.toISOString().split("T")[0];

    const updateMutation = `
      mutation ExtendVNExpiry($id: uuid!, $expiry_date: date!) {
        update_mst_virtual_number_by_pk(
          pk_columns: { id: $id }
          _set: { expiry_date: $expiry_date }
        ) {
          id
          expiry_date
        }
      }
    `;
    await client.client.request(updateMutation, {
      id: virtualNumberId,
      expiry_date: newExpiryStr,
    });
    console.log(
      `[postPayment][renewal] Extended VN ${virtualNumberId} expiry: ${vn.expiry_date} -> ${newExpiryStr} (+${daysToAdd} days)`
    );
  } catch (err) {
    console.error(`[postPayment][renewal] Failed to extend VN expiry:`, err);
  }
}

/**
 * Debit the reseller wallet by price_per_number for an online payment.
 * Has its own idempotency: if mst_wallet_transaction already has a row with
 * reference=transactionId, the debit is skipped (prevents double-charging on
 * webhook retries or re-entrant calls from idempotency guards).
 * Non-fatal — logs CRITICAL on failure but never throws.
 */
async function _debitResellerWalletForOnlinePayment(client, customer, resellerId, transactionId, virtualNumberId = null) {
  console.log(`[postPayment][walletDebit] --- START ---`);
  console.log(`[postPayment][walletDebit] resellerId param=${resellerId}`);
  console.log(`[postPayment][walletDebit] transactionId=${transactionId}`);
  console.log(`[postPayment][walletDebit] reseller from DB=`, JSON.stringify(customer?.mst_reseller));

  try {
    const reseller = customer?.mst_reseller;
    const pricePerNumber = Number(parseFloat(String(reseller?.price_per_number ?? ""))) || 0;
    const effectiveResellerId = resellerId || reseller?.id;

    console.log(`[postPayment][walletDebit] effectiveResellerId=${effectiveResellerId}, pricePerNumber=${pricePerNumber}`);

    if (!effectiveResellerId) {
      console.error(`[postPayment][walletDebit] CRITICAL: No reseller_id available — wallet not debited`);
      return;
    }
    if (pricePerNumber <= 0) {
      console.error(`[postPayment][walletDebit] CRITICAL: price_per_number is 0 or not set on mst_reseller for reseller ${effectiveResellerId} — wallet not debited. Set price_per_number in DB.`);
      return;
    }

    // Idempotency: check if this transactionId was already debited
    if (transactionId) {
      const idempotencyQuery = `
        query CheckWalletTxnExists($reference: String!) {
          mst_wallet_transaction(where: { reference: { _eq: $reference } }, limit: 1) {
            id
          }
        }
      `;
      const idempotencyResult = await client.client.request(idempotencyQuery, { reference: transactionId });
      if (idempotencyResult?.mst_wallet_transaction?.length > 0) {
        console.log(`[postPayment][walletDebit] Already debited for transactionId=${transactionId} (mst_wallet_transaction.id=${idempotencyResult.mst_wallet_transaction[0].id}) — skipping`);
        return "already_debited";
      }
    }

    // Fetch wallet from mst_wallet table
    console.log(`[postPayment][walletDebit] Fetching mst_wallet for reseller_id=${effectiveResellerId}`);
    const walletQuery = `
      query GetResellerWalletForDebit($reseller_id: uuid!) {
        mst_wallet(where: { reseller_id: { _eq: $reseller_id } }, limit: 1) {
          id
          balance
          debit_amount
        }
      }
    `;
    const walletData = await client.client.request(walletQuery, { reseller_id: effectiveResellerId });
    const wallet = walletData?.mst_wallet?.[0];

    console.log(`[postPayment][walletDebit] mst_wallet rows returned=`, JSON.stringify(walletData?.mst_wallet));

    if (!wallet) {
      console.error(`[postPayment][walletDebit] CRITICAL: No row in mst_wallet for reseller_id=${effectiveResellerId} — wallet not debited`);
      return;
    }

    const balanceBefore = Number(String(wallet.balance).replace(/,/g, "")) || 0;
    const existingDebitAmount = Number(wallet.debit_amount) || 0;

    console.log(`[postPayment][walletDebit] wallet.id=${wallet.id}, balanceBefore=${balanceBefore}, pricePerNumber=${pricePerNumber}`);

    if (balanceBefore < pricePerNumber) {
      console.error(
        `[postPayment][walletDebit] CRITICAL: Insufficient balance for reseller ${effectiveResellerId}. ` +
        `Required: ₹${pricePerNumber.toFixed(2)}, Available: ₹${balanceBefore.toFixed(2)} — manual reconciliation required.`
      );
      return;
    }

    const balanceAfter = balanceBefore - pricePerNumber;
    console.log(`[postPayment][walletDebit] balanceAfter=${balanceAfter}`);

    // Step A: Insert audit record into mst_wallet_transaction
    console.log(`[postPayment][walletDebit] Inserting into mst_wallet_transaction...`);
    const insertWalletTxnMutation = `
      mutation CreateWalletTxnOnlinePayment(
        $wallet_id: uuid!
        $amount: numeric!
        $balance_before: numeric!
        $balance_after: numeric!
        $description: String
        $reference: String
        $customer_id: uuid
        $virtual_number_id: uuid
      ) {
        insert_mst_wallet_transaction_one(object: {
          wallet_id: $wallet_id
          transaction_type: "DEBIT"
          amount: $amount
          balance_before: $balance_before
          balance_after: $balance_after
          description: $description
          reference: $reference
          customer_id: $customer_id
          virtual_number_id: $virtual_number_id
        }) {
          id
        }
      }
    `;
    const walletTxnResult = await client.client.request(insertWalletTxnMutation, {
      wallet_id: wallet.id,
      amount: pricePerNumber,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      description: `Customer online payment - virtual number assigned`,
      reference: transactionId || null,
      customer_id: customer?.id || null,
      virtual_number_id: virtualNumberId || null,
    });
    console.log(`[postPayment][walletDebit] mst_wallet_transaction insert result=`, JSON.stringify(walletTxnResult));

    // Step B: Update mst_wallet balance
    console.log(`[postPayment][walletDebit] Updating mst_wallet (id=${wallet.id}) balance to ${balanceAfter}`);
    const updateWalletMutation = `
      mutation UpdateWalletOnlinePayment(
        $id: uuid!
        $balance: numeric!
        $debit_amount: numeric!
        $last_transaction_at: timestamp!
      ) {
        update_mst_wallet_by_pk(
          pk_columns: { id: $id }
          _set: {
            balance: $balance
            debit_amount: $debit_amount
            last_transaction_at: $last_transaction_at
          }
        ) {
          id
          balance
        }
      }
    `;
    const updateWalletResult = await client.client.request(updateWalletMutation, {
      id: wallet.id,
      balance: balanceAfter,
      debit_amount: existingDebitAmount + pricePerNumber,
      last_transaction_at: new Date().toISOString(),
    });
    console.log(`[postPayment][walletDebit] mst_wallet update result=`, JSON.stringify(updateWalletResult));

    console.log(
      `[postPayment][walletDebit] SUCCESS: Debited ₹${pricePerNumber.toFixed(2)} from reseller ${effectiveResellerId}. ` +
      `mst_wallet.balance: ₹${balanceBefore.toFixed(2)} → ₹${balanceAfter.toFixed(2)}`
    );
  } catch (walletErr) {
    console.error(`[postPayment][walletDebit] CRITICAL: Exception during wallet deduction:`, walletErr);
  }
  console.log(`[postPayment][walletDebit] --- END ---`);
}

async function updateCustomerStatusAfterPayment(customerId, resellerId, transactionId = null) {
  console.log(`[postPayment] CALLED — customerId=${customerId} resellerId=${resellerId} transactionId=${transactionId}`);

  if (!customerId) {
    console.warn("[postPayment] customerId is null — cannot complete post-payment flow");
    return false;
  }

  const client = getHasuraClient();

  try {
    // ── 1. Fetch customer details + transaction state ─────────────────────────
    const customerQuery = `
      query GetCustomerForPayment($id: uuid!, $txn_id: uuid) {
        mst_customer_by_pk(id: $id) {
          id
          email
          phone
          profile_name
          status
          mst_reseller {
            id
            email
            first_name
            last_name
            business_name
            brand_name
            price_per_number
          }
          mst_virtual_numbers(limit: 1, order_by: { created_at: desc }) {
            id
            virtual_number
            status
          }
        }
        mst_transaction(where: { id: { _eq: $txn_id } }, limit: 1) {
          id
          virtual_number_id
          status
          notes
        }
      }
    `;
    const customerResult = await client.client.request(customerQuery, {
      id: customerId,
      txn_id: transactionId || "00000000-0000-0000-0000-000000000000",
    });
    const customer = customerResult?.mst_customer_by_pk;
    if (!customer) {
      console.error(`[postPayment] Customer ${customerId} not found`);
      return false;
    }

    console.log(`[postPayment] customer.status=${customer.status} existing_vn_count=${customer.mst_virtual_numbers?.length} reseller.price_per_number=${customer.mst_reseller?.price_per_number}`);

    // ── 2. Idempotency guards ─────────────────────────────────────────────────
    // Guard A: transaction already has a VN linked, or is already claimed/processing
    const txnRecord = customerResult?.mst_transaction?.[0];
    if (transactionId && (txnRecord?.virtual_number_id || txnRecord?.status === "processing_vn")) {
      const isRenewal = txnRecord?.notes?.transaction_type === "renewal";
      console.log(
        `[postPayment] Guard A hit — Transaction ${transactionId} already claimed (vn_id=${txnRecord.virtual_number_id}, status=${txnRecord.status}, renewal=${isRenewal}) — skipping VN creation, attempting wallet debit`
      );
      const guardAVnId = txnRecord?.virtual_number_id || txnRecord?.notes?.virtual_number_id || null;
      const debitResult = await _debitResellerWalletForOnlinePayment(client, customer, resellerId, transactionId, guardAVnId);
      // Extend expiry only for renewal AND only if wallet debit was new (not a retry)
      if (isRenewal && debitResult !== "already_debited") {
        const renewalVnId = txnRecord?.notes?.virtual_number_id || txnRecord?.virtual_number_id;
        if (renewalVnId) {
          await _extendVirtualNumberExpiry(client, renewalVnId, 360);
        }
      }
      return true;
    }

    // Guard B: customer already has a virtual number — skip regardless of status.
    // A customer should never receive a second VN even if their status was reset.
    const hasExistingVN = customer.mst_virtual_numbers?.length > 0;
    if (hasExistingVN) {
      const isRenewalB = txnRecord?.notes?.transaction_type === "renewal";
      console.log(
        `[postPayment] Guard B hit — Customer ${customerId} already has a virtual number (status=${customer.status}, renewal=${isRenewalB}) — skipping VN creation, but will attempt wallet debit`
      );
      // Still attempt wallet debit in case it didn't run yet
      const guardBVnId = customer.mst_virtual_numbers?.[0]?.id || txnRecord?.notes?.virtual_number_id || null;
      const debitResultB = await _debitResellerWalletForOnlinePayment(client, customer, resellerId, transactionId, guardBVnId);
      // Renewal flow: extend expiry only if wallet debit was new (not a retry)
      if (isRenewalB && transactionId && debitResultB !== "already_debited") {
        const renewalVnId = txnRecord?.notes?.virtual_number_id;
        if (renewalVnId) {
          await _extendVirtualNumberExpiry(client, renewalVnId, 360);
        }
      }
      return true;
    }

    // ── 3. Claim the transaction slot atomically BEFORE creating VN ──────────
    // Use a conditional UPDATE on mst_transaction as a DB-level mutex.
    // The condition: virtual_number_id IS NULL AND status != 'success'.
    // Only the FIRST concurrent postPayment call satisfies this — it sets
    // a sentinel value (status='processing') so every subsequent concurrent
    // call gets affected_rows=0 and bails out immediately.
    // This is race-safe because Postgres row-locks the transaction row on UPDATE.
    if (transactionId) {
      const claimTxnMutation = `
        mutation ClaimTransactionForVN($txn_id: uuid!) {
          update_mst_transaction(
            where: {
              id: { _eq: $txn_id }
              virtual_number_id: { _is_null: true }
              status: { _nin: ["processing_vn", "success"] }
            }
            _set: { status: "processing_vn" }
          ) {
            affected_rows
          }
        }
      `;
      const claimResult = await client.client.request(claimTxnMutation, {
        txn_id: transactionId,
      });

      if ((claimResult?.update_mst_transaction?.affected_rows ?? 0) === 0) {
        console.log(`[postPayment] Claim lost — transaction ${transactionId} already claimed by concurrent call — skipping VN creation, attempting wallet debit`);
        await _debitResellerWalletForOnlinePayment(client, customer, resellerId, transactionId, null);
        return true;
      }
      console.log(`[postPayment] Claim won on transaction ${transactionId} — proceeding with VN creation`);
    }

    // ── 4. Generate and insert virtual number ────────────────────────────────
    const randomDigits = Math.floor(1000000000 + Math.random() * 9000000000);
    const virtualNumber = `+91${randomDigits}`;
    const purchaseDate = new Date().toISOString().split("T")[0];
    const expiryDate = (() => {
      const d = new Date();
      d.setDate(d.getDate() + 360);
      return d.toISOString().split("T")[0];
    })();

    const createVnMutation = `
      mutation CreateVirtualNumber(
        $customer_id: uuid!
        $virtual_number: String!
        $reseller_id: uuid
        $purchase_date: date!
        $expiry_date: date!
        $call_forwarding_number: String
      ) {
        insert_mst_virtual_number_one(object: {
          customer_id: $customer_id
          virtual_number: $virtual_number
          reseller_id: $reseller_id
          status: "active"
          purchase_date: $purchase_date
          expiry_date: $expiry_date
          call_forwarding_number: $call_forwarding_number
        }) {
          id
          virtual_number
        }
      }
    `;
    const vnResult = await client.client.request(createVnMutation, {
      customer_id: customerId,
      virtual_number: virtualNumber,
      reseller_id: resellerId || null,
      purchase_date: purchaseDate,
      expiry_date: expiryDate,
      call_forwarding_number: customer.phone || null,
    });

    const vnRecord = vnResult?.insert_mst_virtual_number_one;
    if (!vnRecord) {
      throw new Error("insert_mst_virtual_number_one returned null");
    }
    console.log(`[postPayment] Virtual number ${virtualNumber} created for customer ${customerId}`);

    // ── 5. Debit reseller wallet by price_per_number ──────────────────────────
    await _debitResellerWalletForOnlinePayment(client, customer, resellerId, transactionId, vnRecord?.id || null);

    // ── 6. Link VN to transaction + restore status to success ────────────────
    if (transactionId && vnRecord.id) {
      try {
        const linkMutation = `
          mutation LinkVirtualNumberToTransaction($txn_id: uuid!, $vn_id: uuid!) {
            update_mst_transaction_by_pk(
              pk_columns: { id: $txn_id }
              _set: { virtual_number_id: $vn_id, status: "success" }
            ) { id }
          }
        `;
        await client.client.request(linkMutation, {
          txn_id: transactionId,
          vn_id: vnRecord.id,
        });
      } catch (linkErr) {
        console.warn(`[postPayment] Could not link virtual number to transaction: ${linkErr.message}`);
      }
    }

    // ── 7. Activate customer ──────────────────────────────────────────────────
    const statusMutation = `
      mutation ActivateCustomer($customer_id: uuid!) {
        update_mst_customer_by_pk(
          pk_columns: { id: $customer_id }
          _set: { status: "active", kyc_status: "verified", approval: "approved" }
        ) { id }
      }
    `;
    await client.client.request(statusMutation, { customer_id: customerId });
    console.log(`[postPayment] Customer ${customerId} activated`);

    // ── 7. Send virtual-number email (best-effort) ────────────────────────────
    try {
      const { sendVirtualNumberEmail } = await import("../../services/emailService.js");
      const { getResellerSmtpConfig } = await import("./smtpConfig.service.js");

      const reseller = customer.mst_reseller;
      const resellerName =
        reseller?.brand_name ||
        reseller?.business_name ||
        (reseller?.first_name ? `${reseller.first_name} ${reseller.last_name}` : null) ||
        reseller?.email ||
        "Your Provider";

      const smtpConfig = await getResellerSmtpConfig(resellerId);

      await sendVirtualNumberEmail(
        customer.email,
        customer.profile_name || customer.email,
        virtualNumber,
        resellerName,
        smtpConfig
      );

      console.log(`[postPayment] Virtual number email sent to ${customer.email}`);
    } catch (emailErr) {
      // Non-fatal: payment succeeded; log and move on
      console.error(`[postPayment] Failed to send virtual number email: ${emailErr.message}`);
    }

    return true;
  } catch (error) {
    console.error(`[postPayment] Error completing post-payment flow for customer ${customerId}:`, error.message);
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

  // Use notes.reseller_id as the authoritative reseller — the webhook URL reseller_id
  // may belong to a different (parent) account that forwards events.
  const effectiveResellerId = paymentData.notes?.reseller_id || resellerId;

  const orderId = paymentData.order_id || null;

  // Check if transaction already exists by payment ID or order ID.
  // payment.authorized and payment.captured fire concurrently — captured may have
  // already updated the pending transaction before authorized runs.
  const existingTransaction = await transactionExists(paymentData.id, orderId);
  if (existingTransaction) {
    console.log(`[processPaymentAuthorized] Transaction already exists (${existingTransaction.status}), skipping`);
    return {
      success: true,
      data: existingTransaction,
      message: "Transaction already exists",
    };
  }

  const amountInRupees = (paymentData.amount || 0) / 100;

  // Extract customer_id and email from multiple possible locations
  let customerId = paymentData.notes?.customer_id || null;
  const customerEmail =
    paymentData.email ||
    paymentData.notes?.email ||
    paymentData.notes?.customer_email ||
    null;

  // If not in notes, try to find by email
  if (!customerId && customerEmail) {
    const customer = await findCustomerByEmail(customerEmail, effectiveResellerId);
    if (customer) {
      customerId = customer.id;
    }
  }

  console.log(`[processPaymentAuthorized] effectiveReseller=${effectiveResellerId} customerId=${customerId} email=${customerEmail} amount=${amountInRupees}`);

  // Try to find and UPDATE the pending transaction (pass email for static link fallback)
  const pendingTransaction = await findPendingTransaction(
    customerId,
    amountInRupees,
    effectiveResellerId,
    orderId,
    paymentData.id,
    customerEmail
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
      // NOTE: do NOT trigger postPayment here — payment.authorized means the bank
      // has authorised but money is not yet settled. postPayment runs only on
      // payment.captured (the authoritative settled-payment event).
      return updateResult;
    }

    // update failed because transaction reached success/refunded concurrently — that's fine
    console.log(`[processPaymentAuthorized] Update skipped (terminal status) — payment.captured already handled it`);
    return { success: true, message: "Transaction already processed by payment.captured" };
  }

  // No pending transaction found — payment.captured likely already processed this payment.
  // Do NOT create a new transaction from authorized event; it would be a duplicate.
  console.log(`[processPaymentAuthorized] No pending transaction found — payment.captured likely already handled pay=${paymentData.id}, skipping creation`);
  return { success: true, message: "No pending transaction to update; payment.captured will handle it" };
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

  // Use notes.reseller_id as the authoritative reseller
  const effectiveResellerId = paymentData.notes?.reseller_id || resellerId;

  // Extract email early — needed across all steps for static payment link matching
  const earlyEmail =
    paymentData.email ||
    paymentData.notes?.email ||
    paymentData.notes?.customer_email ||
    null;

  console.log(
    `[processPaymentCaptured] Processing payment ${paymentData.id}, Event: ${eventId}, effectiveReseller: ${effectiveResellerId}, email: ${earlyEmail}, notes: ${JSON.stringify(paymentData.notes)}`
  );

  // ========================================
  // STEP 1: IDEMPOTENCY CHECK (Event-based)
  // ========================================
  if (eventId) {
    const alreadyProcessed = await isWebhookEventProcessed(eventId, effectiveResellerId);
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
  const step2OrderId = paymentData.order_id || null;
  if (paymentData.id || step2OrderId) {
    const existingTransaction = await transactionExists(paymentData.id, step2OrderId);
    if (existingTransaction) {
      console.log(`[processPaymentCaptured] STEP2 found existing txn=${existingTransaction.id} status=${existingTransaction.status} customer_id=${existingTransaction.customer_id}`);
      // If transaction exists but status is not "success", update it
      if (existingTransaction.status !== "success") {
        const updateResult = await updateTransactionStatus(
          paymentData.id,
          "captured",
          null,
          existingTransaction.id,
          paymentData,
          effectiveResellerId
        );

        // Resolve customer_id: from transaction or from email lookup
        let resolvedCustomerId = existingTransaction.customer_id;
        if (!resolvedCustomerId && earlyEmail) {
          const cust = await findCustomerByEmail(earlyEmail, effectiveResellerId);
          if (cust) resolvedCustomerId = cust.id;
        }

        // Trigger full post-payment flow (virtual number + activation + email)
        // For renewals: VN is pre-linked — postPayment still needed for wallet debit + expiry extension.
        // For initial payments: skip if VN already linked (guards against duplicate VN on retries).
        const isRenewalTxn = existingTransaction.notes?.transaction_type === "renewal";
        if (updateResult.success && resolvedCustomerId) {
          if (existingTransaction.virtual_number_id && !isRenewalTxn) {
            console.log(`[processPaymentCaptured] STEP2 VN already linked (vn_id=${existingTransaction.virtual_number_id}) — skipping postPayment (non-renewal retry)`);
          } else {
            await updateCustomerStatusAfterPayment(
              resolvedCustomerId,
              effectiveResellerId,
              existingTransaction.id
            );
          }
        } else if (updateResult.success && !resolvedCustomerId) {
          console.warn(`[processPaymentCaptured] STEP2 could not resolve customer_id — post-payment skipped`);
        }

        // Record event
        if (eventId && updateResult.success) {
          await recordWebhookEvent(
            eventId,
            effectiveResellerId,
            existingTransaction.id,
            payload
          );
        }

        return updateResult;
      }

      // Transaction already exists and is "success"
      // For renewals: VN is pre-linked but postPayment still needed for wallet debit + expiry extension.
      // For initial payments: skip postPayment if VN already linked (prevents duplicate VN on retries).
      const isRenewalSuccessTxn = existingTransaction.notes?.transaction_type === "renewal";
      if (!existingTransaction.virtual_number_id || isRenewalSuccessTxn) {
        const resolvedCustomerId =
          existingTransaction.customer_id ||
          (earlyEmail ? (await findCustomerByEmail(earlyEmail, effectiveResellerId))?.id : null);

        if (resolvedCustomerId) {
          if (!existingTransaction.virtual_number_id) {
            console.log(`[processPaymentCaptured] STEP2 txn is success but VN not linked yet — running postPayment`);
          } else {
            console.log(`[processPaymentCaptured] STEP2 txn is success, renewal with VN pre-linked — running postPayment for wallet debit + expiry`);
          }
          await updateCustomerStatusAfterPayment(resolvedCustomerId, effectiveResellerId, existingTransaction.id);
        }
      } else {
        console.log(`[processPaymentCaptured] STEP2 txn is success and VN already linked (vn_id=${existingTransaction.virtual_number_id}) — skipping postPayment (Razorpay retry)`);
      }

      if (eventId) {
        await recordWebhookEvent(
          eventId,
          effectiveResellerId,
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
  // STEP 3: EXTRACT CUSTOMER ID + EMAIL
  // ========================================
  const amountInRupees = (paymentData.amount || 0) / 100;
  let customerId = paymentData.notes?.customer_id || null;
  const orderId = paymentData.order_id || null;

  // Extract email regardless — needed for static payment link matching
  const customerEmail =
    paymentData.email ||
    paymentData.notes?.email ||
    paymentData.notes?.customer_email ||
    null;

  console.log(`[processPaymentCaptured] STEP3 effectiveReseller=${effectiveResellerId} customerId=${customerId} email=${customerEmail} amount=${amountInRupees} orderId=${orderId}`);

  // Fallback: Find customer UUID by email if not in notes
  if (!customerId && customerEmail) {
    const customer = await findCustomerByEmail(customerEmail, effectiveResellerId);
    if (customer) {
      customerId = customer.id;
      console.log(`[processPaymentCaptured] Resolved customerId=${customerId} from email`);
    }
  }

  // ========================================
  // STEP 4: UPDATE PENDING TRANSACTION
  // ========================================
  let result = null;
  let transactionId = null;

  // Try to find pending transaction by order_id, customer_id, or customer_email
  const pendingTransaction = await findPendingTransaction(
    customerId,
    amountInRupees,
    effectiveResellerId,
    orderId,
    paymentData.id,
    customerEmail
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

      // Trigger full post-payment flow (virtual number + customer activation + email)
      if (customerId) {
        await updateCustomerStatusAfterPayment(customerId, effectiveResellerId, pendingTransaction.id);
      }
    }
  }

  // ========================================
  // STEP 5: FINAL DUPLICATE CHECK & SKIP CREATE
  // ========================================
  // Also pass orderId — a concurrent webhook may have updated the pending tx
  // (setting razorpay_order_id) just before this check, but before payment_id was written.
  if (!result) {
    const finalCheck = await transactionExists(paymentData.id, orderId);
    if (finalCheck) {
      console.log(`[RACE CONDITION] Transaction created by concurrent webhook, returning it`);
      if (eventId) {
        await recordWebhookEvent(eventId, effectiveResellerId, finalCheck.id, payload);
      }
      // Ensure post-payment ran on the found transaction.
      // For renewals: VN is pre-linked but postPayment still needed for wallet debit + expiry extension.
      // For initial payments: skip if VN already linked (prevents duplicate VN).
      const isRenewalRaceTxn = finalCheck.notes?.transaction_type === "renewal";
      if (!finalCheck.virtual_number_id || isRenewalRaceTxn) {
        const resolvedCustomerId = finalCheck.customer_id ||
          (earlyEmail ? (await findCustomerByEmail(earlyEmail, effectiveResellerId))?.id : null);
        if (resolvedCustomerId) {
          await updateCustomerStatusAfterPayment(resolvedCustomerId, effectiveResellerId, finalCheck.id);
        }
      } else {
        console.log(`[processPaymentCaptured] STEP5 race-condition path — VN already linked (vn_id=${finalCheck.virtual_number_id}) — skipping postPayment (non-renewal retry)`);
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
    result = await createTransactionFromWebhook(effectiveResellerId, {
      ...paymentData,
      status: "captured",
    });
    transactionId = result.data?.id;
  }

  // ========================================
  // STEP 7: RECORD EVENT (Idempotency)
  // ========================================
  if (eventId && transactionId) {
    await recordWebhookEvent(eventId, effectiveResellerId, transactionId, payload);
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

  const effectiveResellerId = paymentData.notes?.reseller_id || resellerId;
  console.log(`[processPaymentFailed] Processing payment ${paymentData.id} effectiveReseller=${effectiveResellerId}`);

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
        effectiveResellerId
      );
    }
  }

  const failureReason =
    paymentData.error_description ||
    paymentData.error_reason ||
    payload.payload?.error?.description ||
    "Payment failed";

  const amountInRupees = (paymentData.amount || 0) / 100;

  // Extract customer_id and email from multiple possible locations
  let customerId = paymentData.notes?.customer_id || null;
  const customerEmail =
    paymentData.email ||
    paymentData.notes?.email ||
    paymentData.notes?.customer_email ||
    null;

  // If not in notes, try to find by email
  if (!customerId && customerEmail) {
    const customer = await findCustomerByEmail(customerEmail, effectiveResellerId);
    if (customer) {
      customerId = customer.id;
    }
  }

  console.log(
    `[processPaymentFailed] Customer: ${customerId}, Email: ${customerEmail}, Amount: ${amountInRupees}`
  );

  // Try to find and UPDATE the pending transaction (pass email for static link fallback)
  let pendingTransaction = null;
  if (customerId || customerEmail) {
    pendingTransaction = await findPendingTransaction(
      customerId,
      amountInRupees,
      effectiveResellerId,
      null,
      null,
      customerEmail
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
  return await createTransactionFromWebhook(effectiveResellerId, {
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

  // Use notes.reseller_id as the authoritative reseller
  const effectiveResellerId = paymentData?.notes?.reseller_id || orderData?.notes?.reseller_id || resellerId;

  // If payment data exists, process as captured payment
  if (paymentData) {
    console.log(`[processOrderPaid] Processing payment ${paymentData.id} effectiveReseller=${effectiveResellerId}`);

    // Check if transaction already exists by payment ID FIRST
    if (paymentData.id) {
      const existingTransaction = await transactionExists(paymentData.id);
      if (existingTransaction) {
        console.log(`[DUPLICATE] Transaction exists for ${paymentData.id}, skipping`);
        return {
          success: true,
          data: existingTransaction,
          message: "Transaction already exists",
        };
      }
    }

    const amountInRupees = (paymentData.amount || 0) / 100;
    let customerId = paymentData.notes?.customer_id || null;
    const customerEmail =
      paymentData.email ||
      paymentData.notes?.email ||
      paymentData.notes?.customer_email ||
      null;

    if (!customerId && customerEmail) {
      const customer = await findCustomerByEmail(customerEmail, effectiveResellerId);
      if (customer) customerId = customer.id;
    }

    console.log(`[processOrderPaid] Customer: ${customerId}, Amount: ${amountInRupees}`);

    // Try to find and UPDATE the pending transaction
    let pendingTransaction = null;
    if (customerId || customerEmail) {
      pendingTransaction = await findPendingTransaction(
        customerId,
        amountInRupees,
        effectiveResellerId,
        paymentData.order_id || null,
        null,
        customerEmail
      );
      if (pendingTransaction) {
        if (!customerId && pendingTransaction.customer_id) customerId = pendingTransaction.customer_id;
        console.log(`[UPDATE] Found pending transaction ${pendingTransaction.transaction_number}, updating`);
        const updateResult = await updatePendingTransactionWithPayment(
          pendingTransaction.id,
          { ...paymentData, order_id: orderData?.id },
          "captured"
        );

        if (updateResult.success) {
          // NOTE: do NOT trigger postPayment here — order.paid fires concurrently with
          // payment.captured. postPayment runs only on payment.captured to avoid
          // duplicate virtual number creation and emails.
          return updateResult;
        } else {
          console.error(`[ERROR] Failed to update pending transaction: ${updateResult.message}`);
        }
      }
    }

    // Final check before creating — also check by order_id for timing races
    const finalCheck = await transactionExists(paymentData.id, paymentData.order_id || orderData?.id);
    if (finalCheck) {
      console.log(`[RACE CONDITION] Transaction already exists for ${paymentData.id}, skipping`);
      return { success: true, data: finalCheck, message: "Transaction created by concurrent webhook" };
    }

    // order.paid should NOT create new transactions — payment.captured is the
    // authoritative handler for new transaction creation. If no pending transaction
    // was found, payment.captured will handle it.
    console.log(`[processOrderPaid] No pending transaction found — payment.captured will handle creation for ${paymentData.id}`);
    return { success: true, message: "No pending transaction to update; payment.captured will handle it" };
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

  // Resolve effective reseller: notes.reseller_id (set at payment link creation)
  // takes priority over the webhook URL reseller (which may be a different account).
  const effectiveResellerId =
    paymentData.notes?.reseller_id || subscriptionData?.notes?.reseller_id || resellerId;
  if (effectiveResellerId !== resellerId) {
    console.log(
      `[processSubscriptionCharged] Using notes.reseller_id=${effectiveResellerId} (webhook URL reseller=${resellerId})`
    );
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

  // Extract customer email for fallback matching
  const customerEmail =
    paymentData.email ||
    paymentData.notes?.email ||
    paymentData.notes?.customer_email;

  // If not in notes, try to find by email
  if (!customerId && customerEmail) {
    const customer = await findCustomerByEmail(customerEmail, effectiveResellerId);
    if (customer) {
      customerId = customer.id;
    }
  }

  console.log(
    `[processSubscriptionCharged] Customer: ${customerId}, Amount: ${amountInRupees}`
  );

  // Try to find and UPDATE the pending transaction
  let pendingTransaction = null;
  if (customerId || customerEmail) {
    pendingTransaction = await findPendingTransaction(
      customerId,
      amountInRupees,
      effectiveResellerId,
      null,
      null,
      customerEmail
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
        // Trigger full post-payment flow (virtual number + activation + email)
        await updateCustomerStatusAfterPayment(customerId, effectiveResellerId, pendingTransaction.id);
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
  return await createTransactionFromWebhook(effectiveResellerId, {
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
