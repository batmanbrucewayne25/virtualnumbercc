import { graphqlRequest } from "@/hasura";

export type WalletRequestRow = {
  id: string;
  reseller_id: string;
  amount: number;
  payment_type: string;
  reference: string | null;
  description: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  admin_notes: string | null;
  mst_reseller?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    business_name: string | null;
    phone: string | null;
  } | null;
};

/**
 * Insert a wallet request (reseller).
 */
export const insertWalletRequest = async (
  resellerId: string,
  payload: { amount: number; payment_type: string; reference?: string | null; description?: string | null }
): Promise<{ success: boolean; data?: WalletRequestRow; message?: string }> => {
  const amount = Number(payload.amount);
  if (isNaN(amount) || amount <= 0) {
    return { success: false, message: "Amount must be greater than 0." };
  }
  const paymentType = payload.payment_type === "upi" ? "upi" : "bank_transfer";
  const reference = payload.reference?.trim();
  if (!reference) {
    return { success: false, message: "Reference number is required." };
  }
  const MUTATION = `mutation InsertWalletRequest(
    $reseller_id: uuid!
    $amount: numeric!
    $payment_type: String!
    $reference: String!
    $description: String
  ) {
    insert_wallet_request_one(
      object: {
        reseller_id: $reseller_id
        amount: $amount
        payment_type: $payment_type
        reference: $reference
        description: $description
        status: "PENDING"
      }
    ) {
      id
      reseller_id
      amount
      payment_type
      reference
      description
      status
      created_at
    }
  }`;
  try {
    const result = await graphqlRequest(MUTATION, {
      reseller_id: resellerId,
      amount,
      payment_type: paymentType,
      reference,
      description: payload.description?.trim() || null,
    });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to create request",
      };
    }
    const row = result?.data?.insert_wallet_request_one;
    if (!row) return { success: false, message: "No data returned" };
    return { success: true, data: row };
  } catch (e: any) {
    return {
      success: false,
      message: e?.message || "Failed to create wallet request",
    };
  }
};

/**
 * Get all wallet requests (admin). With reseller info.
 */
export const getWalletRequests = async (): Promise<{
  success: boolean;
  data?: WalletRequestRow[];
  message?: string;
}> => {
  const QUERY = `query GetWalletRequests {
    wallet_request(
      order_by: { created_at: desc }
    ) {
      id
      reseller_id
      amount
      payment_type
      reference
      description
      status
      created_at
      reviewed_at
      reviewed_by
      admin_notes
      mst_reseller {
        id
        first_name
        last_name
        email
        business_name
        phone
      }
    }
  }`;
  try {
    const result = await graphqlRequest(QUERY);
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to fetch requests",
      };
    }
    const rows = result?.data?.wallet_request ?? [];
    return { success: true, data: rows };
  } catch (e: any) {
    return {
      success: false,
      message: e?.message || "Failed to fetch wallet requests",
    };
  }
};

/**
 * Get wallet requests for a reseller (own only).
 */
export const getWalletRequestsByResellerId = async (
  resellerId: string
): Promise<{ success: boolean; data?: WalletRequestRow[]; message?: string }> => {
  const QUERY = `query GetWalletRequestsByReseller($reseller_id: uuid!) {
    wallet_request(
      where: { reseller_id: { _eq: $reseller_id } }
      order_by: { created_at: desc }
    ) {
      id
      reseller_id
      amount
      payment_type
      reference
      description
      status
      created_at
      reviewed_at
      admin_notes
    }
  }`;
  try {
    const result = await graphqlRequest(QUERY, { reseller_id: resellerId });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to fetch requests",
      };
    }
    const rows = result?.data?.wallet_request ?? [];
    return { success: true, data: rows };
  } catch (e: any) {
    return {
      success: false,
      message: e?.message || "Failed to fetch wallet requests",
    };
  }
};

/**
 * Update wallet request status (admin). Used for Reject and Accept.
 */
export const updateWalletRequestStatus = async (
  id: string,
  payload: {
    status: string;
    reviewed_at?: string;
    reviewed_by?: string | null;
    admin_notes?: string | null;
  }
): Promise<{ success: boolean; message?: string }> => {
  const MUTATION = `mutation UpdateWalletRequestStatus(
    $id: uuid!
    $status: String!
    $reviewed_at: timestamptz
    $reviewed_by: uuid
    $admin_notes: String
  ) {
    update_wallet_request_by_pk(
      pk_columns: { id: $id }
      _set: {
        status: $status
        reviewed_at: $reviewed_at
        reviewed_by: $reviewed_by
        admin_notes: $admin_notes
      }
    ) {
      id
    }
  }`;
  try {
    const result = await graphqlRequest(MUTATION, {
      id,
      status: payload.status,
      reviewed_at: payload.reviewed_at ?? new Date().toISOString(),
      reviewed_by: payload.reviewed_by ?? null,
      admin_notes: payload.admin_notes ?? null,
    });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to update request",
      };
    }
    if (!result?.data?.update_wallet_request_by_pk) {
      return { success: false, message: "Update failed" };
    }
    return { success: true };
  } catch (e: any) {
    return {
      success: false,
      message: e?.message || "Failed to update wallet request",
    };
  }
};
