import crypto from "crypto";
import Razorpay from "razorpay";
import { getHasuraClient } from "../config/hasura.client.js";
import { normalizeIndiaContactE164 } from "../utils/phone-formatter.js";

/**
 * Default Payment Link checkout methods for INR (explicit; avoids relying on Razorpay default drift).
 * Merged with optional linkData.options for advanced overrides.
 */
function defaultInrPaymentLinkOptions() {
  return {
    checkout: {
      method: {
        card: true,
        netbanking: true,
        upi: true,
        wallet: true,
      },
    },
  };
}

function mergeDeep(base, override) {
  if (override == null) return base;
  if (base == null) return override;
  if (typeof override !== "object" || Array.isArray(override)) return override;
  if (typeof base !== "object" || Array.isArray(base)) return override;
  const out = { ...base };
  for (const k of Object.keys(override)) {
    const bv = base[k];
    const ov = override[k];
    if (
      ov &&
      typeof ov === "object" &&
      !Array.isArray(ov) &&
      bv &&
      typeof bv === "object" &&
      !Array.isArray(bv)
    ) {
      out[k] = mergeDeep(bv, ov);
    } else {
      out[k] = ov;
    }
  }
  return out;
}

/** Razorpay reference_id max length 40; unique per link for dashboard correlation. */
function generatePaymentLinkReferenceId() {
  const id = `vn_${Date.now()}_${crypto.randomBytes(5).toString("hex")}`;
  return id.length <= 40 ? id : id.slice(0, 40);
}

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
    const data = await client.client.request(query, {
      reseller_id: resellerId,
    });

    if (data.mst_razorpay_config && data.mst_razorpay_config.length > 0) {
      return data.mst_razorpay_config[0];
    }
    return null;
  } catch (error) {
    console.error("Error fetching Razorpay config:", error);
    throw new Error("Failed to fetch Razorpay configuration");
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
    throw new Error(
      "Razorpay configuration not found for this reseller. Please configure Razorpay credentials first."
    );
  }

  if (!config.is_active) {
    throw new Error("Razorpay configuration is not active for this reseller.");
  }

  if (!config.key_id || !config.key_secret) {
    throw new Error(
      "Razorpay API credentials not configured. Please add your Razorpay Key ID and Key Secret."
    );
  }

  return new Razorpay({
    key_id: config.key_id.trim(),
    key_secret: config.key_secret.trim(),
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
    console.log(`[createRazorpayPlan] Initiating for resellerId=${resellerId}`);
    const razorpay = await getRazorpayInstance(resellerId);
    console.log(`[createRazorpayPlan] Razorpay instance created successfully.`);

    // Convert amount to paise (smallest currency unit for INR)
    const amountInPaise = Math.round(planData.amount * 100);

    // Calculate interval based on duration_days
    let period = "monthly";
    let interval = 1;

    if (planData.duration_days <= 7) {
      period = "daily";
      interval = planData.duration_days;
    } else if (planData.duration_days <= 30) {
      period = "daily";
      interval = planData.duration_days;
    } else if (planData.duration_days <= 90) {
      period = "monthly";
      interval = Math.max(1, Math.round(planData.duration_days / 30));
    } else if (planData.duration_days <= 365) {
      period = "monthly";
      interval = Math.max(1, Math.round(planData.duration_days / 30));
    } else {
      period = "yearly";
      interval = Math.max(1, Math.round(planData.duration_days / 365));
    }

    const planOptions = {
      period: period,
      interval: interval,
      item: {
        name: planData.plan_name,
        amount: amountInPaise,
        currency: planData.currency || "INR",
        description:
          planData.description || `${planData.plan_name} subscription plan`,
      },
      notes: {
        duration_days: planData.duration_days.toString(),
        reseller_id: resellerId,
      },
    };

    console.log(`[createRazorpayPlan] Plan creating via Razorpay API...`);
    const plan = await razorpay.plans.create(planOptions);
    console.log(`[createRazorpayPlan] Plan created successfully: ${plan.id}`);

    return {
      success: true,
      plan_id: plan.id,
      plan: plan,
    };
  } catch (error) {
    console.error(`[createRazorpayPlan] Error details caught exactly from Razorpay SDK:`, error);
    const errMsg = error.error?.description || error.message || "Failed to create Razorpay plan";
    console.error(`[createRazorpayPlan] Extracted errMsg:`, errMsg);
    throw new Error(
      errMsg === "Authentication failed" || errMsg.includes("Authentication failed")
        ? "Razorpay Authentication failed: Invalid Key ID or Key Secret. Please check your Razorpay Configuration."
        : errMsg
    );
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
      ...(subscriptionData.notes || {}),
    };

    const subscriptionOptions = {
      plan_id: subscriptionData.plan_id,
      total_count: subscriptionData.total_count || 1,
      customer_notify: 1,
      ...(subscriptionData.customer && { customer: subscriptionData.customer }),
      notes: notes,
    };

    const subscription = await razorpay.subscriptions.create(
      subscriptionOptions
    );

    return {
      success: true,
      subscription_id: subscription.id,
      subscription: subscription,
    };
  } catch (error) {
    console.error("Error creating Razorpay subscription:", error);
    const errMsg = error.error?.description || error.message || "Failed to create Razorpay subscription";
    throw new Error(
      errMsg === "Authentication failed"
        ? "Razorpay Authentication failed: Invalid Key ID or Key Secret. Please check your Razorpay Configuration."
        : errMsg
    );
  }
}

