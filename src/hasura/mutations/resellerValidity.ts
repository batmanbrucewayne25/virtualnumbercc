import { graphqlRequest } from "@/hasura";

/**
 * Upsert reseller validity (create or update)
 */
export const upsertResellerValidity = async (data: {
  reseller_id: string;
  validity_start_date: string;
  validity_end_date: string;
  validity_days: number;
  last_wallet_id: string;
  last_recharge_amount: number;
  status?: string;
}) => {
  const MUTATION = `mutation UpsertResellerValidity(
    $reseller_id: uuid!
    $validity_start_date: timestamp!
    $validity_end_date: timestamp!
    $validity_days: Int!
    $last_wallet_id: uuid!
    $last_recharge_amount: numeric!
    $status: String!
  ) {
    insert_mst_reseller_validity_one(
      object: {
        reseller_id: $reseller_id
        validity_start_date: $validity_start_date
        validity_end_date: $validity_end_date
        validity_days: $validity_days
        last_wallet_id: $last_wallet_id
        last_recharge_amount: $last_recharge_amount
        status: $status
      }
      on_conflict: {
        constraint: mst_reseller_validity_reseller_id_key
        update_columns: [
          validity_start_date
          validity_end_date
          validity_days
          last_wallet_id
          last_recharge_amount
          status
          updated_at
        ]
      }
    ) {
      id
      reseller_id
      validity_start_date
      validity_end_date
      validity_days
      last_wallet_id
      last_recharge_amount
      status
      created_at
      updated_at
    }
  }`;

  try {
    const result = await graphqlRequest(MUTATION, {
      reseller_id: data.reseller_id,
      validity_start_date: data.validity_start_date,
      validity_end_date: data.validity_end_date,
      validity_days: data.validity_days,
      last_wallet_id: data.last_wallet_id,
      last_recharge_amount: data.last_recharge_amount,
      status: data.status || 'ACTIVE',
    });

    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to upsert reseller validity",
      };
    }

    if (result?.data?.insert_mst_reseller_validity_one) {
      return {
        success: true,
        data: result.data.insert_mst_reseller_validity_one,
        message: "Reseller validity updated successfully",
      };
    }

    return {
      success: false,
      message: "Failed to upsert reseller validity",
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || "Failed to upsert reseller validity",
    };
  }
};

/**
 * Create reseller validity history record
 */
export const createResellerValidityHistory = async (data: {
  reseller_id: string;
  wallet_id: string;
  recharge_amount: number;
  previous_validity_start?: string | null;
  previous_validity_end?: string | null;
  new_validity_start: string;
  new_validity_end: string;
  validity_days: number;
  action: string;
}) => {
  const MUTATION = `mutation CreateResellerValidityHistory(
    $reseller_id: uuid!
    $wallet_id: uuid!
    $recharge_amount: numeric!
    $previous_validity_start: timestamp
    $previous_validity_end: timestamp
    $new_validity_start: timestamp!
    $new_validity_end: timestamp!
    $validity_days: Int!
    $action: String!
  ) {
    insert_mst_reseller_validity_history_one(
      object: {
        reseller_id: $reseller_id
        wallet_id: $wallet_id
        recharge_amount: $recharge_amount
        previous_validity_start: $previous_validity_start
        previous_validity_end: $previous_validity_end
        new_validity_start: $new_validity_start
        new_validity_end: $new_validity_end
        validity_days: $validity_days
        action: $action
      }
    ) {
      id
      reseller_id
      wallet_id
      recharge_amount
      previous_validity_start
      previous_validity_end
      new_validity_start
      new_validity_end
      validity_days
      action
      created_at
    }
  }`;

  try {
    const result = await graphqlRequest(MUTATION, {
      reseller_id: data.reseller_id,
      wallet_id: data.wallet_id,
      recharge_amount: data.recharge_amount,
      previous_validity_start: data.previous_validity_start || null,
      previous_validity_end: data.previous_validity_end || null,
      new_validity_start: data.new_validity_start,
      new_validity_end: data.new_validity_end,
      validity_days: data.validity_days,
      action: data.action,
    });

    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to create validity history",
      };
    }

    if (result?.data?.insert_mst_reseller_validity_history_one) {
      return {
        success: true,
        data: result.data.insert_mst_reseller_validity_history_one,
        message: "Validity history created successfully",
      };
    }

    return {
      success: false,
      message: "Failed to create validity history",
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || "Failed to create validity history",
    };
  }
};

/**
 * Get current reseller validity
 */
export const getResellerValidity = async (resellerId: string) => {
  const QUERY = `query GetResellerValidity($reseller_id: uuid!) {
    mst_reseller_validity(
      where: { reseller_id: { _eq: $reseller_id } }
      limit: 1
    ) {
      id
      reseller_id
      validity_start_date
      validity_end_date
      validity_days
      last_wallet_id
      last_recharge_amount
      status
      created_at
      updated_at
    }
  }`;

  try {
    const result = await graphqlRequest(QUERY, { reseller_id: resellerId });

    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to get reseller validity",
      };
    }

    const validity = result?.data?.mst_reseller_validity?.[0] || null;

    return {
      success: true,
      data: validity,
      message: validity ? "Validity found" : "No validity record found",
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || "Failed to get reseller validity",
    };
  }
};

/**
 * Update reseller validity on wallet recharge
 * This function handles the complete flow: get current validity, update/create validity, and create history
 */
export const updateValidityOnRecharge = async (
  resellerId: string,
  walletId: string,
  rechargeAmount: number,
  action: string = 'WALLET_RECHARGE_RESET',
  validityDays: number = 365
) => {
  try {
    // Get current validity to save previous dates in history
    const currentValidityResult = await getResellerValidity(resellerId);
    const currentValidity = currentValidityResult.success ? currentValidityResult.data : null;

    // Calculate new validity dates
    const now = new Date();
    const newValidityStart = now.toISOString();
    const newValidityEnd = new Date(now);
    newValidityEnd.setDate(newValidityEnd.getDate() + validityDays);

    // Upsert validity
    const validityResult = await upsertResellerValidity({
      reseller_id: resellerId,
      validity_start_date: newValidityStart,
      validity_end_date: newValidityEnd.toISOString(),
      validity_days: validityDays,
      last_wallet_id: walletId,
      last_recharge_amount: rechargeAmount,
      status: 'ACTIVE',
    });

    if (!validityResult.success) {
      console.warn('Failed to update reseller validity:', validityResult.message);
      return validityResult;
    }

    // Create history record
    const historyResult = await createResellerValidityHistory({
      reseller_id: resellerId,
      wallet_id: walletId,
      recharge_amount: rechargeAmount,
      previous_validity_start: currentValidity?.validity_start_date || null,
      previous_validity_end: currentValidity?.validity_end_date || null,
      new_validity_start: newValidityStart,
      new_validity_end: newValidityEnd.toISOString(),
      validity_days: validityDays,
      action: action,
    });

    if (!historyResult.success) {
      console.warn('Failed to create validity history:', historyResult.message);
      // Don't fail the whole operation if history creation fails
    }

    return {
      success: true,
      data: {
        validity: validityResult.data,
        history: historyResult.data,
      },
      message: 'Reseller validity updated successfully',
    };
  } catch (error) {
    console.error('Error updating reseller validity on recharge:', error);
    return {
      success: false,
      message: error.message || 'Failed to update reseller validity',
    };
  }
};

