/**
 * Transaction status values used with Razorpay webhooks and mst_transaction.
 * Keep in sync with DB and Hasura metadata.
 */
export const TRANSACTION_STATES = {
  PENDING: "pending",
  AUTHORIZED: "authorized",
  PROCESSING_VN: "processing_vn",
  SUCCESS: "success",
  FAILED: "failed",
  REFUNDED: "refunded",
};

export const TERMINAL_STATES = [
  TRANSACTION_STATES.SUCCESS,
  TRANSACTION_STATES.FAILED,
  TRANSACTION_STATES.REFUNDED,
];

/** Statuses allowed to claim VN creation (payment captured but VN not yet linked). */
export const CLAIMABLE_FOR_VN_STATUSES = [
  TRANSACTION_STATES.PENDING,
  TRANSACTION_STATES.AUTHORIZED,
  TRANSACTION_STATES.SUCCESS,
];

/**
 * @param {string} fromStatus
 * @param {string} toStatus
 * @param {{ allowRefund?: boolean }} [opts] - refund transition from success
 * @returns {{ ok: boolean, reason?: string }}
 */
export function validateTransition(fromStatus, toStatus, opts = {}) {
  if (!fromStatus || !toStatus) {
    return { ok: false, reason: "missing status" };
  }
  if (fromStatus === toStatus) {
    return { ok: true };
  }
  if (
    fromStatus === TRANSACTION_STATES.SUCCESS ||
    fromStatus === TRANSACTION_STATES.REFUNDED
  ) {
    if (toStatus === TRANSACTION_STATES.REFUNDED && opts.allowRefund) {
      return { ok: true };
    }
    if (toStatus === TRANSACTION_STATES.FAILED) {
      return {
        ok: false,
        reason: `invalid transition ${fromStatus} → ${toStatus}`,
      };
    }
  }
  return { ok: true };
}