/**
 * Create both plan and subscription in one call
 * @param {string} resellerId - Reseller UUID
 * @param {object} planData - Plan data
 * @param {object} subscriptionData - Subscription data (optional)
 * @returns {Promise<object>} Combined result with plan and subscription
 */
export async function createRazorpayPlanAndSubscription(
  resellerId,
  planData,
  subscriptionData = {}
) {
  try {
    console.log(`[createRazorpayPlanAndSubscription] Start for resellerId=${resellerId}`);
    // First create the plan
    const planResult = await createRazorpayPlan(resellerId, planData);
    console.log(`[createRazorpayPlanAndSubscription] Plan creation yielded: ${planResult.plan_id}`);

    // Then create subscription using the plan ID
    console.log(`[createRazorpayPlanAndSubscription] Calling createRazorpaySubscription...`);
    const subscriptionResult = await createRazorpaySubscription(resellerId, {
      plan_id: planResult.plan_id,
      ...subscriptionData,
      notes: {
        reseller_id: resellerId,
        ...(subscriptionData.notes || {}),
      },
    });

    return {
      success: true,
      plan_id: planResult.plan_id,
      subscription_id: subscriptionResult.subscription_id,
      plan: planResult.plan,
      subscription: subscriptionResult.subscription,
    };
  } catch (error) {
    console.error("[createRazorpayPlanAndSubscription] Error caught heavily:", error);
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
      currency: orderData.currency || "INR",
      receipt: orderData.receipt || `receipt_${Date.now()}`,
      notes: {
        reseller_id: resellerId,
        ...(orderData.notes || {}),
      },
    };

    const order = await razorpay.orders.create(orderOptions);

    return {
      success: true,
      order_id: order.id,
      order: order,
    };
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    const errMsg = error.error?.description || error.message || "Failed to create Razorpay order";
    throw new Error(
      errMsg === "Authentication failed"
        ? "Razorpay Authentication failed: Invalid Key ID or Key Secret. Please check your Razorpay Configuration."
        : errMsg
    );
  }
}

/**
 * Create a Razorpay payment link
 * @param {string} resellerId - Reseller UUID
 * @param {object} linkData - Payment link data
 * @param {number} linkData.amount - Amount in rupees
 * @param {string} linkData.currency - Currency code (default: INR)
 * @param {string} linkData.description - Description of payment
 * @param {object} linkData.customer - Customer details (name, email, contact)
 * @param {object} linkData.notify - Notification settings (email, sms); defaults to both false (we email via SMTP)
 * @param {object} linkData.notes - Additional notes
 * @param {string} [linkData.reference_id] - Optional Razorpay reference (max 40 chars); auto-generated if omitted
 * @param {object} [linkData.options] - Optional override/merge for Payment Link `options` (INR merges with default checkout.method)
 * @returns {Promise<object>} Razorpay payment link object
 */
