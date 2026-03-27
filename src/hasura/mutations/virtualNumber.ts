import { graphqlRequest } from "@/hasura";
import { getAuthSession, isAdminSession } from "@/utils/auth";

/**
 * Get all virtual numbers.
 * - Resellers: always scoped to their own reseller_id (enforced here, not just in the caller).
 * - Admins: may pass an optional resellerId filter; omitting it returns all records.
 * Passing a resellerId that doesn't match the session reseller_id is silently overridden
 * to prevent horizontal privilege escalation.
 */
export const getMstVirtualNumbers = async (filters?: { resellerId?: string }) => {
  const session = getAuthSession();
  const isAdmin = isAdminSession();

  // Determine the effective reseller_id to filter by
  let resellerId: string | undefined;

  if (!isAdmin) {
    // Non-admin (reseller): ALWAYS scope to their own ID from the session
    const sessionId = session?.id;
    if (!sessionId) {
      return { success: false, message: "Unauthorized: session not found", data: [] };
    }
    resellerId = sessionId;
  } else {
    // Admin: respect the caller-supplied filter (may be undefined for "all")
    resellerId = filters?.resellerId;
  }

  // Base VN fields — no nested wallet/transaction relationships to avoid
  // dependency on Hasura array relationship names that may not be tracked.
  const vnFields = `
    id
    virtual_number
    call_forwarding_number
    purchase_date
    expiry_date
    status
    grace_period_end
    created_at
    mst_customer {
      id
      profile_name
      email
      phone
    }
    mst_reseller {
      id
      first_name
      last_name
      business_name
      brand_name
      email
    }
  `;

  const QUERY = resellerId
    ? `query GetMstVirtualNumbersByReseller($reseller_id: uuid!) {
        mst_virtual_number(
          where: { reseller_id: { _eq: $reseller_id } }
          order_by: { created_at: desc }
        ) {
          ${vnFields}
        }
      }`
    : `query GetMstVirtualNumbers {
        mst_virtual_number(
          order_by: { created_at: desc }
        ) {
          ${vnFields}
        }
      }`;

  try {
    const variables = resellerId ? { reseller_id: resellerId } : {};
    const result = await graphqlRequest(QUERY, variables);
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to fetch virtual numbers",
        data: [],
      };
    }

    const vns: any[] = result?.data?.mst_virtual_number ?? [];
    if (vns.length === 0) {
      return { success: true, data: [] };
    }

    // ── Enrich with wallet debit and customer payment amounts ─────────────────
    // Strategy:
    //  1. Fetch mst_transaction rows by virtual_number_id (gives Customer Paid amount)
    //  2. Use those transaction IDs as `reference` values to look up mst_wallet_transaction
    //     (wallet debit reference = mst_transaction.id, always set regardless of whether
    //      mst_wallet_transaction.virtual_number_id was populated at debit time)
    const vnIds = vns.map((v: any) => v.id);

    // Step 1: Customer payments — most-recent success transaction per VN
    const txnQuery = `
      query GetTransactionsByVN($vn_ids: [uuid!]!) {
        mst_transaction(
          where: {
            virtual_number_id: { _in: $vn_ids }
            status: { _in: ["success", "captured"] }
          }
          order_by: { created_at: desc }
        ) {
          id
          virtual_number_id
          amount
          payment_mode
        }
      }
    `;

    const txnResult = await graphqlRequest(txnQuery, { vn_ids: vnIds }).catch(() => null);
    const txnRows: any[] = txnResult?.data?.mst_transaction ?? [];

    // Build map: vnId → most-recent success transaction row
    const txnMap = new Map<string, any>();
    // Also collect all transaction IDs so we can look up wallet debits by reference
    const txnIds: string[] = [];
    for (const row of txnRows) {
      if (!txnMap.has(row.virtual_number_id)) {
        txnMap.set(row.virtual_number_id, row);
      }
      txnIds.push(row.id);
    }

    // Step 2: Wallet debits — look up by reference = transaction ID.
    // mst_wallet_transaction.virtual_number_id can be null on older records, so
    // we use `reference` (always = mst_transaction.id) as the reliable join key.
    const walletDebitMap = new Map<string, any>(); // txnId → wallet debit row
    if (txnIds.length > 0) {
      const walletTxnQuery = `
        query GetWalletDebitsByRef($refs: [String!]!) {
          mst_wallet_transaction(
            where: {
              reference: { _in: $refs }
              transaction_type: { _eq: "DEBIT" }
            }
            order_by: { created_at: desc }
          ) {
            reference
            amount
          }
        }
      `;
      const walletTxnResult = await graphqlRequest(walletTxnQuery, { refs: txnIds }).catch(() => null);
      for (const row of (walletTxnResult?.data?.mst_wallet_transaction ?? [])) {
        if (!walletDebitMap.has(row.reference)) {
          walletDebitMap.set(row.reference, row);
        }
      }
    }

    // Step 2b: Fallback for legacy offline rows where wallet.reference was payment ref, not txn id.
    // Latest DEBIT per virtual_number_id (order desc → first seen wins).
    const walletDebitByVnId = new Map<string, any>();
    if (vnIds.length > 0) {
      const walletByVnQuery = `
        query GetWalletDebitsByVirtualNumberId($vn_ids: [uuid!]!) {
          mst_wallet_transaction(
            where: {
              virtual_number_id: { _in: $vn_ids }
              transaction_type: { _eq: "DEBIT" }
            }
            order_by: { created_at: desc }
          ) {
            virtual_number_id
            reference
            amount
          }
        }
      `;
      const walletByVnResult = await graphqlRequest(walletByVnQuery, {
        vn_ids: vnIds,
      }).catch(() => null);
      for (const row of (walletByVnResult?.data?.mst_wallet_transaction ?? [])) {
        const vid = row.virtual_number_id;
        if (vid && !walletDebitByVnId.has(vid)) {
          walletDebitByVnId.set(vid, row);
        }
      }
    }

    // Step 3: Attach enrichment data to each VN.
    // mst_wallet_transactions → look up via txn.id → wallet debit for that transaction
    // mst_transactions        → direct from txnMap
    const enriched = vns.map((vn: any) => {
      const txnRow = txnMap.get(vn.id) ?? null;
      let walletRow = txnRow ? (walletDebitMap.get(txnRow.id) ?? null) : null;
      if (txnRow && !walletRow) {
        walletRow = walletDebitByVnId.get(vn.id) ?? null;
      }
      return {
        ...vn,
        mst_wallet_transactions: walletRow ? [walletRow] : [],
        mst_transactions: txnRow ? [txnRow] : [],
      };
    });

    return { success: true, data: enriched };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to fetch virtual numbers",
      data: [],
    };
  }
};

