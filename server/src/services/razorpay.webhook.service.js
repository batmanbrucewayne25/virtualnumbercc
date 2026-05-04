import crypto from "crypto";
import { getHasuraClient } from "../config/hasura.client.js";
import { VnApiClient } from "../utils/vnApiClient.js";
import { TRANSACTION_STATES } from "../constants/transaction-states.js";
import { debitWalletLedgerFirst } from "./walletLedger.service.js";

/**
 * Extract Razorpay payment link id (plink_...) from webhook payload when present.
 * @param {object} payload
 * @returns {string|null}
 */
export function extractRazorpayPaymentLinkIdFromPayload(payload) {
  const plEntity = payload?.payload?.payment_link?.entity;
  const payEntity = payload?.payload?.payment?.entity;
  return (
    plEntity?.id ||
    payEntity?.payment_link_id ||
    payEntity?.notes?.payment_link_id ||
    null
  );
}

export function verifyWebhookSignature(body, signature, webhookSecret) {
  if (!webhookSecret) {
    console.warn(
      "Webhook signature verification skipped - no webhook secret configured",
    );
    return true;
  }
  if (!signature) {
    console.error(
      "[Webhook] x-razorpay-signature header missing but webhook_secret is configured",
    );
    return false;
  }

  if (process.env.SKIP_WEBHOOK_SIGNATURE_VERIFICATION === "true") {
    console.warn(
      "[Webhook] SKIP_WEBHOOK_SIGNATURE_VERIFICATION=true — skipping verification (development only)",
    );
    return true;
  }

  try {
    const secret = String(webhookSecret).trim();
    const bodyBuffer = Buffer.isBuffer(body)
      ? body
      : Buffer.from(String(body), "utf8");
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(bodyBuffer)
      .digest("hex");

    const sigBuffer = Buffer.from(String(signature).trim(), "utf8");
    const expectedBuffer = Buffer.from(expectedSignature, "utf8");
    if (sigBuffer.length !== expectedBuffer.length) {
      console.error(
        `[Webhook] Signature length mismatch: received ${sigBuffer.length}, expected ${expectedBuffer.length}`,
      );
      return false;
    }
    return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
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
        key_secret
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
        "[IDEMPOTENCY] Webhook events table not found, using payment ID fallback",
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
  payload,
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
        "[IDEMPOTENCY] Webhook events table not found, skipping recording",
      );
      return false;
    }
    console.error("Error recording webhook event:", error);
    return false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Max age of `processing_vn` without a linked VN before we release the lock (ms). */
const STALE_PROCESSING_VN_MS = Number(process.env.STALE_PROCESSING_VN_MS) || 90000;

/** Poll when peer holds processing_vn (ms). */
const PROCESSING_VN_PEER_POLL_MS = 250;
const PROCESSING_VN_PEER_POLL_ATTEMPTS = 40;

/** Max age of a pending wallet ledger before retry recovery inspects it (ms). */
const STALE_PENDING_WALLET_LEDGER_MS =
  Number(process.env.STALE_PENDING_WALLET_LEDGER_MS) || 90000;

/**
 * If txn is stuck in processing_vn (no VN), wait briefly for a peer, then release stale lock.
 * @returns {Promise<object|null>} Latest mst_transaction row shape (minimal fields) or null
 */
async function waitOrRecoverProcessingVnLock(
  client,
  transactionId,
  razorpayPaymentId,
  orderId,
) {
  if (!transactionId) return null;
  const fetchTxnMin = async () => {
    const q = await client.client.request(
      `query Tvn($id: uuid!) {
        mst_transaction_by_pk(id: $id) {
          id
          status
          virtual_number_id
          updated_at
          customer_id
          reseller_id
          notes
        }
      }`,
      { id: transactionId },
    );
    return q?.mst_transaction_by_pk || null;
  };

  let row = await fetchTxnMin();
  if (!row || row.status !== "processing_vn" || row.virtual_number_id) {
    return row;
  }

  for (let i = 0; i < PROCESSING_VN_PEER_POLL_ATTEMPTS; i++) {
    await sleep(PROCESSING_VN_PEER_POLL_MS);
    row = await fetchTxnMin();
    if (!row) return null;
    if (row.virtual_number_id || row.status !== "processing_vn") {
      return row;
    }
  }

  const uat = row.updated_at ? new Date(row.updated_at).getTime() : 0;
  const ageMs = uat ? Date.now() - uat : STALE_PROCESSING_VN_MS + 1;
  if (ageMs < STALE_PROCESSING_VN_MS) {
    return row;
  }

  try {
    const rel = await client.client.request(
      `mutation ReleaseStaleVnLock($id: uuid!) {
        update_mst_transaction(
          where: {
            id: { _eq: $id }
            status: { _eq: "processing_vn" }
            virtual_number_id: { _is_null: true }
          }
          _set: { status: "captured" }
        ) { affected_rows }
      }`,
      { id: transactionId },
    );
    const ar = rel?.update_mst_transaction?.affected_rows ?? 0;
    if (ar === 1) {
      console.warn(
        `[vnLock] Released stale processing_vn for txn ${transactionId} (age ~${Math.round(ageMs)}ms > ${STALE_PROCESSING_VN_MS}ms)`,
      );
    }
  } catch (e) {
    console.warn(`[vnLock] stale release failed:`, e.message);
  }

  if (razorpayPaymentId || orderId) {
    return await transactionExists(razorpayPaymentId || null, orderId || null);
  }
  return fetchTxnMin();
}

async function patchTransactionProvisionalVirtualNumber(
  client,
  transactionId,
  vnRecord,
) {
  if (!transactionId || !vnRecord?.id) return;
  try {
    const current = await client.client.request(
      `query TxnNotesForProvisionalVn($id: uuid!) {
        mst_transaction_by_pk(id: $id) { notes }
      }`,
      { id: transactionId },
    );
    const prev = current?.mst_transaction_by_pk?.notes || {};
    const notes = {
      ...prev,
      provisional_virtual_number_id: vnRecord.id,
      provisional_virtual_number: vnRecord.virtual_number || null,
      provisional_virtual_number_at: new Date().toISOString(),
    };
    await client.client.request(
      `mutation PatchTxnProvisionalVn($id: uuid!, $notes: jsonb!) {
        update_mst_transaction_by_pk(
          pk_columns: { id: $id }
          _set: { notes: $notes }
        ) { id }
      }`,
      { id: transactionId, notes },
    );
  } catch (e) {
    console.warn(
      `[postPayment] provisional VN note patch skipped for txn=${transactionId}:`,
      e.message,
    );
  }
}

async function clearTransactionProvisionalVirtualNumber(client, transactionId) {
  if (!transactionId) return;
  try {
    const current = await client.client.request(
      `query TxnNotesForClearProvisionalVn($id: uuid!) {
        mst_transaction_by_pk(id: $id) { notes }
      }`,
      { id: transactionId },
    );
    const prev = current?.mst_transaction_by_pk?.notes || {};
    if (
      !prev.provisional_virtual_number_id &&
      !prev.provisional_virtual_number &&
      !prev.provisional_virtual_number_at
    ) {
      return;
    }

    const notes = { ...prev };
    delete notes.provisional_virtual_number_id;
    delete notes.provisional_virtual_number;
    delete notes.provisional_virtual_number_at;

    await client.client.request(
      `mutation ClearTxnProvisionalVn($id: uuid!, $notes: jsonb!) {
        update_mst_transaction_by_pk(
          pk_columns: { id: $id }
          _set: { notes: $notes }
        ) { id }
      }`,
      { id: transactionId, notes },
    );
  } catch (e) {
    console.warn(
      `[postPayment] provisional VN note clear skipped for txn=${transactionId}:`,
      e.message,
    );
  }
}

async function suspendUnlinkedVirtualNumberAfterRace(
  client,
  { vnId, virtualNumber, transactionId },
) {
  if (!vnId) return;
  try {
    const linked = await client.client.request(
      `query IsVnLinkedToAnyTxn($vn_id: uuid!) {
        mst_transaction(
          where: { virtual_number_id: { _eq: $vn_id } }
          limit: 1
        ) { id }
      }`,
      { vn_id: vnId },
    );
    if ((linked?.mst_transaction?.length || 0) > 0) return;

    await client.client.request(
      `mutation SuspendUnlinkedRaceVn($vn_id: uuid!) {
        update_mst_virtual_number(
          where: {
            id: { _eq: $vn_id }
            status: { _eq: "active" }
          }
          _set: { status: "suspended" }
        ) { affected_rows }
      }`,
      { vn_id: vnId },
    );

    if (virtualNumber) {
      try {
        await VnApiClient.suspendNumber(virtualNumber);
      } catch (apiErr) {
        console.warn(
          `[postPayment] unlinked VN API suspend skipped number=${virtualNumber}:`,
          apiErr.message,
        );
      }
    }

    console.warn(
      `[postPayment] Suspended unlinked VN ${vnId} after link race txn=${transactionId}`,
    );
  } catch (e) {
    console.warn(
      `[postPayment] unlinked VN suspend skipped txn=${transactionId} vn=${vnId}:`,
      e.message,
    );
  }
}

async function recoverProvisionalVirtualNumberForTransaction(
  client,
  { transactionId, txnRecord, customerId, resellerId, customer },
) {
  const provisionalVnId =
    txnRecord?.notes?.provisional_virtual_number_id || null;
  if (!transactionId || !provisionalVnId) return false;

  try {
    const linked = await client.client.request(
      `mutation LinkProvisionalVnToTxn($txn_id: uuid!, $vn_id: uuid!) {
        update_mst_transaction(
          where: {
            id: { _eq: $txn_id }
            virtual_number_id: { _is_null: true }
            status: { _in: ["processing_vn", "captured", "authorized", "success"] }
          }
          _set: { virtual_number_id: $vn_id, status: "success" }
        ) {
          affected_rows
          returning { id virtual_number_id status }
        }
      }`,
      { txn_id: transactionId, vn_id: provisionalVnId },
    );
    const row = linked?.update_mst_transaction?.returning?.[0] || null;
    if (row?.virtual_number_id) {
      console.warn(
        `[postPayment] Recovered provisional VN ${provisionalVnId} for txn=${transactionId}`,
      );
      await finalizeOnlinePaymentWhenVnAlreadyLinked(client, {
        customerId,
        resellerId,
        transactionId,
        virtualNumberId: row.virtual_number_id,
        customer,
      });
      return true;
    }

    const refreshed = await client.client.request(
      `query TxnVnAfterProvisionalRecovery($id: uuid!) {
        mst_transaction_by_pk(id: $id) {
          virtual_number_id
          status
        }
      }`,
      { id: transactionId },
    );
    const existingVn =
      refreshed?.mst_transaction_by_pk?.virtual_number_id || null;
    if (existingVn) {
      await finalizeOnlinePaymentWhenVnAlreadyLinked(client, {
        customerId,
        resellerId,
        transactionId,
        virtualNumberId: existingVn,
        customer,
      });
      return true;
    }
  } catch (e) {
    console.warn(
      `[postPayment] provisional VN recovery failed txn=${transactionId}:`,
      e.message,
    );
  }

  return false;
}

/**
 * Insert-first claim so only one worker runs fulfillment for a Razorpay payment id.
 * @returns {Promise<{ won: boolean, skipped: boolean }>} skipped=true if migration/Hasura not ready.
 */
async function tryClaimRazorpayPaymentFulfillment(
  client,
  paymentId,
  resellerId,
) {
  if (!paymentId || !resellerId) {
    return { won: true, skipped: true };
  }
  const mutation = `
    mutation TryClaimRazorpayPaymentFulfillment($payment_id: String!, $reseller_id: uuid!) {
      insert_mst_razorpay_payment_fulfillment_claim(
        objects: [{ razorpay_payment_id: $payment_id, reseller_id: $reseller_id }]
        on_conflict: {
          constraint: mst_razorpay_payment_fulfillment_claim_pkey
          update_columns: []
        }
      ) {
        affected_rows
      }
    }
  `;
  try {
    const res = await client.client.request(mutation, {
      payment_id: paymentId,
      reseller_id: resellerId,
    });
    const affected =
      res?.insert_mst_razorpay_payment_fulfillment_claim?.affected_rows ?? 0;
    return { won: affected === 1, skipped: false };
  } catch (e) {
    const msg = String(e?.message || e?.response?.errors?.[0]?.message || "");
    if (
      msg.includes("mst_razorpay_payment_fulfillment_claim") ||
      (msg.includes("field") && msg.includes("not found")) ||
      msg.includes("does not exist")
    ) {
      console.warn(
        "[fulfillmentClaim] Claim table or mutation unavailable — run add-razorpay-payment-fulfillment-claim.sql and track in Hasura; proceeding without mutex",
      );
      return { won: true, skipped: true };
    }
    console.error("[fulfillmentClaim] Unexpected error:", e);
    return { won: true, skipped: true };
  }
}

/**
 * Release (delete) a fulfillment claim so another webhook can retry.
 * Called after successful fulfillment or on error/rollback.
 */
async function releaseRazorpayPaymentFulfillmentClaim(client, paymentId) {
  if (!paymentId) return;
  try {
    const mutation = `
      mutation ReleaseRazorpayPaymentFulfillmentClaim($payment_id: String!) {
        delete_mst_razorpay_payment_fulfillment_claim(
          where: { razorpay_payment_id: { _eq: $payment_id } }
        ) {
          affected_rows
        }
      }
    `;
    const res = await client.client.request(mutation, { payment_id: paymentId });
    const deleted = res?.delete_mst_razorpay_payment_fulfillment_claim?.affected_rows ?? 0;
    if (deleted > 0) {
      console.log(`[fulfillmentClaim] Released claim for pay=${paymentId}`);
    }
  } catch (e) {
    console.warn(`[fulfillmentClaim] Failed to release claim for pay=${paymentId}:`, e.message);
  }
}

/**
 * Another worker holds the claim; wait for VN link + ensure wallet + record this event id.
 */