export async function createRazorpayPaymentLink(resellerId, linkData) {
  try {
    const config = await getRazorpayConfig(resellerId);

    if (!config) {
      throw new Error(
        "Razorpay configuration not found for this reseller. Please configure Razorpay credentials first."
      );
    }

    if (!config.is_active) {
      throw new Error(
        "Razorpay configuration is not active for this reseller."
      );
    }

    if (!config.key_id || !config.key_secret) {
      throw new Error(
        "Razorpay API credentials not configured. Please add your Razorpay Key ID and Key Secret."
      );
    }

    // Convert amount to paise
    const amountInPaise = Math.round(linkData.amount * 100);
    const currency = linkData.currency || "INR";

    const customerPayload = { ...(linkData.customer || {}) };
    if (customerPayload.contact != null && customerPayload.contact !== "") {
      const normalized = normalizeIndiaContactE164(customerPayload.contact);
      if (normalized) {
        customerPayload.contact = normalized;
      } else {
        delete customerPayload.contact;
      }
    }

    const optionsPayload =
      currency === "INR"
        ? linkData.options
          ? mergeDeep(defaultInrPaymentLinkOptions(), linkData.options)
          : defaultInrPaymentLinkOptions()
        : linkData.options || undefined;

    // Prepare payment link payload
    // Note: We disable Razorpay's email notification because we send emails ourselves
    // using the reseller's SMTP configuration to maintain branding
    const paymentLinkPayload = {
      amount: amountInPaise,
      currency,
      description: linkData.description || "Payment",
      customer: customerPayload,
      reference_id: linkData.reference_id || generatePaymentLinkReferenceId(),
      notify: linkData.notify ?? { email: false, sms: false },
      reminder_enable: false, // We handle reminders ourselves if needed
      notes: {
        reseller_id: resellerId,
        ...(linkData.notes || {}),
      },
      ...(optionsPayload ? { options: optionsPayload } : {}),
    };

    // Use direct HTTP API call since SDK might not have paymentLinks property
    const axios = (await import("axios")).default;
    const auth = Buffer.from(`${config.key_id}:${config.key_secret}`).toString(
      "base64"
    );

    const response = await axios.post(
      "https://api.razorpay.com/v1/payment_links",
      paymentLinkPayload,
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
      }
    );

    const paymentLink = response.data;

    return {
      success: true,
      id: paymentLink.id,
      short_url: paymentLink.short_url || `https://rzp.io/i/${paymentLink.id}`,
      paymentLink: paymentLink,
    };
  } catch (error) {
    console.error("Error creating Razorpay payment link:", error);

    // Extract error message from axios error if available
    const errorMessage =
      error.response?.data?.error?.description ||
      error.response?.data?.error?.message ||
      error.message ||
      "Failed to create Razorpay payment link";

    throw new Error(errorMessage);
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
export function verifyPaymentSignature(
  orderId,
  paymentId,
  signature,
  keySecret
) {
  const crypto = require("crypto");
  const body = orderId + "|" + paymentId;

  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(body.toString())
    .digest("hex");

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
      payment: payment,
    };
  } catch (error) {
    console.error("Error fetching payment:", error);
    const errMsg = error.error?.description || error.message || "Failed to fetch payment";
    throw new Error(
      errMsg === "Authentication failed"
        ? "Razorpay Authentication failed: Invalid Key ID or Key Secret. Please check your Razorpay Configuration."
        : errMsg
    );
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
      payment: payment,
    };
  } catch (error) {
    console.error("Error capturing payment:", error);
    const errMsg = error.error?.description || error.message || "Failed to capture payment";
    throw new Error(
      errMsg === "Authentication failed"
        ? "Razorpay Authentication failed: Invalid Key ID or Key Secret. Please check your Razorpay Configuration."
        : errMsg
    );
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
export async function createRefund(
  resellerId,
  paymentId,
  amount = null,
  options = {}
) {
  try {
    const razorpay = await getRazorpayInstance(resellerId);

    const refundOptions = {
      ...(amount && { amount: Math.round(amount * 100) }),
      notes: {
        reseller_id: resellerId,
        ...(options.notes || {}),
      },
      ...(options.speed && { speed: options.speed }),
      ...(options.receipt && { receipt: options.receipt }),
    };

    const refund = await razorpay.payments.refund(paymentId, refundOptions);

    return {
      success: true,
      refund: refund,
    };
  } catch (error) {
    console.error("Error creating refund:", error);
    const errMsg = error.error?.description || error.message || "Failed to create refund";
    throw new Error(
      errMsg === "Authentication failed"
        ? "Razorpay Authentication failed: Invalid Key ID or Key Secret. Please check your Razorpay Configuration."
        : errMsg
    );
  }
}