/**
 * Create a virtual number for a customer
 */
export const createMstVirtualNumber = async (data: {
  customer_id: string;
  reseller_id: string;
  virtual_number: string;
  call_forwarding_number?: string;
  purchase_date?: string;
  expiry_date?: string;
  status?: string;
  subscription_plan_id?: string;
  is_auto_renew?: boolean;
}) => {
  const MUTATION = `mutation CreateMstVirtualNumber(
    $customer_id: uuid!
    $reseller_id: uuid!
    $virtual_number: String!
    $call_forwarding_number: String
    $purchase_date: date
    $expiry_date: date
    $status: String
    $subscription_plan_id: uuid
    $is_auto_renew: Boolean
  ) {
    insert_mst_virtual_number_one(object: {
      customer_id: $customer_id
      reseller_id: $reseller_id
      virtual_number: $virtual_number
      call_forwarding_number: $call_forwarding_number
      purchase_date: $purchase_date
      expiry_date: $expiry_date
      status: $status
      subscription_plan_id: $subscription_plan_id
      is_auto_renew: $is_auto_renew
    }) {
      id
      customer_id
      reseller_id
      virtual_number
      call_forwarding_number
      purchase_date
      expiry_date
      status
      subscription_plan_id
      is_auto_renew
      created_at
    }
  }`;

  try {
    // Set defaults
    const purchaseDate = data.purchase_date || new Date().toISOString().split("T")[0];
    const expiryDate = data.expiry_date || (() => {
      const date = new Date(purchaseDate);
      date.setDate(date.getDate() + 360);
      return date.toISOString().split("T")[0];
    })();
    const status = data.status || "active";

    const result = await graphqlRequest(MUTATION, {
      customer_id: data.customer_id,
      reseller_id: data.reseller_id,
      virtual_number: data.virtual_number,
      call_forwarding_number: data.call_forwarding_number || null,
      purchase_date: purchaseDate,
      expiry_date: expiryDate,
      status: status,
      subscription_plan_id: data.subscription_plan_id || null,
      is_auto_renew: data.is_auto_renew !== undefined ? data.is_auto_renew : false,
    });

    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to create virtual number",
        data: null,
      };
    }

    if (result?.data?.insert_mst_virtual_number_one) {
      return {
        success: true,
        data: result.data.insert_mst_virtual_number_one,
        message: "Virtual number created successfully",
      };
    }

    return {
      success: false,
      message: "Failed to create virtual number",
      data: null,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to create virtual number",
      data: null,
    };
  }
};

/**
 * Update call forwarding number for a virtual number
 */
export const updateMstVirtualNumberCallForwarding = async (data: {
  id: string;
  call_forwarding_number: string;
}) => {
  const MUTATION = `mutation UpdateMstVirtualNumberCallForwarding(
    $id: uuid!
    $call_forwarding_number: String!
  ) {
    update_mst_virtual_number_by_pk(
      pk_columns: { id: $id }
      _set: { call_forwarding_number: $call_forwarding_number }
    ) {
      id
      virtual_number
      call_forwarding_number
      updated_at
    }
  }`;

  try {
    const result = await graphqlRequest(MUTATION, {
      id: data.id,
      call_forwarding_number: data.call_forwarding_number,
    });

    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to update call forwarding number",
        data: null,
      };
    }

    if (result?.data?.update_mst_virtual_number_by_pk) {
      return {
        success: true,
        data: result.data.update_mst_virtual_number_by_pk,
        message: "Call forwarding number updated successfully",
      };
    }

    return {
      success: false,
      message: "Failed to update call forwarding number",
      data: null,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to update call forwarding number",
      data: null,
    };
  }
};

/**
 * Update virtual number purchase date (used as approval date for customer)
 */
export const updateMstVirtualNumberPurchaseDate = async (data: {
  id: string;
  purchase_date: string;
}) => {
  const MUTATION = `mutation UpdateMstVirtualNumberPurchaseDate(
    $id: uuid!
    $purchase_date: date!
  ) {
    update_mst_virtual_number_by_pk(
      pk_columns: { id: $id }
      _set: { purchase_date: $purchase_date }
    ) {
      id
      purchase_date
      updated_at
    }
  }`;

  try {
    const result = await graphqlRequest(MUTATION, {
      id: data.id,
      purchase_date: data.purchase_date,
    });

    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to update approval date",
        data: null,
      };
    }

    if (result?.data?.update_mst_virtual_number_by_pk) {
      return {
        success: true,
        data: result.data.update_mst_virtual_number_by_pk,
        message: "Approval date updated successfully",
      };
    }

    return {
      success: false,
      message: "Failed to update approval date",
      data: null,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to update approval date",
      data: null,
    };
  }
};