async function handleLostRazorpayPaymentFulfillmentClaim({
  paymentData,
  effectiveResellerId,
  eventId,
  payload,
}) {
  const pollMs = 200;
  const maxAttempts = 25;
  console.log(
    `[fulfillmentClaim] Lost claim for pay=${paymentData.id} — polling for peer fulfillment`,
  );
  for (let i = 0; i < maxAttempts; i++) {
    const txn = await transactionExists(
      paymentData.id,
      paymentData.order_id || null,
    );
    if (txn?.virtual_number_id && txn.customer_id) {
      const hc = getHasuraClient();
      await _ensureWalletDebitedForProcessedTxn(hc, {
        resellerId: txn.reseller_id,
        customerId: txn.customer_id,
        transactionId: txn.id,
        virtualNumberId: txn.virtual_number_id,
      });
      if (eventId) {
        await recordWebhookEvent(eventId, effectiveResellerId, txn.id, payload);
      }
      console.log(
        `[fulfillmentClaim] Peer completed pay=${paymentData.id} txn=${txn.id} — wallet ensured`,
      );
      return {
        success: true,
        data: txn,
        message: "Concurrent fulfillment — recovered after peer completed",
      };
    }
    await sleep(pollMs);
  }
  console.warn(
    `[fulfillmentClaim] Timed out waiting for peer for pay=${paymentData.id} — check logs / replay if needed`,
  );
  return {
    success: true,
    data: null,
    message:
      "Lost fulfillment claim — peer did not complete within wait window; verify in dashboard",
  };
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
      const result = await client.client.request(query, {
        razorpay_payment_id: razorpayPaymentId,
      });
      if (result.mst_transaction?.length > 0) return result.mst_transaction[0];
    } catch (error) {
      console.error(
        "Error checking transaction existence by payment_id:",
        error,
      );
    }
  }

  // Fallback: try by order_id (catches race where payment_id not yet written)
  if (orderId) {
    const orderQuery = `
      query CheckTransactionExistsByOrder($razorpay_order_id: String!) {
        mst_transaction(
          where: {
            razorpay_order_id: { _eq: $razorpay_order_id }
            status: { _nin: ["failed", "refunded"] }
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
      const result = await client.client.request(orderQuery, {
        razorpay_order_id: orderId,
      });
      if (result.mst_transaction?.length > 0) {
        console.log(
          `[transactionExists] Found by order_id=${orderId}: ${result.mst_transaction[0].id}`,
        );
        return result.mst_transaction[0];
      }
    } catch (error) {
      console.error("Error checking transaction existence by order_id:", error);
    }
  }

  return null;
}

/**
 * Record Razorpay webhook event idempotency only after a durable fulfillment outcome
 * (VN linked, or failed/refunded). Avoids marking events processed while `processing_vn`
 * or `captured` without VN — duplicate deliveries must be able to re-enter the handler.
 */
async function maybeRecordWebhookEventIfTerminal({
  eventId,
  resellerId,
  paymentId,
  orderId,
  payload,
}) {
  if (!eventId || !resellerId || !paymentId) return;
  const row = await transactionExists(paymentId, orderId || null);
  if (!row?.id) return;
  const terminal =
    !!row.virtual_number_id ||
    (row.status && ["failed", "refunded"].includes(row.status));
  if (!terminal) {
    return;
  }
  await recordWebhookEvent(eventId, resellerId, row.id, payload);
}

/**
 * Monotonic status guard for `updatePendingTransactionWithPayment` mutations.
 * Prevents e.g. payment.authorized from overwriting a row already marked captured.
 */
function whereStatusPendingTxnUpdate(mappedStatus) {
  switch (mappedStatus) {
    case "authorized":
      return `status: { _in: ["pending", "authorized"] }`;
    case "captured":
      return `_or: [
        { status: { _in: ["pending", "authorized", "captured"] } },
        { _and: [{ status: { _eq: "success" } }, { virtual_number_id: { _is_null: true } }] }
      ]`;
    case "failed":
      return `status: { _in: ["pending", "authorized", "captured"] }`;
    case "refunded":
      return `status: { _eq: "success" }`;
    default:
      return `status: { _nin: ["success", "refunded", "processing_vn", "captured"] }`;
  }
}

/**
 * Monotonic status guards for `updateTransactionStatus` (by pk or payment_id).
 */
function whereGuardsUpdateTransactionStatus(mappedStatus) {
  if (mappedStatus === "refunded") {
    const g = `status: { _eq: "success" }`;
    return { txn: g, payment: g };
  }
  if (mappedStatus === "authorized") {
    const g = `status: { _in: ["pending", "authorized"] }`;
    return { txn: g, payment: g };
  }
  if (mappedStatus === "captured") {
    const g = `_or: [
      { status: { _in: ["pending", "authorized", "captured"] } },
      { _and: [{ status: { _eq: "success" } }, { virtual_number_id: { _is_null: true } }] }
    ]`;
    return { txn: g, payment: g };
  }
  if (mappedStatus === "failed") {
    const g = `status: { _in: ["pending", "authorized", "captured"] }`;
    return { txn: g, payment: g };
  }
  const g = `status: { _nin: ["success", "refunded", "processing_vn", "captured"] }`;
  return { txn: g, payment: g };
}

/**
 * Find customer by email
 * @param {string} email - Customer email
 * @param {string} resellerId - Reseller UUID
 * @returns {Promise<object|null>}
 */
export async function findCustomerByEmail(email, resellerId) {
  if (!email || !resellerId) return null;

  const client = getHasuraClient();
  const emailTrimmed = String(email).trim().toLowerCase();

  const query = `
    query FindCustomerByEmail($email: String!, $reseller_id: uuid!) {
      mst_customer(
        where: {
          reseller_id: { _eq: $reseller_id }
          email: { _ilike: $email }
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
      email: emailTrimmed,
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
 *   0. By notes.razorpay_payment_link_id — when stored at link creation (strong correlation)
 *   1. By razorpay_order_id — order-based flows
 *   2. By customer_id + amount + razorpay_payment_id IS NULL — dynamic payment links
 *   3. By customer_email + amount + razorpay_payment_id IS NULL — static payment links
 *   4. By customer_id + razorpay_payment_id IS NULL + amount band — authorize-first path
 *      (payment.authorized may set payment_id before capture; attempts 2–3 require null payment_id)
 *
 * NOTE: The previous "Attempt 4" (customer_id with no amount filter) was removed — it
 * matched the wrong pending row when a customer had multiple overlapping pendings.
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
 * @param {string|null} razorpayPaymentLinkId - plink_... stored in notes at approval
 * @returns {Promise<object|null>}
 */
export async function findPendingTransaction(
  customerId,
  amount,
  resellerId,
  orderId = null,
  paymentId = null, // kept for API compat; not used as DB filter
  customerEmail = null,
  razorpayPaymentLinkId = null,
) {
  if (!resellerId) {
    return null;
  }
  if (!customerId && !orderId && !customerEmail && !razorpayPaymentLinkId) {
    console.log(
      `[findPendingTransaction] Skipping — no customer/order/email/payment_link identifier`,
    );
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

  // --- Attempt 0: match by notes.razorpay_payment_link_id (set when creating dynamic links) ---
  if (razorpayPaymentLinkId) {
    try {
      const result = await client.client.request(query, {
        where: {
          reseller_id: { _eq: resellerId },
          status: { _in: ["pending", "authorized"] },
          notes: {
            _contains: { razorpay_payment_link_id: razorpayPaymentLinkId },
          },
        },
      });
      if (result.mst_transaction?.length > 0) {
        console.log(
          `[findPendingTransaction] Found by notes.razorpay_payment_link_id=${razorpayPaymentLinkId}: ${result.mst_transaction[0].id}`,
        );
        return result.mst_transaction[0];
      }
    } catch (error) {
      console.error(
        "[findPendingTransaction] razorpay_payment_link_id lookup error:",
        error.message,
      );
    }
  }

  // --- Attempt 1: match by order_id (most reliable for order-based flows) ---
  if (orderId) {
    try {
      const result = await client.client.request(query, {
        where: { ...baseWhere, razorpay_order_id: { _eq: orderId } },
      });
      if (result.mst_transaction?.length > 0) {
        console.log(
          `[findPendingTransaction] Found by order_id=${orderId}: ${result.mst_transaction[0].id}`,
        );
        return result.mst_transaction[0];
      }
    } catch (error) {
      console.error(
        "[findPendingTransaction] order_id lookup error:",
        error.message,
      );
    }
  }

  // --- Attempt 2: match by customer_id where no payment_id yet ---
  // This is the critical path for Razorpay Payment Links:
  // The pending transaction was created with status="pending" and no payment_id.
  // We match it by customer + amount and claim it by writing the payment_id in.
  //
  // CRITICAL SAFEGUARD: If the incoming webhook has an orderId, and the found
  // transaction has a DIFFERENT order_id stored, we must REJECT the match.
  // This prevents old webhook retries from claiming newly created transactions.
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
        const foundTxn = result.mst_transaction[0];
        // SAFEGUARD: Reject if order_id mismatch
        if (orderId && foundTxn.razorpay_order_id && foundTxn.razorpay_order_id !== orderId) {
          console.warn(
            `[findPendingTransaction] REJECTED customer_id match — order_id mismatch: webhook=${orderId} vs txn=${foundTxn.razorpay_order_id}`,
          );
          // Don't return this transaction; fall through to other attempts or return null
        } else {
          console.log(
            `[findPendingTransaction] Found by customer_id=${customerId}: ${foundTxn.id}`,
          );
          return foundTxn;
        }
      }
    } catch (error) {
      console.error(
        "[findPendingTransaction] customer_id lookup error:",
        error.message,
      );
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
          `[findPendingTransaction] Found by customer_email=${customerEmail}: ${result.mst_transaction[0].id}`,
        );
        return result.mst_transaction[0];
      }
    } catch (error) {
      console.error(
        "[findPendingTransaction] customer_email lookup error:",
        error.message,
      );
    }
  }

  // --- Attempt 4: authorize-first path (payment_id may already be set on the row) ---
  // When payment.authorized runs before capture, attempts 2–3 miss because they require
  // razorpay_payment_id IS NULL. We intentionally do NOT filter on payment_id here.
  // Amount band is applied when `amount` is known to reduce wrong-row matches.
  //
  // CRITICAL SAFEGUARD: If the incoming webhook has an orderId, the found transaction
  // MUST have a matching order_id (or no order_id at all). This prevents stale webhook
  // retries from claiming transactions created for different payments.
  if (customerId) {
    try {
      const whereAuthFirst = {
        reseller_id: { _eq: resellerId },
        status: { _in: ["pending", "authorized"] },
        customer_id: { _eq: customerId },
      };
      if (amount) {
        whereAuthFirst.amount = { _gte: minAmount, _lte: maxAmount };
      }
      const result = await client.client.request(query, {
        where: whereAuthFirst,
      });
      if (result.mst_transaction?.length > 0) {
        const foundTxn = result.mst_transaction[0];
        // SAFEGUARD: Reject if order_id mismatch (txn has different order_id than webhook)
        if (orderId && foundTxn.razorpay_order_id && foundTxn.razorpay_order_id !== orderId) {
          console.warn(
            `[findPendingTransaction] REJECTED authorized-first match — order_id mismatch: webhook=${orderId} vs txn=${foundTxn.razorpay_order_id}`,
          );
          // Don't return; fall through to return null
        } else {
          console.log(
            `[findPendingTransaction] Found by customer_id (authorized-first path)=${customerId}: ${foundTxn.id} status=${foundTxn.status} payment_id=${foundTxn.razorpay_payment_id}`,
          );
          return foundTxn;
        }
      }
    } catch (error) {
      console.error(
        "[findPendingTransaction] authorized-first lookup error:",
        error.message,
      );
    }
  }

  console.log(
    `[findPendingTransaction] No pending transaction found for customer=${customerId} email=${customerEmail} amount=${amount} reseller=${resellerId}`,
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
  status,
) {
  const client = getHasuraClient();

  // Map Razorpay status to our status
  const statusMap = {
    authorized: "authorized",
    captured: "captured",
    failed: "failed",
    refunded: "refunded",
  };

  const mappedStatus = statusMap[status] || status;
  const statusWhere = whereStatusPendingTxnUpdate(mappedStatus);

  // ── Fetch existing DB notes so we can MERGE, not overwrite ───────────────
  // Critical: the pending transaction was created with transaction_type and
  // call_forwarding_number in notes. Razorpay's webhook notes only contain what
  // was passed to the payment link (which may be a subset). We must preserve
  // our own keys so Guard B in postPayment can correctly identify the flow.
  let existingNotes = {};
  try {
    const fetchNotesQuery = `
      query GetTransactionNotes($id: uuid!) {
        mst_transaction_by_pk(id: $id) { notes }
      }
    `;
    const notesResult = await client.client.request(fetchNotesQuery, {
      id: transactionId,
    });
    existingNotes = notesResult?.mst_transaction_by_pk?.notes || {};
  } catch (notesErr) {
    console.warn(
      `[updatePendingTransaction] Could not fetch existing notes for ${transactionId}:`,
      notesErr.message,
    );
  }

  // Razorpay notes take precedence for Razorpay fields, but our keys
  // (transaction_type, call_forwarding_number) are preserved if not in Razorpay notes.
  const mergedNotes = {
    ...existingNotes,
    ...(paymentData.notes || {}),
    // Always preserve our own keys if they exist in the DB record
    ...(existingNotes.transaction_type
      ? { transaction_type: existingNotes.transaction_type }
      : {}),
    ...(existingNotes.call_forwarding_number
      ? { call_forwarding_number: existingNotes.call_forwarding_number }
      : {}),
  };

  // Monotonic WHERE per mappedStatus so authorized cannot overwrite captured/success.
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
          ${statusWhere}
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
          notes
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
      notes: mergedNotes,
      failure_reason:
        paymentData.error_description || paymentData.error_reason || null,
    });

    const updated = result?.update_mst_transaction?.returning?.[0];
    if (updated) {
      console.log(
        `[updatePendingTransaction] Successfully updated transaction ${transactionId} to ${mappedStatus}`,
      );
      return {
        success: true,
        data: updated,
      };
    }

    // 0 rows updated = status guard fired (e.g. captured row cannot downgrade to authorized)
    console.warn(
      `[updatePendingTransaction] Transaction ${transactionId} not updated — status guard blocked update (terminal/in-flight or monotonic rule)`,
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
 * Normalize payment data from webhook payload.
 * Handles both payment.captured (payload.payload.payment.entity) and
 * payment_link.paid (payload.payload.payment_link.entity with payments array).
 * @param {object} payload - Raw webhook payload
 * @returns {{ paymentData: object|null, effectiveResellerId: string|null }}
 */
function normalizePaymentDataFromPayload(payload) {
  let paymentData = payload?.payload?.payment?.entity ?? null;
  const plEntity = payload?.payload?.payment_link?.entity ?? null;

  if (!paymentData && plEntity) {
    const payments = Array.isArray(plEntity.payments) ? plEntity.payments : [];
    const capturedPayment =
      payments.find((p) => p?.status === "captured") || payments[0];
    if (capturedPayment) {
      const paymentId =
        capturedPayment.id ??
        capturedPayment.payment_id ??
        capturedPayment.paymentId;
      paymentData = {
        id: paymentId,
        amount:
          capturedPayment.amount ?? plEntity.amount_paid ?? plEntity.amount,
        status: capturedPayment.status ?? "captured",
        email: capturedPayment.email ?? plEntity.customer?.email ?? null,
        contact: capturedPayment.contact ?? plEntity.customer?.contact ?? null,
        order_id: capturedPayment.order_id ?? null,
        notes: { ...(plEntity.notes || {}), ...(capturedPayment.notes || {}) },
        ...capturedPayment,
      };
    }
  }

  const effectiveResellerId =
    paymentData?.notes?.reseller_id ?? plEntity?.notes?.reseller_id ?? null;
  return { paymentData, effectiveResellerId };
}

/**
 * Create transaction record from Razorpay webhook payload
 * @param {string} resellerId - Reseller UUID
 * @param {object} paymentData - Payment data from webhook
 * @param {object} options - Optional overrides
 * @param {string|null} options.preResolvedCustomerId - Customer ID already resolved by caller (avoids re-lookup)
 * @returns {Promise<object>}
 */
export async function createTransactionFromWebhook(
  resellerId,
  paymentData,
  options = {},
) {
  const client = getHasuraClient();

  // CRITICAL: The webhook URL reseller_id may differ from the reseller who actually
  // created the payment link (notes.reseller_id). Always prefer notes.reseller_id
  // because the transaction FK must point to the reseller that exists in mst_reseller.
  const effectiveResellerId = paymentData.notes?.reseller_id || resellerId;
  if (effectiveResellerId !== resellerId) {
    console.log(
      `[createTransactionFromWebhook] Using notes.reseller_id=${effectiveResellerId} instead of webhook URL reseller_id=${resellerId}`,
    );
  }

  // Generate unique transaction number
  const transactionNumber = `TXN${Date.now()}${Math.random()
    .toString(36)
    .substring(2, 9)
    .toUpperCase()}`;

  // Map Razorpay status to our status
  const statusMap = {
    authorized: "authorized",
    captured: "captured",
    failed: "failed",
    refunded: "refunded",
  };

  const status =
    statusMap[paymentData.status] || paymentData.status || "pending";

  // Convert amount from paise to rupees for storage
  const amountInRupees = (paymentData.amount || 0) / 100;

  // Extract customer_id: prefer pre-resolved from caller, then notes, then email lookup
  let customerId =
    options.preResolvedCustomerId ?? paymentData.notes?.customer_id ?? null;

  const customerEmail =
    paymentData.email ||
    paymentData.notes?.email ||
    paymentData.notes?.customer_email ||
    null;

  if (!customerId && customerEmail) {
    const customer = await findCustomerByEmail(
      customerEmail,
      effectiveResellerId,
    );
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
          `[FINAL CHECK] Transaction ${paymentData.id} already exists, returning existing transaction`,
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
      const customer = await findCustomerByEmail(
        customerEmail,
        effectiveResellerId,
      );
      if (customer) {
        customerName = customer.profile_name || customer.email;
      }
    }

    console.log(
      `[createTransactionFromWebhook] Inserting transaction reseller_id=${effectiveResellerId} customer_id=${customerId} status=${status}`,
    );
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
      if (
        customerId &&
        (status === "success" ||
          status === "authorized" ||
          status === "captured")
      ) {
        await updateCustomerStatusAfterPayment(
          customerId,
          effectiveResellerId,
          newTxnId,
        );
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
        `[DUPLICATE ERROR] Detected duplicate transaction for ${paymentData.id}, fetching existing`,
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
          virtual_number
          expiry_date
        }
      }
    `;
    const vnResult = await client.client.request(getQuery, {
      id: virtualNumberId,
    });
    const vn = vnResult?.mst_virtual_number_by_pk;
    if (!vn || !vn.expiry_date) {
      console.warn(
        `[postPayment][renewal] VN ${virtualNumberId} not found or no expiry_date`,
      );
      return;
    }

    // Call VN API to reactivate the number
    if (vn.virtual_number) {
      try {
        const reactivateRes = await VnApiClient.reactivateNumber(
          vn.virtual_number,
        );
        console.log(
          `[postPayment][renewal] VN API reactivate response:`,
          reactivateRes,
        );
      } catch (vnApiErr) {
        console.warn(
          `[postPayment][renewal] VN API reactivate failed (non-fatal):`,
          vnApiErr.message,
        );
      }
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
      `[postPayment][renewal] Extended VN ${virtualNumberId} expiry: ${vn.expiry_date} -> ${newExpiryStr} (+${daysToAdd} days)`,
    );
  } catch (err) {
    console.error(`[postPayment][renewal] Failed to extend VN expiry:`, err);
  }
}

/** Normalize Hasura numeric fields (may be string with commas). */
function _normalizeWalletNumeric(value) {
  return Number(String(value ?? 0).replace(/,/g, "")) || 0;
}

/**
 * Mark transaction notes when wallet debit did not complete (reconcile later).
 */
async function _flagTransactionWalletDebitPending(
  client,
  transactionId,
  reason,
) {
  if (!transactionId) return;
  try {
    const tq = await client.client.request(
      `query T($id: uuid!) {
        mst_transaction_by_pk(id: $id) { notes }
      }`,
      { id: transactionId },
    );
    const prev = tq?.mst_transaction_by_pk?.notes || {};
    const notes = {
      ...prev,
      wallet_debit: {
        state: "pending",
        reason: String(reason || "unknown"),
        at: new Date().toISOString(),
      },
    };
    await client.client.request(
      `mutation U($id: uuid!, $notes: jsonb!) {
        update_mst_transaction_by_pk(
          pk_columns: { id: $id }
          _set: { notes: $notes }
        ) { id }
      }`,
      { id: transactionId, notes },
    );
  } catch (e) {
    console.warn(
      `[postPayment][walletDebit] flag wallet_debit pending skipped:`,
      e.message,
    );
  }
}

async function _markTransactionWalletDebitSuccess(
  client,
  transactionId,
  outcome,
) {
  if (!transactionId) return;
  try {
    const tq = await client.client.request(
      `query T($id: uuid!) {
        mst_transaction_by_pk(id: $id) { notes }
      }`,
      { id: transactionId },
    );
    const prev = tq?.mst_transaction_by_pk?.notes || {};
    const notes = {
      ...prev,
      wallet_debit: {
        state: "success",
        outcome: String(outcome || "debited"),
        at: new Date().toISOString(),
      },
    };
    await client.client.request(
      `mutation U($id: uuid!, $notes: jsonb!) {
        update_mst_transaction_by_pk(
          pk_columns: { id: $id }
          _set: { notes: $notes }
        ) { id }
      }`,
      { id: transactionId, notes },
    );
  } catch (e) {
    console.warn(
      `[postPayment][walletDebit] mark wallet_debit success skipped:`,
      e.message,
    );
  }
}

/**
 * Re-run wallet debit when webhooks early-exit on vn_id but debit may have failed earlier.
 */
async function _ensureWalletDebitedForProcessedTxn(client, params) {
  const { resellerId, customerId, transactionId, virtualNumberId } =
    params || {};
  if (!resellerId || !customerId || !transactionId) {
    console.warn(
      `[ensureWalletDebit] missing resellerId/customerId/transactionId — skip`,
    );
    return null;
  }
  const customerQuery = `
    query GetCustomerForEnsureDebit($id: uuid!) {
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
      }
    }
  `;
  try {
    const customerResult = await client.client.request(customerQuery, {
      id: customerId,
    });
    const customer = customerResult?.mst_customer_by_pk;
    if (!customer?.mst_reseller?.id) {
      console.warn(`[ensureWalletDebit] customer or reseller missing — skip`);
      return null;
    }
    const rid = resellerId || customer.mst_reseller.id;
    const out = await _debitResellerWalletForOnlinePayment(
      client,
      customer,
      rid,
      transactionId,
      virtualNumberId || null,
    );
    console.log(
      `[ensureWalletDebit] txn=${transactionId} outcome=${out ?? "undefined"}`,
    );
    return out;
  } catch (e) {
    console.error(`[ensureWalletDebit] error:`, e.message);
    return "debit_failed";
  }
}

/**
 * Peers (or a prior attempt) linked a VN to the txn; this worker lost the claim.
 * Ensures wallet idempotency, then renewal vs first-activation follow-up (emails, etc.).
 */
async function finalizeOnlinePaymentWhenVnAlreadyLinked(
  client,
  { customerId, resellerId, transactionId, virtualNumberId, customer },
) {
  if (!customerId || !resellerId || !transactionId || !virtualNumberId) {
    return;
  }
  const nq = await client.client.request(
    `query TnForFinalize($id: uuid!) {
      mst_transaction_by_pk(id: $id) {
        notes
        razorpay_payment_id
      }
    }`,
    { id: transactionId },
  );
  const txnForFinalize = nq?.mst_transaction_by_pk || null;
  const notes = txnForFinalize?.notes;
  const paymentIdForClaimRelease = txnForFinalize?.razorpay_payment_id || null;
  const isRenewal = notes?.transaction_type === "renewal";
  const settleFulfillmentClaim = async () => {
    await clearTransactionProvisionalVirtualNumber(client, transactionId);
    if (paymentIdForClaimRelease) {
      await releaseRazorpayPaymentFulfillmentClaim(
        client,
        paymentIdForClaimRelease,
      );
    }
  };

  const debitOut = await _ensureWalletDebitedForProcessedTxn(client, {
    resellerId,
    customerId,
    transactionId,
    virtualNumberId,
  });
  const debitOk =
    debitOut === "debited" || debitOut === "already_debited";

  if (isRenewal) {
    if (!debitOk) {
      await _flagTransactionWalletDebitPending(
        client,
        transactionId,
        debitOut || "linked_vn_wallet_debit_failed",
      );
      console.error(
        `[postPayment] linked-VN renewal held: wallet not debited (outcome=${debitOut}) txn=${transactionId}`,
      );
      return;
    }
    if (debitOut === "debited") {
      await _extendVirtualNumberExpiry(client, virtualNumberId, 360);
    }
    await settleFulfillmentClaim();
    await _notifyRenewalPaymentSuccessAfterOnlinePayment(
      client,
      customer,
      resellerId,
      transactionId,
      virtualNumberId,
    );
    return;
  }

  if (!debitOk) {
    await _flagTransactionWalletDebitPending(
      client,
      transactionId,
      debitOut || "linked_vn_wallet_debit_failed",
    );
    console.error(
      `[postPayment] linked-VN fulfillment held: wallet not debited (outcome=${debitOut}) txn=${transactionId}`,
    );
    return;
  }
  await settleFulfillmentClaim();

  try {
    await client.client.request(
      `mutation ActivateCustomerPostPay($customer_id: uuid!) {
        update_mst_customer_by_pk(
          pk_columns: { id: $customer_id }
          _set: { status: "active", kyc_status: "verified", approval: "approved" }
        ) { id }
      }`,
      { customer_id: customerId },
    );
    console.log(
      `[postPayment] Customer ${customerId} activated (VN already linked path)`,
    );
  } catch (e) {
    console.warn(
      `[postPayment] Customer activate (linked-VN path) non-fatal:`,
      e.message,
    );
  }

  try {
    const vq = await client.client.request(
      `query VnStrForEmail($id: uuid!) {
        mst_virtual_number_by_pk(id: $id) {
          virtual_number
          purchase_date
          expiry_date
          call_forwarding_number
        }
      }`,
      { id: virtualNumberId },
    );
    const vnRow = vq?.mst_virtual_number_by_pk;
    const virtualNumber = vnRow?.virtual_number || "";
    if (!virtualNumber || !customer?.email) return;

    const { sendVirtualNumberEmail } =
      await import("../../services/emailService.js");
    const { getResellerSmtpConfig } = await import("./smtpConfig.service.js");
    const reseller = customer?.mst_reseller;
    const resellerName =
      reseller?.brand_name ||
      reseller?.business_name ||
      (reseller?.first_name
        ? `${reseller.first_name} ${reseller.last_name}`
        : null) ||
      reseller?.email ||
      "Your Provider";
    const smtpConfig = await getResellerSmtpConfig(resellerId);
    const purchaseDate =
      vnRow?.purchase_date || new Date().toISOString().split("T")[0];
    const endDate = vnRow?.expiry_date || purchaseDate;
    await sendVirtualNumberEmail(
      customer.email,
      customer.profile_name || customer.email,
      virtualNumber,
      resellerName,
      smtpConfig,
      {
        resellerId,
        customerId,
        forwardNumber:
          vnRow?.call_forwarding_number || customer.phone || "",
        startDate: purchaseDate,
        endDate: endDate,
      },
    );
    console.log(
      `[postPayment] Virtual number email sent (linked-VN path) to ${customer.email}`,
    );
  } catch (e) {
    console.warn(`[postPayment] VN email (linked-VN path) skipped:`, e.message);
  }
}

/** Best-effort renewal success emails after online payment + wallet debit. */
async function _notifyRenewalPaymentSuccessAfterOnlinePayment(
  client,
  customer,
  resellerId,
  transactionId,
  virtualNumberId,
) {
  try {
    const {
      sendRenewalPaymentSuccessCustomerEmail,
      sendRenewalPaymentSuccessAdminEmail,
    } = await import("./transactionalEmail.service.js");
    let vnStr = "";
    if (virtualNumberId) {
      const vq = await client.client.request(
        `query V($id: uuid!) { mst_virtual_number_by_pk(id: $id) { virtual_number } }`,
        { id: virtualNumberId },
      );
      vnStr = vq?.mst_virtual_number_by_pk?.virtual_number || "";
    }
    let amountRupees = 0;
    let txnRef = transactionId || "";
    if (transactionId) {
      const tq = await client.client.request(
        `query T($id: uuid!) { mst_transaction_by_pk(id: $id) { amount reference_number } }`,
        { id: transactionId },
      );
      const tr = tq?.mst_transaction_by_pk;
      if (tr?.amount != null) amountRupees = Number(tr.amount);
      if (tr?.reference_number) txnRef = String(tr.reference_number);
    }
    const reseller = customer?.mst_reseller;
    const rid = resellerId || reseller?.id;
    if (!rid || !customer?.email) return;
    const resellerName =
      reseller?.brand_name ||
      reseller?.business_name ||
      (reseller?.first_name
        ? `${reseller.first_name} ${reseller.last_name || ""}`.trim()
        : null) ||
      reseller?.email ||
      "Team";
    await sendRenewalPaymentSuccessCustomerEmail({
      customerEmail: customer.email,
      customerName: customer.profile_name || customer.email,
      amountRupees,
      transactionRef: txnRef,
      virtualNumber: vnStr,
      resellerId: rid,
      customerId: customer?.id || null,
    });
    if (reseller?.email) {
      await sendRenewalPaymentSuccessAdminEmail({
        resellerEmail: reseller.email,
        resellerDisplay: resellerName,
        customerName: customer.profile_name || customer.email,
        amountRupees,
        virtualNumber: vnStr,
        resellerId: rid,
        customerId: customer?.id || null,
      });
    }
  } catch (e) {
    console.warn("[postPayment][renewal] success notify skipped:", e.message);
  }
}

/**
 * Debit reseller wallet for online VN fulfillment.
 * Order: insert ledger row debit_status=pending (UNIQUE(wallet_id,reference) serializes workers) ->
 * CAS on mst_wallet -> mark ledger success. Prevents concurrent CAS-only debits before any row exists.
 */
async function _debitResellerWalletForOnlinePayment(
  client,
  customer,
  resellerId,
  transactionId,
  virtualNumberId = null,
) {
  console.log(`[postPayment][walletDebit] --- START ---`);
  console.log(`[postPayment][walletDebit] resellerId param=${resellerId}`);
  console.log(`[postPayment][walletDebit] transactionId=${transactionId}`);
  console.log(
    `[postPayment][walletDebit] reseller from DB=`,
    JSON.stringify(customer?.mst_reseller),
  );

  try {
    const reseller = customer?.mst_reseller;
    const pricePerNumber =
      Number(parseFloat(String(reseller?.price_per_number ?? ""))) || 0;
    const effectiveResellerId = resellerId || reseller?.id;

    console.log(
      `[postPayment][walletDebit] effectiveResellerId=${effectiveResellerId}, pricePerNumber=${pricePerNumber}`,
    );

    if (!effectiveResellerId) {
      console.error(
        `[postPayment][walletDebit] CRITICAL: No reseller_id available — wallet not debited`,
      );
      return "debit_failed";
    }
    if (pricePerNumber <= 0) {
      console.error(
        `[postPayment][walletDebit] CRITICAL: price_per_number is 0 or not set on mst_reseller for reseller ${effectiveResellerId} — wallet not debited. Set price_per_number in DB.`,
      );
      return "debit_failed";
    }

    if (!transactionId) {
      console.error(
        `[postPayment][walletDebit] CRITICAL: missing transactionId — skip`,
      );
      return "debit_failed";
    }

    const walletsForResellerQuery = `
      query GetResellerWalletsForDebitIdem($reseller_id: uuid!) {
        mst_wallet(
          where: { reseller_id: { _eq: $reseller_id } }
          order_by: { id: asc }
        ) {
          id
        }
      }
    `;
    const walletsData = await client.client.request(walletsForResellerQuery, {
      reseller_id: effectiveResellerId,
    });
    const walletIdsForReseller =
      walletsData?.mst_wallet?.map((w) => w.id).filter(Boolean) || [];
    if (walletIdsForReseller.length === 0) {
      console.error(
        `[postPayment][walletDebit] CRITICAL: No mst_wallet for reseller — wallet not debited`,
      );
      return "debit_failed";
    }

    const referenceStr = String(transactionId);

    // Finalized ledger only (success or legacy NULL). `pending` is handled in the claim phase.
    const idempotencyFinalizedQuery = `
      query CheckWalletDebitFinalizedReseller(
        $reference: String!
        $wallet_ids: [uuid!]!
      ) {
        mst_wallet_transaction(
          where: {
            reference: { _eq: $reference }
            wallet_id: { _in: $wallet_ids }
            _or: [
              { debit_status: { _eq: "success" } }
              { debit_status: { _is_null: true } }
            ]
          }
          limit: 1
        ) {
          id
          debit_status
          wallet_id
          amount
          balance_before
          balance_after
          created_at
          customer_id
          virtual_number_id
        }
      }
    `;

    const ledgerAnyStateQuery = `
      query CheckWalletDebitLedgerAnyState(
        $reference: String!
        $wallet_ids: [uuid!]!
      ) {
        mst_wallet_transaction(
          where: {
            reference: { _eq: $reference }
            wallet_id: { _in: $wallet_ids }
          }
          limit: 1
        ) {
          id
          debit_status
          wallet_id
          amount
          balance_before
          balance_after
          created_at
          customer_id
          virtual_number_id
        }
      }
    `;

    async function referenceAlreadyFinalizedLedger() {
      if (!walletIdsForReseller?.length) {
        console.warn(
          `[postPayment][walletDebit] referenceAlreadyFinalizedLedger skipped — walletIdsForReseller empty`,
        );
        return null;
      }
      try {
        const idem = await client.client.request(idempotencyFinalizedQuery, {
          reference: referenceStr,
          wallet_ids: walletIdsForReseller,
        });
        return idem?.mst_wallet_transaction?.length > 0
          ? idem.mst_wallet_transaction[0]
          : null;
      } catch (idemErr) {
        if (
          String(idemErr?.message || "").includes("debit_status") ||
          String(idemErr?.response?.errors?.[0]?.message || "").includes(
            "debit_status",
          )
        ) {
          throw idemErr;
        }
        console.warn(
          `[postPayment][walletDebit] Ledger idempotency query failed (non-fatal):`,
          idemErr.message,
        );
        return null;
      }
    }

    async function fetchLedgerRowAnyState() {
      const idem = await client.client.request(ledgerAnyStateQuery, {
        reference: referenceStr,
        wallet_ids: walletIdsForReseller,
      });
      return idem?.mst_wallet_transaction?.[0] || null;
    }

    async function patchFinalizedLedgerContext(ledgerRow, virtualNumberIdToSet) {
      if (!ledgerRow?.id || !virtualNumberIdToSet) return;
      if (ledgerRow.virtual_number_id) return;
      try {
        await client.client.request(
          `mutation PatchOnlineWalletDebitLedgerContext(
            $id: uuid!
            $customer_id: uuid
            $virtual_number_id: uuid!
          ) {
            update_mst_wallet_transaction(
              where: {
                _and: [
                  { id: { _eq: $id } }
                  { virtual_number_id: { _is_null: true } }
                ]
              }
              _set: {
                customer_id: $customer_id
                virtual_number_id: $virtual_number_id
              }
            ) {
              affected_rows
            }
          }`,
          {
            id: ledgerRow.id,
            customer_id: customer?.id || null,
            virtual_number_id: virtualNumberIdToSet,
          },
        );
      } catch (patchErr) {
        console.warn(
          `[postPayment][walletDebit] finalized ledger context patch skipped ref=${referenceStr} ledger=${ledgerRow.id}:`,
          patchErr.message,
        );
      }
    }

    async function deleteWalletLedgerRow(ledgerId, expectedStatus = null) {
      if (!ledgerId) return false;
      try {
        if (expectedStatus) {
          const res = await client.client.request(
            `mutation DeleteWalletLedgerRowIfStatus(
              $id: uuid!
              $debit_status: String!
            ) {
              delete_mst_wallet_transaction(
                where: {
                  _and: [
                    { id: { _eq: $id } }
                    { debit_status: { _eq: $debit_status } }
                  ]
                }
              ) {
                affected_rows
              }
            }`,
            { id: ledgerId, debit_status: expectedStatus },
          );
          return (
            (res?.delete_mst_wallet_transaction?.affected_rows ?? 0) === 1
          );
        }
        await client.client.request(
          `mutation DeleteWalletLedgerRow($id: uuid!) {
            delete_mst_wallet_transaction_by_pk(id: $id) { id }
          }`,
          { id: ledgerId },
        );
        return true;
      } catch (e) {
        console.warn(
          `[postPayment][walletDebit] delete ledger row failed:`,
          e.message,
        );
        return false;
      }
    }

    async function waitWhilePeerPendingLedger(maxAttempts = 50, pollMs = 120) {
      let lastRow = null;
      for (let i = 0; i < maxAttempts; i++) {
        const row = await fetchLedgerRowAnyState();
        if (!row) return { kind: "absent" };
        lastRow = row;
        if (row.debit_status === "pending") {
          await sleep(pollMs);
          continue;
        }
        if (row.debit_status === "success" || row.debit_status == null) {
          return { kind: "finalized" };
        }
        if (row.debit_status === "failed") {
          return { kind: "failed", row };
        }
        await sleep(pollMs);
      }
      return { kind: "timeout", row: lastRow };
    }

    // The atomic database function below now owns idempotency. This legacy
    // pre-check is intentionally bypassed so retries still pass through the
    // wallet row lock instead of trusting a stale ledger-only read.
    try {
      const existingFinal = await referenceAlreadyFinalizedLedger();
      if (existingFinal) {
        await patchFinalizedLedgerContext(existingFinal, virtualNumberId || null);
        console.log(
          `[postPayment][walletDebit] Existing finalized ledger found transactionId=${transactionId} id=${existingFinal.id}; continuing through atomic DB idempotency`,
        );
      }
    } catch (idemErr) {
      if (
        String(idemErr?.message || "").includes("debit_status") ||
        String(idemErr?.response?.errors?.[0]?.message || "").includes(
          "debit_status",
        )
      ) {
        console.warn(
          `[postPayment][walletDebit] debit_status column missing — run migration add-wallet-transaction-debit-status.sql and reload Hasura:`,
          idemErr.message,
        );
        return "debit_failed";
      }
      console.warn(
        `[postPayment][walletDebit] Idempotency pre-check failed (non-fatal):`,
        idemErr.message,
      );
    }

    let resolvedVirtualNumberId = virtualNumberId || null;
    if (!resolvedVirtualNumberId) {
      try {
        const vnResolveQ = await client.client.request(
          `query ResolveVnForWalletDebit($id: uuid!) {
            mst_transaction_by_pk(id: $id) {
              virtual_number_id
              notes
            }
          }`,
          { id: transactionId },
        );
        const trow = vnResolveQ?.mst_transaction_by_pk;
        resolvedVirtualNumberId =
          trow?.virtual_number_id || trow?.notes?.virtual_number_id || null;
      } catch (resolveErr) {
        console.warn(
          `[postPayment][walletDebit] VN resolve from txn failed:`,
          resolveErr.message,
        );
      }
    }
    if (!resolvedVirtualNumberId) {
      console.log(
        `[postPayment][walletDebit] skip — no virtual_number_id for txn ${transactionId} (VN not linked yet — concurrent fulfillment or retry later)`,
      );
      return "skipped_no_vn";
    }

    const atomicDebit = await debitWalletLedgerFirst(client, {
      walletId: walletIdsForReseller[0],
      amount: pricePerNumber,
      description: "Customer online payment - virtual number assigned",
      reference: referenceStr,
      customerId: customer?.id || null,
      virtualNumberId: resolvedVirtualNumberId,
    });

    if (atomicDebit.ok) {
      console.log(
        `[postPayment][walletDebit] ATOMIC ${atomicDebit.status}: txn=${transactionId} ledger=${atomicDebit.ledgerId || "n/a"} balance ${atomicDebit.balanceBefore} -> ${atomicDebit.balanceAfter}`,
      );
      await _markTransactionWalletDebitSuccess(
        client,
        transactionId,
        atomicDebit.status,
      );
      return atomicDebit.status === "debited" ? "debited" : "already_debited";
    }

    console.error(
      `[postPayment][walletDebit] ATOMIC failed txn=${transactionId} status=${atomicDebit.status} message=${atomicDebit.message || "n/a"}`,
    );
    if (transactionId) {
      await _flagTransactionWalletDebitPending(
        client,
        transactionId,
        atomicDebit.status || "atomic_debit_failed",
      );
    }
    return atomicDebit.status === "insufficient_balance"
      ? "insufficient_balance"
      : "debit_failed";

    const walletQuery = `
      query GetResellerWalletForDebit($reseller_id: uuid!) {
        mst_wallet(
          where: { reseller_id: { _eq: $reseller_id } }
          order_by: { id: asc }
          limit: 1
        ) {
          id
          balance
          debit_amount
        }
      }
    `;

    const casMutation = `
      mutation DebitWalletCAS(
        $id: uuid!
        $balanceEq: numeric!
        $newBalance: numeric!
        $newDebitAmount: numeric!
        $ts: timestamp!
      ) {
        update_mst_wallet(
          where: {
            _and: [
              { id: { _eq: $id } }
              { balance: { _eq: $balanceEq } }
            ]
          }
          _set: {
            balance: $newBalance
            debit_amount: $newDebitAmount
            last_transaction_at: $ts
          }
        ) {
          affected_rows
          returning {
            id
            balance
            debit_amount
          }
        }
      }
    `;

    const rollbackMutation = `
      mutation RollbackWalletDebit(
        $id: uuid!
        $balanceEq: numeric!
        $debitAmountEq: numeric!
        $balance: numeric!
        $debit_amount: numeric!
        $last_transaction_at: timestamp!
      ) {
        update_mst_wallet(
          where: {
            _and: [
              { id: { _eq: $id } }
              { balance: { _eq: $balanceEq } }
              { debit_amount: { _eq: $debitAmountEq } }
            ]
          }
          _set: {
            balance: $balance
            debit_amount: $debit_amount
            last_transaction_at: $last_transaction_at
          }
        ) {
          affected_rows
          returning {
            id
            balance
            debit_amount
          }
        }
      }
    `;

    const insertPendingWalletTxnMutation = `
      mutation CreateWalletTxnOnlinePaymentPending(
        $wallet_id: uuid!
        $amount: numeric!
        $balance_before: numeric!
        $balance_after: numeric!
        $description: String
        $reference: String
        $customer_id: uuid
        $virtual_number_id: uuid
      ) {
        insert_mst_wallet_transaction_one(
          object: {
            wallet_id: $wallet_id
            transaction_type: "DEBIT"
            amount: $amount
            balance_before: $balance_before
            balance_after: $balance_after
            description: $description
            reference: $reference
            customer_id: $customer_id
            virtual_number_id: $virtual_number_id
            debit_status: "pending"
          }
        ) {
          id
        }
      }
    `;

    const finalizeWalletTxnMutation = `
      mutation FinalizeWalletDebitLedger(
        $id: uuid!
        $balance_before: numeric!
        $balance_after: numeric!
      ) {
        update_mst_wallet_transaction_by_pk(
          pk_columns: { id: $id }
          _set: {
            balance_before: $balance_before
            balance_after: $balance_after
            debit_status: "success"
          }
        ) {
          id
        }
      }
    `;

    const updatePendingWalletTxnBalancesMutation = `
      mutation RefreshPendingWalletDebitLedgerBalances(
        $id: uuid!
        $balance_before: numeric!
        $balance_after: numeric!
      ) {
        update_mst_wallet_transaction(
          where: {
            _and: [
              { id: { _eq: $id } }
              { debit_status: { _eq: "pending" } }
            ]
          }
          _set: {
            balance_before: $balance_before
            balance_after: $balance_after
          }
        ) {
          affected_rows
        }
      }
    `;

    const walletByPkQuery = `
      query GetWalletByPkForStaleDebitRecovery($id: uuid!) {
        mst_wallet_by_pk(id: $id) {
          id
          balance
          debit_amount
        }
      }
    `;

    const sameMoney = (a, b) =>
      Math.abs(_normalizeWalletNumeric(a) - _normalizeWalletNumeric(b)) <
      0.0001;

    async function recoverStalePendingLedger(ledgerRow) {
      if (!ledgerRow?.id || ledgerRow.debit_status !== "pending") {
        return { kind: "not_pending" };
      }

      const createdMs = Date.parse(ledgerRow.created_at || "");
      const stale =
        !Number.isFinite(createdMs) ||
        Date.now() - createdMs >= STALE_PENDING_WALLET_LEDGER_MS;
      if (!stale) {
        return { kind: "fresh" };
      }

      const ledgerAmount = _normalizeWalletNumeric(ledgerRow.amount);
      const ledgerBefore = _normalizeWalletNumeric(ledgerRow.balance_before);
      const ledgerAfter = _normalizeWalletNumeric(ledgerRow.balance_after);

      if (
        !sameMoney(ledgerAmount, pricePerNumber) ||
        ledgerRow.customer_id !== (customer?.id || null) ||
        ledgerRow.virtual_number_id !== resolvedVirtualNumberId
      ) {
        console.error(
          `[postPayment][walletDebit] CRITICAL: stale pending ledger does not match expected txn context ref=${referenceStr} ledger=${ledgerRow.id}`,
        );
        await _flagTransactionWalletDebitPending(
          client,
          transactionId,
          "stale_pending_wallet_ledger_context_mismatch",
        );
        return { kind: "manual_reconcile" };
      }

      const walletNowResult = await client.client.request(walletByPkQuery, {
        id: ledgerRow.wallet_id,
      });
      const walletNow = walletNowResult?.mst_wallet_by_pk;
      if (!walletNow?.id) {
        console.error(
          `[postPayment][walletDebit] CRITICAL: wallet missing during stale pending recovery wallet=${ledgerRow.wallet_id}`,
        );
        await _flagTransactionWalletDebitPending(
          client,
          transactionId,
          "stale_pending_wallet_missing",
        );
        return { kind: "manual_reconcile" };
      }

      const currentBalance = _normalizeWalletNumeric(walletNow.balance);
      if (sameMoney(currentBalance, ledgerBefore)) {
        const released = await deleteWalletLedgerRow(ledgerRow.id, "pending");
        if (released) {
          console.warn(
            `[postPayment][walletDebit] stale pending ledger released before CAS ref=${referenceStr} ledger=${ledgerRow.id}`,
          );
          return { kind: "released" };
        }
        return { kind: "race" };
      }

      if (sameMoney(currentBalance, ledgerAfter)) {
        await client.client.request(finalizeWalletTxnMutation, {
          id: ledgerRow.id,
          balance_before: ledgerBefore,
          balance_after: ledgerAfter,
        });
        console.warn(
          `[postPayment][walletDebit] stale pending ledger finalized after recovered CAS ref=${referenceStr} ledger=${ledgerRow.id}`,
        );
        return { kind: "finalized" };
      }

      console.error(
        `[postPayment][walletDebit] CRITICAL: stale pending ledger cannot be reconciled automatically ref=${referenceStr} ledger=${ledgerRow.id} walletBalance=${currentBalance} ledgerBefore=${ledgerBefore} ledgerAfter=${ledgerAfter}`,
      );
      await _flagTransactionWalletDebitPending(
        client,
        transactionId,
        "stale_pending_wallet_ledger_manual_reconcile",
      );
      return { kind: "manual_reconcile" };
    }

    let wallet = null;
    let balanceBefore = 0;
    let balanceAfter = 0;
    let existingDebitAmount = 0;
    let pendingLedgerId = null;

    const maxClaimRounds = 6;
    for (let claimRound = 0; claimRound < maxClaimRounds; claimRound++) {
      const existingRow = await fetchLedgerRowAnyState();
      if (existingRow) {
        if (
          existingRow.debit_status === "success" ||
          existingRow.debit_status == null
        ) {
          await patchFinalizedLedgerContext(existingRow, resolvedVirtualNumberId);
          return "already_debited";
        }
        if (existingRow.debit_status === "pending") {
          const waited = await waitWhilePeerPendingLedger();
          if (waited.kind === "finalized") {
            return "already_debited";
          }
          if (waited.kind === "failed" && waited.row?.id) {
            await deleteWalletLedgerRow(waited.row.id, "failed");
            continue;
          }
          if (waited.kind === "timeout") {
            const recovery = await recoverStalePendingLedger(
              waited.row || existingRow,
            );
            if (recovery.kind === "finalized") {
              return "debited";
            }
            if (
              recovery.kind === "released" ||
              recovery.kind === "race"
            ) {
              continue;
            }
            console.error(
              `[postPayment][walletDebit] CRITICAL: timeout waiting for peer pending ledger ref=${referenceStr} recovery=${recovery.kind}`,
            );
            return "debit_failed";
          }
          continue;
        }
        if (existingRow.debit_status === "failed") {
          await deleteWalletLedgerRow(existingRow.id, "failed");
          continue;
        }
      }

      const walletDataClaim = await client.client.request(walletQuery, {
        reseller_id: effectiveResellerId,
      });
      wallet = walletDataClaim?.mst_wallet?.[0];
      if (!wallet?.id) {
        console.error(
          `[postPayment][walletDebit] CRITICAL: No row in mst_wallet for reseller_id=${effectiveResellerId}`,
        );
        return "debit_failed";
      }

      balanceBefore = _normalizeWalletNumeric(wallet.balance);
      existingDebitAmount = _normalizeWalletNumeric(wallet.debit_amount);

      if (balanceBefore < pricePerNumber) {
        console.error(
          `[postPayment][walletDebit] CRITICAL: Insufficient balance for reseller ${effectiveResellerId}. ` +
            `Required: ₹${pricePerNumber.toFixed(2)}, Available: ₹${balanceBefore.toFixed(2)}`,
        );
        if (transactionId) {
          await _flagTransactionWalletDebitPending(
            client,
            transactionId,
            "insufficient_balance",
          );
        }
        return "insufficient_balance";
      }

      const provisionalAfter = balanceBefore - pricePerNumber;
      try {
        const pendRes = await client.client.request(
          insertPendingWalletTxnMutation,
          {
            wallet_id: wallet.id,
            amount: pricePerNumber,
            balance_before: balanceBefore,
            balance_after: provisionalAfter,
            description: `Customer online payment - virtual number assigned`,
            reference: referenceStr,
            customer_id: customer?.id || null,
            virtual_number_id: resolvedVirtualNumberId,
          },
        );
        pendingLedgerId =
          pendRes?.insert_mst_wallet_transaction_one?.id || null;
        if (!pendingLedgerId) {
          throw new Error("pending ledger insert returned no id");
        }
        break;
      } catch (insErr) {
        const errMsg = String(
          insErr?.message || insErr?.response?.errors?.[0]?.message || "",
        );
        if (
          errMsg.includes("duplicate key") ||
          errMsg.includes("unique constraint") ||
          errMsg.includes("Uniqueness violation") ||
          errMsg.includes("uq_wallet_txn_wallet_reference")
        ) {
          continue;
        }
        if (
          errMsg.includes("debit_status") ||
          String(insErr?.response?.errors?.[0]?.message || "").includes(
            "debit_status",
          )
        ) {
          console.error(
            `[postPayment][walletDebit] debit_status missing on pending insert — run migration and reload Hasura.`,
            insErr,
          );
          return "debit_failed";
        }
        console.error(
          `[postPayment][walletDebit] CRITICAL: pending ledger insert failed`,
          insErr,
        );
        return "debit_failed";
      }
    }

    if (!pendingLedgerId || !wallet?.id) {
      console.error(
        `[postPayment][walletDebit] CRITICAL: could not claim exclusive pending ledger for ref=${referenceStr}`,
      );
      return "debit_failed";
    }

    let casSucceeded = false;
    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt > 0) {
        try {
          const peerLedger = await referenceAlreadyFinalizedLedger();
          if (peerLedger) {
            await deleteWalletLedgerRow(pendingLedgerId, "pending");
            console.log(
              `[postPayment][walletDebit] CAS retry aborted — peer finalized ledger id=${peerLedger.id} attempt=${attempt + 1}`,
            );
            return "already_debited";
          }
        } catch (idemErr) {
          if (
            String(idemErr?.message || "").includes("debit_status") ||
            String(idemErr?.response?.errors?.[0]?.message || "").includes(
              "debit_status",
            )
          ) {
            console.warn(
              `[postPayment][walletDebit] debit_status column missing during CAS retry:`,
              idemErr.message,
            );
            await deleteWalletLedgerRow(pendingLedgerId, "pending");
            return "debit_failed";
          }
        }
      }

      const walletData = await client.client.request(walletQuery, {
        reseller_id: effectiveResellerId,
      });
      wallet = walletData?.mst_wallet?.[0];
      if (!wallet?.id) {
        await deleteWalletLedgerRow(pendingLedgerId, "pending");
        console.error(
          `[postPayment][walletDebit] CRITICAL: No row in mst_wallet for reseller_id=${effectiveResellerId}`,
        );
        return "debit_failed";
      }

      balanceBefore = _normalizeWalletNumeric(wallet.balance);
      existingDebitAmount = _normalizeWalletNumeric(wallet.debit_amount);

      console.log(
        `[postPayment][walletDebit] wallet.id=${wallet.id}, balanceBefore=${balanceBefore}, pricePerNumber=${pricePerNumber} casAttempt=${attempt + 1}`,
      );

      if (balanceBefore < pricePerNumber) {
        console.error(
          `[postPayment][walletDebit] CRITICAL: Insufficient balance for reseller ${effectiveResellerId}. ` +
            `Required: ₹${pricePerNumber.toFixed(2)}, Available: ₹${balanceBefore.toFixed(2)}`,
        );
        await deleteWalletLedgerRow(pendingLedgerId, "pending");
        if (transactionId) {
          await _flagTransactionWalletDebitPending(
            client,
            transactionId,
            "insufficient_balance",
          );
        }
        return "insufficient_balance";
      }

      balanceAfter = balanceBefore - pricePerNumber;
      const newDebitTotal = existingDebitAmount + pricePerNumber;
      const ts = new Date().toISOString();

      try {
        const refreshLedger = await client.client.request(
          updatePendingWalletTxnBalancesMutation,
          {
            id: pendingLedgerId,
            balance_before: balanceBefore,
            balance_after: balanceAfter,
          },
        );
        const refreshedRows =
          refreshLedger?.update_mst_wallet_transaction?.affected_rows ?? 0;
        if (refreshedRows !== 1) {
          const peerLedger = await referenceAlreadyFinalizedLedger();
          if (peerLedger) {
            await deleteWalletLedgerRow(pendingLedgerId, "pending");
            return "already_debited";
          }
          await deleteWalletLedgerRow(pendingLedgerId, "pending");
          console.error(
            `[postPayment][walletDebit] CRITICAL: could not refresh pending ledger before CAS ref=${referenceStr}`,
          );
          return "debit_failed";
        }
      } catch (refreshErr) {
        await deleteWalletLedgerRow(pendingLedgerId, "pending");
        console.error(
          `[postPayment][walletDebit] CRITICAL: pending ledger refresh before CAS failed`,
          refreshErr,
        );
        return "debit_failed";
      }

      const casResult = await client.client.request(casMutation, {
        id: wallet.id,
        balanceEq: balanceBefore,
        newBalance: balanceAfter,
        newDebitAmount: newDebitTotal,
        ts,
      });

      const affected = casResult?.update_mst_wallet?.affected_rows ?? 0;
      const returned = casResult?.update_mst_wallet?.returning?.[0];

      if (affected === 1 && returned) {
        casSucceeded = true;
        balanceAfter = _normalizeWalletNumeric(returned.balance);
        break;
      }

      console.warn(
        `[postPayment][walletDebit] CAS miss (attempt ${attempt + 1}) affected_rows=${affected} — check peer ledger before retry`,
      );
      try {
        const peerLedgerAfterMiss = await referenceAlreadyFinalizedLedger();
        if (peerLedgerAfterMiss) {
          await deleteWalletLedgerRow(pendingLedgerId, "pending");
          console.log(
            `[postPayment][walletDebit] CAS miss: peer finalized ledger id=${peerLedgerAfterMiss.id} — stopping`,
          );
          return "already_debited";
        }
      } catch (idemErr) {
        if (
          String(idemErr?.message || "").includes("debit_status") ||
          String(idemErr?.response?.errors?.[0]?.message || "").includes(
            "debit_status",
          )
        ) {
          console.warn(
            `[postPayment][walletDebit] debit_status missing during post-CAS idem check:`,
            idemErr.message,
          );
          await deleteWalletLedgerRow(pendingLedgerId, "pending");
          return "debit_failed";
        }
      }
    }

    if (!casSucceeded || !wallet?.id) {
      try {
        const ledgerAfterCas = await referenceAlreadyFinalizedLedger();
        if (ledgerAfterCas) {
          await deleteWalletLedgerRow(pendingLedgerId, "pending");
          console.log(
            `[postPayment][walletDebit] CAS exhausted but peer finalized ledger id=${ledgerAfterCas.id}`,
          );
          return "already_debited";
        }
      } catch (idemErr) {
        if (
          String(idemErr?.message || "").includes("debit_status") ||
          String(idemErr?.response?.errors?.[0]?.message || "").includes(
            "debit_status",
          )
        ) {
          console.warn(
            `[postPayment][walletDebit] debit_status missing after CAS exhaustion:`,
            idemErr.message,
          );
          await deleteWalletLedgerRow(pendingLedgerId, "pending");
          return "debit_failed";
        }
      }
      await deleteWalletLedgerRow(pendingLedgerId, "pending");
      console.error(
        `[postPayment][walletDebit] CRITICAL: CAS update failed after retries`,
      );
      return "debit_failed";
    }

    try {
      await client.client.request(finalizeWalletTxnMutation, {
        id: pendingLedgerId,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
      });
    } catch (finErr) {
      console.error(
        `[postPayment][walletDebit] CRITICAL: finalize ledger failed — rolling back wallet CAS`,
        finErr,
      );
      let rolledBack = false;
      try {
        const rollbackRes = await client.client.request(rollbackMutation, {
          id: wallet.id,
          balanceEq: balanceAfter,
          debitAmountEq: existingDebitAmount + pricePerNumber,
          balance: balanceBefore,
          debit_amount: existingDebitAmount,
          last_transaction_at: new Date().toISOString(),
        });
        rolledBack =
          (rollbackRes?.update_mst_wallet?.affected_rows ?? 0) === 1;
        if (rolledBack) {
          console.warn(
            `[postPayment][walletDebit] Rollback after finalize failure: balance restored toward ${balanceBefore}`,
          );
        } else {
          console.error(
            `[postPayment][walletDebit] CRITICAL: rollback CAS miss after finalize failure — leaving pending ledger for retry/manual reconciliation`,
          );
        }
      } catch (rbErr) {
        console.error(
          `[postPayment][walletDebit] CRITICAL: Rollback after finalize failure failed — manual reconciliation`,
          rbErr,
        );
      }
      if (rolledBack) {
        await deleteWalletLedgerRow(pendingLedgerId, "pending");
      }
      if (transactionId) {
        await _flagTransactionWalletDebitPending(
          client,
          transactionId,
          "ledger_finalize_failed",
        );
      }
      return "debit_failed";
    }

    try {
      const notesRes = transactionId
        ? await client.client.request(
            `query T($id: uuid!) { mst_transaction_by_pk(id: $id) { notes } }`,
            { id: transactionId },
          )
        : null;
      const isRenewal =
        notesRes?.mst_transaction_by_pk?.notes?.transaction_type === "renewal";
      const rq = await client.client.request(
        `query R($id: uuid!) { mst_reseller_by_pk(id: $id) { email phone brand_name business_name first_name last_name } }`,
        { id: effectiveResellerId },
      );
      const r = rq?.mst_reseller_by_pk;
      if (r?.email) {
        const display =
          r.brand_name ||
          r.business_name ||
          `${r.first_name || ""} ${r.last_name || ""}`.trim() ||
          r.email;
        const resellerGreetingName =
          `${r.first_name || ""} ${r.last_name || ""}`.trim() || r.email;
        const {
          sendWalletDebitNotificationEmail,
          maybeNotifyResellerLowWallet,
        } = await import("./transactionalEmail.service.js");
        await sendWalletDebitNotificationEmail({
          resellerEmail: r.email,
          resellerDisplay: display,
          amount: pricePerNumber,
          balanceAfter,
          resellerId: effectiveResellerId,
          kind: isRenewal ? "renewal" : "activation",
        });
        await maybeNotifyResellerLowWallet({
          resellerId: effectiveResellerId,
          balanceAfter,
          resellerEmail: r.email,
          resellerGreetingName,
          resellerPhone: r.phone,
          pricePerNumber,
        });
      }
    } catch (nErr) {
      console.warn(
        `[postPayment][walletDebit] debit/low-wallet notify skipped:`,
        nErr.message,
      );
    }

    console.log(
      `[postPayment][walletDebit] SUCCESS: Debited ₹${pricePerNumber.toFixed(2)} from reseller ${effectiveResellerId}. ` +
        `mst_wallet.balance: ₹${balanceBefore.toFixed(2)} → ₹${balanceAfter.toFixed(2)}`,
    );
    console.log(`[postPayment][walletDebit] --- END ---`);
    return "debited";
  } catch (walletErr) {
    console.error(
      `[postPayment][walletDebit] CRITICAL: Exception during wallet deduction — manual reconciliation required:`,
      walletErr,
    );
    return "debit_failed";
  }
}

async function updateCustomerStatusAfterPayment(
  customerId,
  resellerId,
  transactionId = null,
) {
  console.log(
    `[postPayment] CALLED — customerId=${customerId} resellerId=${resellerId} transactionId=${transactionId}`,
  );

  if (!customerId) {
    console.warn(
      "[postPayment] customerId is null — cannot complete post-payment flow",
    );
    return false;
  }

  const client = getHasuraClient();
  let createdVirtualNumberIdForRecovery = null;

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
          mst_virtual_numbers(
            where: { status: { _eq: "active" } }
            limit: 1
            order_by: { created_at: desc }
          ) {
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
          razorpay_payment_id
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

    console.log(
      `[postPayment] customer.status=${customer.status} existing_vn_count=${customer.mst_virtual_numbers?.length} reseller.price_per_number=${customer.mst_reseller?.price_per_number}`,
    );

    // ── 2. Idempotency guards ─────────────────────────────────────────────────
    const txnRecord = customerResult?.mst_transaction?.[0];
    if (
      transactionId &&
      txnRecord &&
      txnRecord.status === TRANSACTION_STATES.FAILED
    ) {
      console.warn(
        `[postPayment] Transaction ${transactionId} is failed — skipping VN and wallet fulfillment`,
      );
      return false;
    }

    // Repair invalid row: `success` without linked VN confuses STEP2 and prevents clean re-claim.
    // This must be guarded. Two webhooks can both read `success/null`; an
    // unconditional repair would overwrite a peer's fresh `processing_vn` lock.
    if (
      transactionId &&
      txnRecord &&
      txnRecord.status === TRANSACTION_STATES.SUCCESS &&
      !txnRecord.virtual_number_id &&
      txnRecord.notes?.transaction_type !== "renewal"
    ) {
      try {
        const rep = await client.client.request(
          `mutation RepairSuccessTxnWithoutVn($id: uuid!) {
            update_mst_transaction(
              where: {
                id: { _eq: $id }
                status: { _eq: "success" }
                virtual_number_id: { _is_null: true }
              }
              _set: { status: "captured" }
            ) {
              affected_rows
              returning {
                id
                status
                virtual_number_id
                notes
                razorpay_payment_id
              }
            }
          }`,
          { id: transactionId },
        );
        const repairedRow = rep?.update_mst_transaction?.returning?.[0] || null;
        if (repairedRow) {
          console.warn(
            `[postPayment] Repaired txn ${transactionId}: success→captured (virtual_number_id was null; non-renewal)`,
          );
          Object.assign(txnRecord, repairedRow);
        } else {
          const refreshed = await client.client.request(
            `query RefreshTxnAfterRepairMiss($id: uuid!) {
              mst_transaction_by_pk(id: $id) {
                id
                status
                virtual_number_id
                notes
                razorpay_payment_id
              }
            }`,
            { id: transactionId },
          );
          const latestTxn = refreshed?.mst_transaction_by_pk || null;
          if (latestTxn) {
            console.warn(
              `[postPayment] Repair skipped for txn ${transactionId}; peer state is status=${latestTxn.status} vn_id=${latestTxn.virtual_number_id || latestTxn.notes?.virtual_number_id || "null"}`,
            );
            Object.assign(txnRecord, latestTxn);
          }
        }
      } catch (re) {
        console.warn(`[postPayment] Repair success-without-VN failed:`, re.message);
      }
    }

    if (
      transactionId &&
      txnRecord?.status === "processing_vn" &&
      !txnRecord?.virtual_number_id &&
      !txnRecord?.notes?.virtual_number_id
    ) {
      console.log(
        `[postPayment] processing_vn without linked VN for txn=${transactionId}; waiting/recovering before deciding`,
      );

      const provisionalRecovered =
        await recoverProvisionalVirtualNumberForTransaction(client, {
          transactionId,
          txnRecord,
          customerId,
          resellerId,
          customer,
        });
      if (provisionalRecovered) return true;

      const recoveredTxn = await waitOrRecoverProcessingVnLock(
        client,
        transactionId,
        txnRecord?.razorpay_payment_id || null,
        null,
      );
      const recoveredVnId =
        recoveredTxn?.virtual_number_id ||
        recoveredTxn?.notes?.virtual_number_id ||
        null;

      if (recoveredVnId) {
        await finalizeOnlinePaymentWhenVnAlreadyLinked(client, {
          customerId,
          resellerId,
          transactionId,
          virtualNumberId: recoveredVnId,
          customer,
        });
        return true;
      }

      if (recoveredTxn?.status === "processing_vn") {
        console.log(
          `[postPayment] processing_vn still fresh for txn=${transactionId}; peer is still provisioning, retry can re-enter later`,
        );
        return true;
      }

      if (recoveredTxn) {
        txnRecord.status = recoveredTxn.status || txnRecord.status;
        txnRecord.virtual_number_id = recoveredTxn.virtual_number_id || null;
        txnRecord.notes = recoveredTxn.notes || txnRecord.notes;
      } else {
        txnRecord.status = "captured";
      }
      console.warn(
        `[postPayment] processing_vn lock recovered for txn=${transactionId}; continuing to VN claim`,
      );
    }

    // Guard A: transaction already has a VN linked, or carries a linked VN in notes.
    if (
      transactionId &&
      (txnRecord?.virtual_number_id || txnRecord?.notes?.virtual_number_id)
    ) {
      const isRenewal = txnRecord?.notes?.transaction_type === "renewal";
      const guardAVnId =
        txnRecord?.virtual_number_id ||
        txnRecord?.notes?.virtual_number_id ||
        null;
      if (false && txnRecord?.status === "processing_vn" && !guardAVnId) {
        console.log(
          `[postPayment] Guard A — status=processing_vn, no VN id yet — peer provisioning; skip wallet debit`,
        );
        return true;
      }
      console.log(
        `[postPayment] Guard A hit — Transaction ${transactionId} already claimed (vn_id=${txnRecord.virtual_number_id}, status=${txnRecord.status}, renewal=${isRenewal}) — skipping VN creation, attempting wallet debit`,
      );
      const debitResult = await _debitResellerWalletForOnlinePayment(
        client,
        customer,
        resellerId,
        transactionId,
        guardAVnId,
      );
      // Extend expiry only for renewal AND only if wallet debit was new (not a retry)
      if (isRenewal && debitResult === "debited") {
        const renewalVnId =
          txnRecord?.notes?.virtual_number_id || txnRecord?.virtual_number_id;
        if (renewalVnId) {
          await _extendVirtualNumberExpiry(client, renewalVnId, 360);
        }
        await _notifyRenewalPaymentSuccessAfterOnlinePayment(
          client,
          customer,
          resellerId,
          transactionId,
          renewalVnId,
        );
      }
      return true;
    }

    // Guard B: customer already has a virtual number.
    // Three cases:
    //   1. transaction_type === "renewal"          → debit wallet + extend expiry, no new VN
    //   2. transaction_type === "add_virtual_number" → bypass guard, create a new VN
    //   3. no transaction_type in notes (legacy txn) → treat as add_virtual_number ONLY
    //      when customer.status is already "active" (approved), because first-time approvals
    //      that somehow re-fire should NOT create a second VN (status would still be "pending").
    const isRenewal = txnRecord?.notes?.transaction_type === "renewal";
    const hasExistingVN = customer.mst_virtual_numbers?.length > 0;

    // Determine whether this is an add_virtual_number flow:
    // Explicit flag takes priority (set in notes when payment link is created).
    // Legacy fallback: customer is approved/active + has VN + not renewal + no explicit type.
    // "approved" is the status set on first approval; "active" is set after first VN is assigned.
    // Both are valid states for a customer who already has a VN and is adding another.
    const isAddVirtualNumber =
      txnRecord?.notes?.transaction_type === "add_virtual_number" ||
      (!isRenewal &&
        hasExistingVN &&
        (customer.status === "active" || customer.status === "approved") &&
        !txnRecord?.notes?.transaction_type);

    console.log(
      `[postPayment] hasExistingVN=${hasExistingVN} isRenewal=${isRenewal} isAddVirtualNumber=${isAddVirtualNumber} txn.notes.transaction_type=${txnRecord?.notes?.transaction_type}`,
    );

    if (hasExistingVN && !isAddVirtualNumber) {
      console.log(
        `[postPayment] Guard B hit — Customer ${customerId} already has a virtual number (status=${customer.status}, renewal=${isRenewal}) — skipping VN creation, but will attempt wallet debit`,
      );
      // Still attempt wallet debit in case it didn't run yet
      const guardBVnId =
        customer.mst_virtual_numbers?.[0]?.id ||
        txnRecord?.notes?.virtual_number_id ||
        null;
      const debitResultB = await _debitResellerWalletForOnlinePayment(
        client,
        customer,
        resellerId,
        transactionId,
        guardBVnId,
      );
      // Renewal flow: extend expiry only if wallet debit was new (not a retry)
      if (isRenewal && transactionId && debitResultB === "debited") {
        const renewalVnId =
          txnRecord?.notes?.virtual_number_id ||
          txnRecord?.virtual_number_id ||
          null;
        if (renewalVnId) {
          await _extendVirtualNumberExpiry(client, renewalVnId, 360);
        }
        await _notifyRenewalPaymentSuccessAfterOnlinePayment(
          client,
          customer,
          resellerId,
          transactionId,
          renewalVnId,
        );
      }
      return true;
    }

    // ── 3. Claim the transaction slot atomically BEFORE creating VN ──────────
    // Use a conditional UPDATE on mst_transaction as a DB-level mutex.
    // The condition: virtual_number_id IS NULL.
    // Claim from pre-fulfillment paid states: pending, authorized, captured, or legacy
    // success-without-VN (before backfill). Never claim failed / refunded / processing_vn.
    if (transactionId) {
      const claimTxnMutation = `
        mutation ClaimTransactionForVN($txn_id: uuid!) {
          update_mst_transaction(
            where: {
              id: { _eq: $txn_id }
              virtual_number_id: { _is_null: true }
              status: { _in: ["pending", "authorized", "captured", "success"] }
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

      let claimRows =
        (claimResult?.update_mst_transaction?.affected_rows ?? 0);

      if (claimRows === 0) {
        console.log(
          `[postPayment] Claim lost — transaction ${transactionId} — checking peer VN / lock recovery`,
        );
        try {
          const peerRowQ = await client.client.request(
            `query PeerTxnVn($id: uuid!) {
              mst_transaction_by_pk(id: $id) {
                virtual_number_id
                notes
                status
              }
            }`,
            { id: transactionId },
          );
          const prow = peerRowQ?.mst_transaction_by_pk;
          const peerVnId =
            prow?.virtual_number_id || prow?.notes?.virtual_number_id || null;
          if (peerVnId) {
            await finalizeOnlinePaymentWhenVnAlreadyLinked(client, {
              customerId,
              resellerId,
              transactionId,
              virtualNumberId: peerVnId,
              customer,
            });
            return true;
          }
          await waitOrRecoverProcessingVnLock(
            client,
            transactionId,
            null,
            null,
          );
          const claimRetry = await client.client.request(claimTxnMutation, {
            txn_id: transactionId,
          });
          claimRows =
            claimRetry?.update_mst_transaction?.affected_rows ?? 0;

          // Peer linked VN while we waited: claim retries get 0 rows because
          // virtual_number_id is no longer null — finalize instead of "still lost".
          if (claimRows === 0) {
            const latePeer = await client.client.request(
              `query PeerTxnVnAfterWait($id: uuid!) {
                mst_transaction_by_pk(id: $id) {
                  virtual_number_id
                  notes
                  status
                }
              }`,
              { id: transactionId },
            );
            const lp = latePeer?.mst_transaction_by_pk;
            const lateVn =
              lp?.virtual_number_id || lp?.notes?.virtual_number_id || null;
            if (lateVn) {
              console.log(
                `[postPayment] VN appeared after lock wait — completing fulfillment (txn=${transactionId}, status=${lp?.status})`,
              );
              await finalizeOnlinePaymentWhenVnAlreadyLinked(client, {
                customerId,
                resellerId,
                transactionId,
                virtualNumberId: lateVn,
                customer,
              });
              return true;
            }
          }
        } catch (peerErr) {
          console.warn(
            `[postPayment] Claim lost — peer / retry failed:`,
            peerErr.message,
          );
        }
      }

      if (claimRows === 0) {
        console.log(
          `[postPayment] Claim still lost for ${transactionId} — debit deferred (webhook retry or ops)`,
        );
        return true;
      }
      console.log(
        `[postPayment] Claim won on transaction ${transactionId} — proceeding with VN creation`,
      );
    }

    // ══════════════════════════════════════════════════════════════════════════
    // STEPS 4–7: VN CREATION PIPELINE
    //
    // INVARIANT: wallet is debited if and only if the VN record is confirmed
    //            in the database. Any failure before step 4c propagates as a
    //            thrown error — the outer catch returns false and the wallet
    //            is never touched.
    //
    // Order (never change):
    //   4a. Fetch available number from VN API  → throws = abort, no charge
    //   4b. Activate number on VN API           → throws = abort, no charge
    //   4c. Insert VN record into DB            → throws = abort, no charge
    //   5.  Debit reseller wallet               → only runs after 4c succeeds
    //   6.  Link VN to transaction (best-effort)
    //   7.  Activate customer (best-effort)
    //   8.  Send email (best-effort, never throws)
    // ══════════════════════════════════════════════════════════════════════════

    // Guard: VN creation requires a transaction to link to. Without it, we cannot
    // debit wallet or link VN — skip to avoid orphan VNs.
    if (!transactionId) {
      console.warn(
        `[postPayment] No transactionId — cannot create VN (would be orphan). Skipping VN creation.`,
      );
      return false;
    }

    // ── 4a. Fetch available number from VN API ────────────────────────────────
    // Hard failure: no VN available = no charge.
    // Final DB re-check before touching the external VN API. Razorpay can deliver
    // order.paid, payment.authorized, payment.captured, and payment_link.paid in
    // parallel; another worker may have linked the VN after this worker won the
    // transaction claim but before the API allocation below.
    const latestBeforeVnApi = await client.client.request(
      `query TxnBeforeVnApiAllocation($id: uuid!) {
        mst_transaction_by_pk(id: $id) {
          id
          status
          virtual_number_id
          notes
          razorpay_payment_id
        }
      }`,
      { id: transactionId },
    );
    const latestTxnBeforeVnApi =
      latestBeforeVnApi?.mst_transaction_by_pk || null;
    const latestLinkedVnBeforeApi =
      latestTxnBeforeVnApi?.virtual_number_id ||
      latestTxnBeforeVnApi?.notes?.virtual_number_id ||
      null;
    if (latestLinkedVnBeforeApi) {
      console.warn(
        `[postPayment] Pre-VN allocation guard: txn=${transactionId} already linked to vn=${latestLinkedVnBeforeApi}; skipping VN API allocation`,
      );
      await finalizeOnlinePaymentWhenVnAlreadyLinked(client, {
        customerId,
        resellerId,
        transactionId,
        virtualNumberId: latestLinkedVnBeforeApi,
        customer,
      });
      return true;
    }
    if (latestTxnBeforeVnApi?.status !== "processing_vn") {
      console.warn(
        `[postPayment] Pre-VN allocation guard: txn=${transactionId} status=${latestTxnBeforeVnApi?.status || "missing"}; skipping VN API allocation`,
      );
      if (latestTxnBeforeVnApi?.razorpay_payment_id) {
        await releaseRazorpayPaymentFulfillmentClaim(
          client,
          latestTxnBeforeVnApi.razorpay_payment_id,
        );
      }
      return true;
    }

    const availableRes = await VnApiClient.getAvailableNumbers();
    const availableNumbers = availableRes?.data || [];
    if (availableNumbers.length === 0) {
      throw new Error(
        "[postPayment] No virtual numbers available from VN API — aborting, wallet not debited",
      );
    }
    const virtualNumber = availableNumbers[0].number;
    console.log(`[postPayment] Got VN from API: ${virtualNumber}`);

    // ── 4b. Activate number on VN API ────────────────────────────────────────
    // Hard failure: activation error = no charge.
    const activateRes = await VnApiClient.activateNumber(virtualNumber);
    console.log(`[postPayment] VN API activate response:`, activateRes);

    // Call forwarding is best-effort: a bad forward number must NOT block VN
    // creation or wallet debit.
    const callForwardNumber =
      txnRecord?.notes?.call_forwarding_number || customer.phone || null;
    if (callForwardNumber) {
      try {
        await VnApiClient.configureCallForwarding(
          virtualNumber,
          "mobile",
          callForwardNumber,
        );
      } catch (cfErr) {
        console.warn(
          `[postPayment] Call forwarding config failed (non-fatal):`,
          cfErr.message,
        );
      }
    }

    // ── 4c. Insert VN record into DB ─────────────────────────────────────────
    // Hard failure: DB error (e.g. uniqueness violation) = no charge.
    const purchaseDate = new Date().toISOString().split("T")[0];
    const expiryDate = (() => {
      const d = new Date();
      d.setDate(d.getDate() + 360);
      return d.toISOString().split("T")[0];
    })();

    const callForwardForVN =
      txnRecord?.notes?.call_forwarding_number || customer.phone || null;
    const subscriptionPlanIdForVN =
      txnRecord?.notes?.subscription_plan_id || null;

    const createVnMutation = `
      mutation CreateVirtualNumber(
        $customer_id: uuid!
        $virtual_number: String!
        $reseller_id: uuid
        $purchase_date: date!
        $expiry_date: date!
        $call_forwarding_number: String
        $subscription_plan_id: uuid
      ) {
        insert_mst_virtual_number_one(object: {
          customer_id: $customer_id
          virtual_number: $virtual_number
          reseller_id: $reseller_id
          status: "active"
          purchase_date: $purchase_date
          expiry_date: $expiry_date
          call_forwarding_number: $call_forwarding_number
          subscription_plan_id: $subscription_plan_id
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
      call_forwarding_number: callForwardForVN,
      subscription_plan_id: subscriptionPlanIdForVN,
    });

    const vnRecord = vnResult?.insert_mst_virtual_number_one;
    if (!vnRecord?.id) {
      // DB returned null — hard failure so wallet is not debited.
      throw new Error(
        `[postPayment] DB insert returned null for VN ${virtualNumber} — aborting, wallet not debited`,
      );
    }
    console.log(
      `[postPayment] VN ${virtualNumber} (id=${vnRecord.id}) persisted in DB for customer ${customerId}`,
    );
    await patchTransactionProvisionalVirtualNumber(
      client,
      transactionId,
      vnRecord,
    );

    // ── 5. Debit reseller wallet ──────────────────────────────────────────────
    // Runs ONLY after VN is confirmed in DB (step 4c succeeded).
    // Has its own idempotency guard — safe to retry for same transactionId.
    createdVirtualNumberIdForRecovery = vnRecord.id;

    let linkedVirtualNumberId = vnRecord.id;
    if (transactionId && vnRecord.id) {
      const linkResult = await client.client.request(
        `mutation LinkVirtualNumberToTransactionOnce($txn_id: uuid!, $vn_id: uuid!) {
          update_mst_transaction(
            where: {
              id: { _eq: $txn_id }
              _or: [
                { virtual_number_id: { _is_null: true } }
                { virtual_number_id: { _eq: $vn_id } }
              ]
            }
            _set: { virtual_number_id: $vn_id, status: "success" }
          ) {
            affected_rows
            returning {
              id
              virtual_number_id
            }
          }
        }`,
        {
          txn_id: transactionId,
          vn_id: vnRecord.id,
        },
      );
      const linkRows = linkResult?.update_mst_transaction?.affected_rows ?? 0;
      const linkedRow =
        linkResult?.update_mst_transaction?.returning?.[0] || null;
      if (linkRows !== 1 || !linkedRow?.virtual_number_id) {
        const existingLink = await client.client.request(
          `query ExistingTxnVnAfterLinkMiss($id: uuid!) {
            mst_transaction_by_pk(id: $id) {
              id
              status
              virtual_number_id
            }
          }`,
          { id: transactionId },
        );
        linkedVirtualNumberId =
          existingLink?.mst_transaction_by_pk?.virtual_number_id || null;
        if (linkedVirtualNumberId && linkedVirtualNumberId !== vnRecord.id) {
          console.warn(
            `[postPayment] VN link race lost txn=${transactionId}; existing vn_id=${linkedVirtualNumberId}, new vn_id=${vnRecord.id} will not be charged`,
          );
          await suspendUnlinkedVirtualNumberAfterRace(client, {
            vnId: vnRecord.id,
            virtualNumber: vnRecord.virtual_number,
            transactionId,
          });
          await finalizeOnlinePaymentWhenVnAlreadyLinked(client, {
            customerId,
            resellerId,
            transactionId,
            virtualNumberId: linkedVirtualNumberId,
            customer,
          });
          return true;
        }
        throw new Error(
          `[postPayment] VN ${vnRecord.id} persisted but transaction ${transactionId} could not be linked; leaving processing lock for retry/ops`,
        );
      }
      console.log(
        `[postPayment] VN ${vnRecord.id} linked to transaction ${transactionId} before wallet debit`,
      );
    }

    const debitResult = await _debitResellerWalletForOnlinePayment(
      client,
      customer,
      resellerId,
      transactionId,
      linkedVirtualNumberId,
    );
    const walletOk =
      debitResult === "debited" || debitResult === "already_debited";

    // ── 6. ALWAYS link VN to transaction ─────────────────────────────────────
    // The VN row is already committed to DB and the VN API. We must link it now
    // regardless of wallet outcome. If we skip linking on debit failure the txn
    // stays in `processing_vn` with virtual_number_id=NULL — webhook retries
    // re-enter the claim. Linking the VN here prevents duplicate VN creation;
    // wallet reconciliation is handled separately via `ensureWalletDebitedForProcessedTxn`.
    if (transactionId && vnRecord.id) {
      try {
        const linkMutation = `
          mutation PatchWalletLedgerVirtualNumber(
            $vn_id: uuid!
            $reference: String!
            $customer_id: uuid
          ) {
            update_mst_wallet_transaction(
              where: {
                _and: [
                  { reference: { _eq: $reference } }
                  { transaction_type: { _eq: "DEBIT" } }
                  { virtual_number_id: { _is_null: true } }
                ]
              }
              _set: {
                virtual_number_id: $vn_id
                customer_id: $customer_id
              }
            ) {
              affected_rows
            }
          }
        `;
        await client.client.request(linkMutation, {
          vn_id: linkedVirtualNumberId,
          reference: String(transactionId),
          customer_id: customerId || null,
        });
      } catch (linkErr) {
        console.warn(
          `[postPayment] Could not link VN to transaction (non-fatal): ${linkErr.message}`,
        );
      }

    }

    // ── 7. Gate comms on wallet outcome ──────────────────────────────────────
    // VN is linked (step 6 above). If debit did not complete, flag notes and
    // skip emails/activation so the customer isn't told "your number is ready"
    // before the reseller has been charged. The debit will be retried by
    // ensureWalletDebitedForProcessedTxn on the next webhook, STEP0, or manual.
    if (!walletOk) {
      console.error(
        `[postPayment] CRITICAL: wallet not debited (outcome=${debitResult}) — VN linked but skipping activation/comms customerId=${customerId} txn=${transactionId}`,
      );
      await _flagTransactionWalletDebitPending(
        client,
        transactionId,
        debitResult,
      );
      return false;
    }

    // ── 7b. Activate customer ─────────────────────────────────────────────────
    // Best-effort: VN and wallet already committed.
    try {
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
    } catch (activateErr) {
      console.warn(
        `[postPayment] Customer activation failed (non-fatal): ${activateErr.message}`,
      );
    }

    // ── 7. Send virtual-number email (best-effort) ────────────────────────────
    try {
      const { sendVirtualNumberEmail } =
        await import("../../services/emailService.js");
      const { getResellerSmtpConfig } = await import("./smtpConfig.service.js");

      const reseller = customer.mst_reseller;
      const resellerName =
        reseller?.brand_name ||
        reseller?.business_name ||
        (reseller?.first_name
          ? `${reseller.first_name} ${reseller.last_name}`
          : null) ||
        reseller?.email ||
        "Your Provider";

      const smtpConfig = await getResellerSmtpConfig(resellerId);

      await sendVirtualNumberEmail(
        customer.email,
        customer.profile_name || customer.email,
        virtualNumber,
        resellerName,
        smtpConfig,
        {
          resellerId,
          customerId,
          forwardNumber: callForwardForVN || "",
          startDate: purchaseDate,
          endDate: expiryDate,
        },
      );

      console.log(
        `[postPayment] Virtual number email sent to ${customer.email}`,
      );

      try {
        const { sendNumberActivatedAdminEmail } =
          await import("./transactionalEmail.service.js");
        const { notifyCustomerNumberActivatedWhatsApp } =
          await import("./transactionalWhatsApp.service.js");
        if (customer.phone) {
          await notifyCustomerNumberActivatedWhatsApp({
            phone: customer.phone,
            virtualNumber,
            forwardNumber: callForwardForVN || "",
            startDate: purchaseDate,
            endDate: expiryDate,
            brandName: resellerName,
            resellerId,
          });
        }
        if (reseller?.email) {
          await sendNumberActivatedAdminEmail({
            resellerEmail: reseller.email,
            resellerDisplay: resellerName,
            customerName: customer.profile_name || customer.email,
            virtualNumber,
            forwardNumber: callForwardForVN || "",
            startDate: purchaseDate,
            endDate: expiryDate,
            resellerId,
            customerId,
          });
        }
      } catch (vnWaErr) {
        console.warn(
          `[postPayment] VN WhatsApp/admin notify skipped: ${vnWaErr.message}`,
        );
      }

      try {
        const {
          sendPaymentSuccessCustomerEmail,
          sendPaymentSuccessAdminEmail,
        } = await import("./transactionalEmail.service.js");
        let amountRupees = 0;
        let txnRef = transactionId || "";
        if (transactionId) {
          const tq = await client.client.request(
            `query TxnAmt($id: uuid!) {
              mst_transaction_by_pk(id: $id) {
                amount
                reference_number
              }
            }`,
            { id: transactionId },
          );
          const tr = tq?.mst_transaction_by_pk;
          if (tr?.amount != null) {
            amountRupees = Number(tr.amount);
          }
          if (tr?.reference_number) {
            txnRef = String(tr.reference_number);
          }
        }
        await sendPaymentSuccessCustomerEmail({
          customerEmail: customer.email,
          customerName: customer.profile_name || customer.email,
          amountRupees,
          transactionRef: txnRef,
          resellerId,
          customerId,
        });
        if (reseller?.email) {
          await sendPaymentSuccessAdminEmail({
            resellerEmail: reseller.email,
            resellerDisplay: resellerName,
            customerName: customer.profile_name || customer.email,
            amountRupees,
            resellerId,
            customerId,
          });
        }
      } catch (payMailErr) {
        console.warn(
          `[postPayment] Payment success emails skipped: ${payMailErr.message}`,
        );
      }
    } catch (emailErr) {
      // Non-fatal: payment succeeded; log and move on
      console.error(
        `[postPayment] Failed to send virtual number email: ${emailErr.message}`,
      );
    }

    await clearTransactionProvisionalVirtualNumber(client, transactionId);
    if (txnRecord?.razorpay_payment_id) {
      await releaseRazorpayPaymentFulfillmentClaim(
        client,
        txnRecord.razorpay_payment_id,
      );
    }

    return true;
  } catch (error) {
    console.error(
      `[postPayment] Error completing post-payment flow for customer ${customerId}:`,
      error.message,
    );

    // ── CRITICAL: Release the processing_vn claim so another webhook can retry ──
    // If we claimed the transaction but VN creation failed (API error, no numbers available, etc.),
    // the txn is stuck in processing_vn. Roll it back to captured so future webhooks can re-claim.
    // Once a VN row exists, keep the lock instead; rolling back would let retries allocate another VN.
    if (transactionId && !createdVirtualNumberIdForRecovery) {
      try {
        const rollbackResult = await client.client.request(
          `mutation RollbackProcessingVnClaim($txn_id: uuid!) {
            update_mst_transaction(
              where: {
                id: { _eq: $txn_id }
                status: { _eq: "processing_vn" }
                virtual_number_id: { _is_null: true }
              }
              _set: { status: "captured" }
            ) {
              affected_rows
            }
          }`,
          { txn_id: transactionId },
        );
        const rolledBack =
          rollbackResult?.update_mst_transaction?.affected_rows ?? 0;
        if (rolledBack > 0) {
          console.warn(
            `[postPayment] Rolled back processing_vn claim for txn ${transactionId} → captured (VN creation failed: ${error.message})`,
          );
        }
      } catch (rollbackErr) {
        console.error(
          `[postPayment] CRITICAL: Failed to rollback processing_vn claim for txn ${transactionId}:`,
          rollbackErr.message,
        );
      }

      // Also release the fulfillment claim so another webhook can retry
      try {
        const txnLookup = await client.client.request(
          `query GetTxnPaymentIdForClaimRelease($id: uuid!) {
            mst_transaction_by_pk(id: $id) { razorpay_payment_id }
          }`,
          { id: transactionId },
        );
        const payId = txnLookup?.mst_transaction_by_pk?.razorpay_payment_id;
        if (payId) {
          await releaseRazorpayPaymentFulfillmentClaim(client, payId);
        }
      } catch (releaseErr) {
        console.warn(`[postPayment] Could not release fulfillment claim:`, releaseErr.message);
      }
    } else if (transactionId && createdVirtualNumberIdForRecovery) {
      console.warn(
        `[postPayment] VN ${createdVirtualNumberIdForRecovery} was created before failure; keeping transaction ${transactionId} locked instead of rolling back to avoid duplicate VN allocation`,
      );
    }

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
  resellerId = null,
) {
  const client = getHasuraClient();

  const statusMap = {
    authorized: "authorized",
    captured: "captured",
    failed: "failed",
    refunded: "refunded",
  };

  const mappedStatus = statusMap[status] || status;

  const { txn: whereStatusGuardForTxnId, payment: whereStatusGuardForPaymentId } =
    whereGuardsUpdateTransactionStatus(mappedStatus);

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
        resellerIdForLookup,
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
          where: {
            id: { _eq: $transaction_id }
            ${whereStatusGuardForTxnId}
          }
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
          where: {
            razorpay_payment_id: { _eq: $razorpay_payment_id }
            ${whereStatusGuardForPaymentId}
          }
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
    console.log(
      `[processPaymentAuthorized] Transaction already exists (${existingTransaction.status}), skipping`,
    );
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
    const customer = await findCustomerByEmail(
      customerEmail,
      effectiveResellerId,
    );
    if (customer) {
      customerId = customer.id;
    }
  }

  console.log(
    `[processPaymentAuthorized] effectiveReseller=${effectiveResellerId} customerId=${customerId} email=${customerEmail} amount=${amountInRupees}`,
  );

  // Try to find and UPDATE the pending transaction (pass email for static link fallback)
  const pendingTransaction = await findPendingTransaction(
    customerId,
    amountInRupees,
    effectiveResellerId,
    orderId,
    paymentData.id,
    customerEmail,
    extractRazorpayPaymentLinkIdFromPayload(payload),
  );

  if (pendingTransaction) {
    if (!customerId && pendingTransaction.customer_id) {
      customerId = pendingTransaction.customer_id;
    }

    const updateResult = await updatePendingTransactionWithPayment(
      pendingTransaction.id,
      paymentData,
      "authorized",
    );

    if (updateResult.success) {
      // NOTE: do NOT trigger postPayment here — payment.authorized means the bank
      // has authorised but money is not yet settled. postPayment runs only on
      // payment.captured (the authoritative settled-payment event).
      return updateResult;
    }

    // update failed because transaction reached captured/success/refunded concurrently — that's fine
    console.log(
      `[processPaymentAuthorized] Update skipped (monotonic/terminal status) — payment.captured likely already handled it`,
    );
    return {
      success: true,
      message: "Transaction already processed by payment.captured",
    };
  }

  // No pending transaction found — payment.captured likely already processed this payment.
  // Do NOT create a new transaction from authorized event; it would be a duplicate.
  console.log(
    `[processPaymentAuthorized] No pending transaction found — payment.captured likely already handled pay=${paymentData.id}, skipping creation`,
  );
  return {
    success: true,
    message:
      "No pending transaction to update; payment.captured will handle it",
  };
}

/**
 * Post-capture fulfillment when mst_transaction is already in a paid terminal/pre-fulfillment
 * state (`success` legacy or `captured`) or needs renewal wallet handling.
 */
async function runStep2FulfillmentWhenTxnSuccessful(
  txnRow,
  earlyEmail,
  effectiveResellerId,
) {
  const isRenewalSuccessTxn = txnRow.notes?.transaction_type === "renewal";
  if (!txnRow.virtual_number_id || isRenewalSuccessTxn) {
    const resolvedCustomerId =
      txnRow.customer_id ||
      (earlyEmail
        ? (await findCustomerByEmail(earlyEmail, effectiveResellerId))?.id
        : null);

    if (resolvedCustomerId) {
      if (!txnRow.virtual_number_id) {
        console.log(
          `[processPaymentCaptured] STEP2 txn status=${txnRow.status} — VN not linked yet — running postPayment`,
        );
      } else {
        console.log(
          `[processPaymentCaptured] STEP2 txn status=${txnRow.status}, renewal with VN pre-linked — running postPayment for wallet debit + expiry`,
        );
      }
      await updateCustomerStatusAfterPayment(
        resolvedCustomerId,
        effectiveResellerId,
        txnRow.id,
      );
    }
  } else {
    const hc = getHasuraClient();
    const resolvedCustomerId =
      txnRow.customer_id ||
      (earlyEmail
        ? (await findCustomerByEmail(earlyEmail, effectiveResellerId))?.id
        : null);
    if (resolvedCustomerId) {
      await _ensureWalletDebitedForProcessedTxn(hc, {
        resellerId: txnRow.reseller_id,
        customerId: resolvedCustomerId,
        transactionId: txnRow.id,
        virtualNumberId: txnRow.virtual_number_id,
      });
    }
    console.log(
      `[processPaymentCaptured] STEP2 txn status=${txnRow.status} and VN already linked (vn_id=${txnRow.virtual_number_id}) — wallet ensure only (Razorpay retry)`,
    );
  }
}

/**
 * Process payment.captured event (and payment_link.paid when not skipped by controller).
 * NOTE: Razorpay sends BOTH payment.captured AND payment_link.paid for payment-link flows.
 * The controller skips payment_link.paid when a transaction with this payment_id exists,
 * so only one code path runs. The claim guard in postPayment prevents duplicate VN creation
 * if both events were ever to reach here concurrently.
 *
 * @param {string} resellerId - Reseller UUID
 * @param {object} payload - Webhook payload
 * @returns {Promise<object>}
 */
export async function processPaymentCaptured(resellerId, payload) {
  const {
    paymentData: normalizedPayment,
    effectiveResellerId: normalizedResellerId,
  } = normalizePaymentDataFromPayload(payload);
  const paymentData = normalizedPayment ?? payload.payload?.payment?.entity;
  const eventId = payload.event_id || payload.id; // Razorpay event ID

  if (!paymentData) {
    return {
      success: false,
      message: "Invalid payment data in webhook payload",
    };
  }

  // Use notes.reseller_id as the authoritative reseller (from payment or payment_link)
  const effectiveResellerId =
    paymentData.notes?.reseller_id || normalizedResellerId || resellerId;

  // Extract email early — needed across all steps for static payment link matching
  const earlyEmail =
    paymentData.email ||
    paymentData.notes?.email ||
    paymentData.notes?.customer_email ||
    null;

  const razorpayPaymentLinkId =
    extractRazorpayPaymentLinkIdFromPayload(payload);

  console.log(
    `[processPaymentCaptured] Processing payment ${paymentData.id}, Event: ${eventId}, effectiveReseller: ${effectiveResellerId}, email: ${earlyEmail}, payment_link_id: ${razorpayPaymentLinkId || "n/a"}, notes: ${JSON.stringify(paymentData.notes)}`,
  );

  // ========================================
  // STEP 1: IDEMPOTENCY CHECK (Event-based)
  // ========================================
  if (eventId) {
    const alreadyProcessed = await isWebhookEventProcessed(
      eventId,
      effectiveResellerId,
    );
    if (alreadyProcessed) {
      const existing = await transactionExists(
        paymentData.id,
        paymentData.order_id || null,
      );
      console.log(
        `[IDEMPOTENCY] Event ${eventId} already processed, returning existing transaction`,
      );
      return {
        success: true,
        data: existing,
        message: "Webhook event already processed (idempotency)",
      };
    }
  }

  // ========================================
  // STEP 1b: PAYMENT-SCOPED FULFILLMENT CLAIM (single worker per Razorpay payment)
  // ========================================
  if (paymentData.id) {
    const hcForClaim = getHasuraClient();
    const claim = await tryClaimRazorpayPaymentFulfillment(
      hcForClaim,
      paymentData.id,
      effectiveResellerId,
    );
    if (!claim.won && !claim.skipped) {
      return await handleLostRazorpayPaymentFulfillmentClaim({
        paymentData,
        effectiveResellerId,
        eventId,
        payload,
      });
    }
  }

  // ========================================
  // STEP 0: PAYMENT-ID EARLY EXIT (after claim — avoids double wallet debit on concurrent webhooks)
  // ========================================
  if (paymentData.id) {
    const existingByPayment = await transactionExists(
      paymentData.id,
      paymentData.order_id || null,
    );
    if (existingByPayment?.virtual_number_id) {
      const hc = getHasuraClient();
      await _ensureWalletDebitedForProcessedTxn(hc, {
        resellerId: existingByPayment.reseller_id,
        customerId: existingByPayment.customer_id,
        transactionId: existingByPayment.id,
        virtualNumberId: existingByPayment.virtual_number_id,
      });
      if (eventId) {
        await maybeRecordWebhookEventIfTerminal({
          eventId,
          resellerId: effectiveResellerId,
          paymentId: paymentData.id,
          orderId: paymentData.order_id || null,
          payload,
        });
      }
      console.log(
        `[processPaymentCaptured] STEP0 Payment ${paymentData.id} already has VN linked (vn_id=${existingByPayment.virtual_number_id}) — early exit after wallet ensure`,
      );
      return {
        success: true,
        data: existingByPayment,
        message: "Payment already fully processed (VN linked)",
      };
    }
  }

  // ========================================
  // STEP 2: CHECK IF TRANSACTION EXISTS - UPDATE STATUS IF NEEDED
  // ========================================
  const step2OrderId = paymentData.order_id || null;
  if (paymentData.id || step2OrderId) {
    let existingTransaction = await transactionExists(
      paymentData.id,
      step2OrderId,
    );
    if (existingTransaction) {
      console.log(
        `[processPaymentCaptured] STEP2 found existing txn=${existingTransaction.id} status=${existingTransaction.status} customer_id=${existingTransaction.customer_id}`,
      );

      if (
        existingTransaction.status === "processing_vn" &&
        !existingTransaction.virtual_number_id
      ) {
        const hcStep2 = getHasuraClient();
        const afterLock = await waitOrRecoverProcessingVnLock(
          hcStep2,
          existingTransaction.id,
          paymentData.id || null,
          step2OrderId,
        );
        if (afterLock?.virtual_number_id && afterLock.customer_id) {
          await _ensureWalletDebitedForProcessedTxn(hcStep2, {
            resellerId: afterLock.reseller_id,
            customerId: afterLock.customer_id,
            transactionId: afterLock.id,
            virtualNumberId: afterLock.virtual_number_id,
          });
          const merged = await transactionExists(
            paymentData.id,
            step2OrderId,
          );
          if (eventId) {
            await maybeRecordWebhookEventIfTerminal({
              eventId,
              resellerId: effectiveResellerId,
              paymentId: paymentData.id,
              orderId: step2OrderId,
              payload,
            });
          }
          return {
            success: true,
            data: merged || afterLock,
            message: "VN fulfillment completed after processing_vn wait",
          };
        }
        const refetched = await transactionExists(
          paymentData.id,
          step2OrderId,
        );
        if (refetched) existingTransaction = refetched;
        if (
          existingTransaction.status === "processing_vn" &&
          !existingTransaction.virtual_number_id
        ) {
          // CRITICAL FIX: Check if wallet is already debited for this txn.
          // If so, a previous attempt partially succeeded but failed to create VN.
          // We MUST continue with VN creation, not return early.
          const hcCheck = getHasuraClient();
          const walletCheckQ = await hcCheck.client.request(
            `query CheckWalletLedgerForTxn($ref: String!) {
              mst_wallet_transaction(
                where: { reference: { _eq: $ref }, debit_status: { _eq: "success" } }
                limit: 1
              ) { id }
            }`,
            { ref: existingTransaction.id },
          );
          const walletAlreadyDebited = (walletCheckQ?.mst_wallet_transaction?.length || 0) > 0;

          if (walletAlreadyDebited) {
            console.warn(
              `[processPaymentCaptured] STEP2 CORRUPT STATE: txn=${existingTransaction.id} has wallet debited but no VN — forcing lock release to continue fulfillment`,
            );
            // Force release the processing_vn lock back to captured
            await hcCheck.client.request(
              `mutation ForceReleaseCorruptVnLock($id: uuid!) {
                update_mst_transaction_by_pk(
                  pk_columns: { id: $id }
                  _set: { status: "captured" }
                ) { id }
              }`,
              { id: existingTransaction.id },
            );
            existingTransaction.status = "captured";

            // CRITICAL: Also release the payment fulfillment claim so VN creation can proceed
            if (paymentData.id) {
              await releaseRazorpayPaymentFulfillmentClaim(hcCheck, paymentData.id);
              console.log(
                `[processPaymentCaptured] STEP2 CORRUPT STATE: released fulfillment claim for pay=${paymentData.id}`,
              );
            }
            // Fall through to continue with fulfillment below
          } else {
            console.log(
              `[processPaymentCaptured] STEP2 txn=${existingTransaction.id} still processing_vn — peer active or fresh lock, returning early`,
            );
            return {
              success: true,
              data: existingTransaction,
              message: "VN fulfillment already in progress (processing_vn)",
            };
          }
        }
      }

      // If not yet terminal `success` (VN linked), apply capture fields and run fulfillment.
      if (existingTransaction.status !== "success") {
        const updateResult = await updateTransactionStatus(
          paymentData.id,
          "captured",
          null,
          existingTransaction.id,
          paymentData,
          effectiveResellerId,
        );

        if (!updateResult.success) {
          for (let attempt = 0; attempt < 2; attempt++) {
            if (attempt > 0) await sleep(200);
            const refreshed = await transactionExists(
              paymentData.id,
              step2OrderId,
            );
            if (refreshed?.status === "processing_vn") {
              // CRITICAL FIX: Check if wallet is already debited but VN not created
              const hcRecovery = getHasuraClient();
              const walletCheckRecovery = await hcRecovery.client.request(
                `query CheckWalletLedgerForTxnRecovery($ref: String!) {
                  mst_wallet_transaction(
                    where: { reference: { _eq: $ref }, debit_status: { _eq: "success" } }
                    limit: 1
                  ) { id }
                }`,
                { ref: refreshed.id },
              );
              const walletDebitedRecovery = (walletCheckRecovery?.mst_wallet_transaction?.length || 0) > 0;

              if (walletDebitedRecovery && !refreshed.virtual_number_id) {
                console.warn(
                  `[processPaymentCaptured] STEP2 recovery CORRUPT STATE: txn=${refreshed.id} has wallet debited but no VN — forcing lock release and running fulfillment`,
                );
                // Force release the processing_vn lock back to captured
                await hcRecovery.client.request(
                  `mutation ForceReleaseCorruptVnLockRecovery($id: uuid!) {
                    update_mst_transaction_by_pk(
                      pk_columns: { id: $id }
                      _set: { status: "captured" }
                    ) { id }
                  }`,
                  { id: refreshed.id },
                );

                // CRITICAL: Also release the payment fulfillment claim so VN creation can proceed
                if (paymentData.id) {
                  await releaseRazorpayPaymentFulfillmentClaim(hcRecovery, paymentData.id);
                  console.log(
                    `[processPaymentCaptured] STEP2 recovery CORRUPT STATE: released fulfillment claim for pay=${paymentData.id}`,
                  );
                }
                // Run fulfillment directly with the corrected transaction
                const correctedTxn = { ...refreshed, status: "captured" };
                console.log(
                  `[processPaymentCaptured] STEP2 recovery: running fulfillment after corrupt state fix for txn=${correctedTxn.id}`,
                );
                await runStep2FulfillmentWhenTxnSuccessful(
                  correctedTxn,
                  earlyEmail,
                  effectiveResellerId,
                );
                if (eventId) {
                  await maybeRecordWebhookEventIfTerminal({
                    eventId,
                    resellerId: effectiveResellerId,
                    paymentId: paymentData.id,
                    orderId: step2OrderId,
                    payload,
                  });
                }
                return {
                  success: true,
                  data: correctedTxn,
                  message: "Payment processed (recovered from corrupt wallet-debited-no-VN state)",
                };
              }

              console.log(
                `[processPaymentCaptured] STEP2 recovery: txn=${refreshed.id} is processing_vn — peer owns VN fulfillment`,
              );
              return {
                success: true,
                data: refreshed,
                message: "VN fulfillment already in progress (processing_vn)",
                idempotentNoop: true,
              };
            }
            if (
              refreshed?.status === "success" ||
              (refreshed?.status === "captured" &&
                !refreshed?.virtual_number_id)
            ) {
              console.log(
                `[processPaymentCaptured] STEP2 recovery: txn=${refreshed.id} status=${refreshed.status} after concurrent update — running fulfillment`,
              );
              await runStep2FulfillmentWhenTxnSuccessful(
                refreshed,
                earlyEmail,
                effectiveResellerId,
              );
              if (eventId) {
                await maybeRecordWebhookEventIfTerminal({
                  eventId,
                  resellerId: effectiveResellerId,
                  paymentId: paymentData.id,
                  orderId: step2OrderId,
                  payload,
                });
              }
              return {
                success: true,
                data: refreshed,
                message:
                  "Payment processed (recovered after concurrent status update)",
                idempotentNoop: true,
              };
            }
          }
        }

        const rowAfterUpdate =
          updateResult.success && updateResult.data
            ? { ...existingTransaction, ...updateResult.data }
            : existingTransaction;

        let resolvedCustomerId = rowAfterUpdate.customer_id;
        if (!resolvedCustomerId && earlyEmail) {
          const cust = await findCustomerByEmail(
            earlyEmail,
            effectiveResellerId,
          );
          if (cust) resolvedCustomerId = cust.id;
        }

        const isRenewalTxn =
          rowAfterUpdate.notes?.transaction_type === "renewal";
        if (updateResult.success && resolvedCustomerId) {
          if (rowAfterUpdate.virtual_number_id && !isRenewalTxn) {
            const hc = getHasuraClient();
            await _ensureWalletDebitedForProcessedTxn(hc, {
              resellerId: rowAfterUpdate.reseller_id,
              customerId: resolvedCustomerId,
              transactionId: rowAfterUpdate.id,
              virtualNumberId: rowAfterUpdate.virtual_number_id,
            });
            console.log(
              `[processPaymentCaptured] STEP2 VN already linked (vn_id=${rowAfterUpdate.virtual_number_id}) — wallet ensure only (non-renewal retry)`,
            );
          } else {
            await updateCustomerStatusAfterPayment(
              resolvedCustomerId,
              effectiveResellerId,
              rowAfterUpdate.id,
            );
          }
        } else if (updateResult.success && !resolvedCustomerId) {
          console.warn(
            `[processPaymentCaptured] STEP2 could not resolve customer_id — post-payment skipped`,
          );
        }

        if (eventId && updateResult.success) {
          await maybeRecordWebhookEventIfTerminal({
            eventId,
            resellerId: effectiveResellerId,
            paymentId: paymentData.id,
            orderId: step2OrderId,
            payload,
          });
        }

        if (updateResult.success) {
          return {
            success: true,
            data: rowAfterUpdate,
            message: "Transaction updated from webhook (captured)",
          };
        }
        return updateResult;
      }

      // Paid (legacy success without VN, or success with VN for wallet ensure-only retry)
      await runStep2FulfillmentWhenTxnSuccessful(
        existingTransaction,
        earlyEmail,
        effectiveResellerId,
      );

      if (eventId) {
        await maybeRecordWebhookEventIfTerminal({
          eventId,
          resellerId: effectiveResellerId,
          paymentId: paymentData.id,
          orderId: step2OrderId,
          payload,
        });
      }
      return {
        success: true,
        data: existingTransaction,
        message:
          "Transaction already recorded as paid (success); ran fulfillment or wallet ensure",
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

  console.log(
    `[processPaymentCaptured] STEP3 effectiveReseller=${effectiveResellerId} customerId=${customerId} email=${customerEmail} amount=${amountInRupees} orderId=${orderId}`,
  );

  // Fallback: Find customer UUID by email if not in notes
  if (!customerId && customerEmail) {
    const customer = await findCustomerByEmail(
      customerEmail,
      effectiveResellerId,
    );
    if (customer) {
      customerId = customer.id;
      console.log(
        `[processPaymentCaptured] Resolved customerId=${customerId} from email`,
      );
    }
  }

  // ========================================
  // STEP 4: UPDATE PENDING TRANSACTION
  // ========================================
  let result = null;
  let transactionId = null;

  // Try to find pending transaction by payment_link id, order_id, customer_id, or customer_email
  const pendingTransaction = await findPendingTransaction(
    customerId,
    amountInRupees,
    effectiveResellerId,
    orderId,
    paymentData.id,
    customerEmail,
    razorpayPaymentLinkId,
  );

  if (pendingTransaction) {
    // If customer_id wasn't found earlier, get it from pending transaction
    if (!customerId && pendingTransaction.customer_id) {
      customerId = pendingTransaction.customer_id;
    }

    const updateResult = await updatePendingTransactionWithPayment(
      pendingTransaction.id,
      paymentData,
      "captured",
    );

    if (updateResult.success) {
      result = updateResult;
      transactionId = pendingTransaction.id;

      // Trigger full post-payment flow (virtual number + customer activation + email)
      if (customerId) {
        await updateCustomerStatusAfterPayment(
          customerId,
          effectiveResellerId,
          pendingTransaction.id,
        );
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
      console.log(
        `[RACE CONDITION] Transaction created by concurrent webhook, returning it`,
      );

      // If the race-found txn is processing_vn another handler owns VN creation — do not interfere.
      if (finalCheck.status === "processing_vn") {
        console.log(
          `[processPaymentCaptured] STEP5 race txn=${finalCheck.id} is processing_vn — concurrent VN fulfillment owns it, returning early`,
        );
        return {
          success: true,
          data: finalCheck,
          message: "VN fulfillment already in progress (processing_vn)",
        };
      }

      // Ensure post-payment ran on the found transaction.
      // For renewals: VN is pre-linked but postPayment still needed for wallet debit + expiry extension.
      // For initial payments: skip if VN already linked (prevents duplicate VN).
      const isRenewalRaceTxn = finalCheck.notes?.transaction_type === "renewal";
      if (!finalCheck.virtual_number_id || isRenewalRaceTxn) {
        const resolvedCustomerId =
          finalCheck.customer_id ||
          (earlyEmail
            ? (await findCustomerByEmail(earlyEmail, effectiveResellerId))?.id
            : null);
        if (resolvedCustomerId) {
          await updateCustomerStatusAfterPayment(
            resolvedCustomerId,
            effectiveResellerId,
            finalCheck.id,
          );
        }
      } else {
        const hc = getHasuraClient();
        const resolvedCustomerId =
          finalCheck.customer_id ||
          (earlyEmail
            ? (await findCustomerByEmail(earlyEmail, effectiveResellerId))?.id
            : null);
        if (resolvedCustomerId) {
          await _ensureWalletDebitedForProcessedTxn(hc, {
            resellerId: finalCheck.reseller_id,
            customerId: resolvedCustomerId,
            transactionId: finalCheck.id,
            virtualNumberId: finalCheck.virtual_number_id,
          });
        }
        console.log(
          `[processPaymentCaptured] STEP5 race-condition path — VN already linked (vn_id=${finalCheck.virtual_number_id}) — wallet ensure only (non-renewal retry)`,
        );
      }
      if (eventId) {
        await maybeRecordWebhookEventIfTerminal({
          eventId,
          resellerId: effectiveResellerId,
          paymentId: paymentData.id,
          orderId,
          payload,
        });
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
    result = await createTransactionFromWebhook(
      effectiveResellerId,
      { ...paymentData, status: "captured" },
      { preResolvedCustomerId: customerId },
    );
    transactionId = result.data?.id;
  }

  // ========================================
  // STEP 7: RECORD EVENT (Idempotency) — only when terminal (VN linked or failed/refunded)
  // ========================================
  if (eventId && paymentData.id) {
    await maybeRecordWebhookEventIfTerminal({
      eventId,
      resellerId: effectiveResellerId,
      paymentId: paymentData.id,
      orderId: paymentData.order_id || orderId,
      payload,
    });
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
  console.log(
    `[processPaymentFailed] Processing payment ${paymentData.id} effectiveReseller=${effectiveResellerId}`,
  );

  // CRITICAL: Check if transaction already exists by payment ID FIRST
  // This prevents race conditions where multiple webhooks arrive simultaneously
  if (paymentData.id) {
    const existingTransaction = await transactionExists(paymentData.id);
    if (existingTransaction) {
      console.log(
        `[PRIORITY 0] Transaction already exists for payment ${paymentData.id}, updating status to failed`,
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
        effectiveResellerId,
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
    const customer = await findCustomerByEmail(
      customerEmail,
      effectiveResellerId,
    );
    if (customer) {
      customerId = customer.id;
    }
  }

  console.log(
    `[processPaymentFailed] Customer: ${customerId}, Email: ${customerEmail}, Amount: ${amountInRupees}`,
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
      customerEmail,
      extractRazorpayPaymentLinkIdFromPayload(payload),
    );
    if (pendingTransaction) {
      console.log(
        `[UPDATE] Found pending transaction ${pendingTransaction.transaction_number}, updating with failure details`,
      );
      const updateResult = await updatePendingTransactionWithPayment(
        pendingTransaction.id,
        { ...paymentData, error_description: failureReason },
        "failed",
      );

      if (updateResult.success) {
        return updateResult;
      } else {
        console.error(
          `[ERROR] Failed to update pending transaction, will create new one: ${updateResult.message}`,
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
  const created = await createTransactionFromWebhook(effectiveResellerId, {
    ...paymentData,
    status: "failed",
    error_description: failureReason,
  });

  const isRenewal = paymentData.notes?.transaction_type === "renewal";
  let vnForRenewalFail = "";
  if (isRenewal && customerId) {
    try {
      const hc = getHasuraClient();
      const vnq = await hc.client.request(
        `query V($cid: uuid!) {
          mst_virtual_number(where: { customer_id: { _eq: $cid } }, limit: 1, order_by: { created_at: desc }) {
            virtual_number
          }
        }`,
        { cid: customerId },
      );
      vnForRenewalFail = vnq?.mst_virtual_number?.[0]?.virtual_number || "";
    } catch (_) {}
  }

  if (customerEmail && effectiveResellerId) {
    try {
      const {
        sendPaymentFailedCustomerEmail,
        sendRenewalPaymentFailedCustomerEmail,
        sendPaymentFailedAdminEmail,
        sendRenewalPaymentFailedAdminEmail,
      } = await import("./transactionalEmail.service.js");
      let custName = customerEmail;
      let resellerRow = null;
      if (customerId) {
        const hc = getHasuraClient();
        const cq = await hc.client.request(
          `query C($id: uuid!) {
            mst_customer_by_pk(id: $id) { profile_name email mst_reseller { id email brand_name business_name first_name last_name } }
          }`,
          { id: customerId },
        );
        const c = cq?.mst_customer_by_pk;
        if (c?.profile_name) custName = c.profile_name;
        resellerRow = c?.mst_reseller;
      } else {
        const hc = getHasuraClient();
        const rq = await hc.client.request(
          `query R($id: uuid!) {
            mst_reseller_by_pk(id: $id) { id email brand_name business_name first_name last_name }
          }`,
          { id: effectiveResellerId },
        );
        resellerRow = rq?.mst_reseller_by_pk;
      }
      if (isRenewal) {
        await sendRenewalPaymentFailedCustomerEmail({
          customerEmail,
          customerName: custName,
          virtualNumber: vnForRenewalFail,
          resellerId: effectiveResellerId,
          customerId: customerId || null,
        });
      } else {
        await sendPaymentFailedCustomerEmail({
          customerEmail,
          customerName: custName,
          resellerId: effectiveResellerId,
          customerId: customerId || null,
        });
      }
      if (resellerRow?.email) {
        const rname =
          resellerRow.brand_name ||
          resellerRow.business_name ||
          `${resellerRow.first_name || ""} ${resellerRow.last_name || ""}`.trim() ||
          resellerRow.email;
        if (isRenewal) {
          await sendRenewalPaymentFailedAdminEmail({
            resellerEmail: resellerRow.email,
            resellerDisplay: rname,
            customerName: custName,
            amountRupees: amountInRupees,
            failureReason: failureReason,
            resellerId: effectiveResellerId,
            customerId: customerId || null,
          });
        } else {
          await sendPaymentFailedAdminEmail({
            resellerEmail: resellerRow.email,
            resellerDisplay: rname,
            customerName: custName,
            amountRupees: amountInRupees,
            failureReason: failureReason,
            resellerId: effectiveResellerId,
            customerId: customerId || null,
          });
        }
      }
    } catch (e) {
      console.warn(
        `[processPaymentFailed] Failure email skipped: ${e.message}`,
      );
    }
  }

  return created;
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
    `Refund ID: ${refundData.id}`,
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
  const effectiveResellerId =
    paymentData?.notes?.reseller_id ||
    orderData?.notes?.reseller_id ||
    resellerId;

  // If payment data exists, process as captured payment
  if (paymentData) {
    console.log(
      `[processOrderPaid] Processing payment ${paymentData.id} effectiveReseller=${effectiveResellerId}`,
    );

    // Check if transaction already exists by payment ID FIRST
    if (paymentData.id) {
      const existingTransaction = await transactionExists(paymentData.id);
      if (existingTransaction) {
        console.log(
          `[DUPLICATE] Transaction exists for ${paymentData.id}, skipping`,
        );
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
      const customer = await findCustomerByEmail(
        customerEmail,
        effectiveResellerId,
      );
      if (customer) customerId = customer.id;
    }

    console.log(
      `[processOrderPaid] Customer: ${customerId}, Amount: ${amountInRupees}`,
    );

    // Try to find and UPDATE the pending transaction
    let pendingTransaction = null;
    if (customerId || customerEmail) {
      pendingTransaction = await findPendingTransaction(
        customerId,
        amountInRupees,
        effectiveResellerId,
        paymentData.order_id || null,
        null,
        customerEmail,
        extractRazorpayPaymentLinkIdFromPayload(payload),
      );
      if (pendingTransaction) {
        if (!customerId && pendingTransaction.customer_id)
          customerId = pendingTransaction.customer_id;
        console.log(
          `[UPDATE] Found pending transaction ${pendingTransaction.transaction_number}, updating`,
        );
        const updateResult = await updatePendingTransactionWithPayment(
          pendingTransaction.id,
          { ...paymentData, order_id: orderData?.id },
          "captured",
        );

        if (updateResult.success) {
          // NOTE: do NOT trigger postPayment here — order.paid fires concurrently with
          // payment.captured. postPayment runs only on payment.captured to avoid
          // duplicate virtual number creation and emails.
          return updateResult;
        } else {
          console.error(
            `[ERROR] Failed to update pending transaction: ${updateResult.message}`,
          );
        }
      }
    }

    // Final check before creating — also check by order_id for timing races
    const finalCheck = await transactionExists(
      paymentData.id,
      paymentData.order_id || orderData?.id,
    );
    if (finalCheck) {
      console.log(
        `[RACE CONDITION] Transaction already exists for ${paymentData.id}, skipping`,
      );
      return {
        success: true,
        data: finalCheck,
        message: "Transaction created by concurrent webhook",
      };
    }

    // order.paid should NOT create new transactions — payment.captured is the
    // authoritative handler for new transaction creation. If no pending transaction
    // was found, payment.captured will handle it.
    console.log(
      `[processOrderPaid] No pending transaction found — payment.captured will handle creation for ${paymentData.id}`,
    );
    return {
      success: true,
      message:
        "No pending transaction to update; payment.captured will handle it",
    };
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
    paymentData.notes?.reseller_id ||
    subscriptionData?.notes?.reseller_id ||
    resellerId;
  if (effectiveResellerId !== resellerId) {
    console.log(
      `[processSubscriptionCharged] Using notes.reseller_id=${effectiveResellerId} (webhook URL reseller=${resellerId})`,
    );
  }

  console.log(
    `[processSubscriptionCharged] Processing payment ${paymentData.id}`,
  );

  // Check if transaction already exists by payment ID FIRST
  if (paymentData.id) {
    const existingTransaction = await transactionExists(paymentData.id);
    if (existingTransaction) {
      console.log(
        `[DUPLICATE] Transaction exists for ${paymentData.id}, skipping`,
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
    const customer = await findCustomerByEmail(
      customerEmail,
      effectiveResellerId,
    );
    if (customer) {
      customerId = customer.id;
    }
  }

  console.log(
    `[processSubscriptionCharged] Customer: ${customerId}, Amount: ${amountInRupees}`,
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
      customerEmail,
      extractRazorpayPaymentLinkIdFromPayload(payload),
    );
    if (pendingTransaction) {
      console.log(
        `[UPDATE] Found pending transaction ${pendingTransaction.transaction_number}, updating with payment details`,
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
        "captured",
      );

      if (updateResult.success) {
        // Trigger full post-payment flow (virtual number + activation + email)
        await updateCustomerStatusAfterPayment(
          customerId,
          effectiveResellerId,
          pendingTransaction.id,
        );
        return updateResult;
      } else {
        console.error(
          `[ERROR] Failed to update pending transaction, will create new one: ${updateResult.message}`,
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
          first_name
          last_name
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
      (t) => t.status === "success" || t.status === "captured",
    );
    const failedTransactions = transactions.filter(
      (t) => t.status === "failed",
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
      fulfillment_in_progress: mst_transaction_aggregate(
        where: { status: { _in: ["captured", "processing_vn"] } }
      ) {
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
        fulfillment_in_progress_count:
          result.fulfillment_in_progress?.aggregate?.count || 0,
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
        `[cleanupDuplicates] No duplicates found for customer ${customerId}`,
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
            t.status === "captured",
        );

        // If we have both pending and successful transactions, delete the pending ones
        if (pendingTxns.length > 0 && successfulTxns.length > 0) {
          console.log(
            `[cleanupDuplicates] Found ${pendingTxns.length} pending + ${successfulTxns.length} successful transactions for amount ${group[0].amount}`,
          );
          transactionsToDelete.push(...pendingTxns);
        }
        // If we have multiple pending transactions (edge case), keep the newest one
        else if (pendingTxns.length > 1) {
          const sorted = pendingTxns.sort(
            (a, b) => new Date(b.created_at) - new Date(a.created_at),
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
                (a, b) => new Date(a.created_at) - new Date(b.created_at),
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
      `[cleanupDuplicates] Deleted ${deleteResult.delete_mst_transaction.affected_rows} duplicate transaction(s)`,
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
