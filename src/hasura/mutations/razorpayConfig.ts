import { graphqlRequest } from "@/hasura";

/**
 * Get Razorpay config by reseller ID
 */
export const getMstRazorpayConfigByResellerId = async (resellerId: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!resellerId || typeof resellerId !== 'string' || !uuidRegex.test(resellerId)) {
    return {
      success: false,
      message: "Invalid reseller ID format",
      data: null,
    };
  }

  const QUERY = `query GetMstRazorpayConfigByResellerId($reseller_id: uuid!) {
    mst_razorpay_config(where: { reseller_id: { _eq: $reseller_id } }, limit: 1) {
      id
      reseller_id
      key_id
      is_active
      created_at
      updated_at
    }
  }`;

  try {
    const result = await graphqlRequest(QUERY, { reseller_id: resellerId });
    
    // Debug logging
    console.log("Razorpay GET - Query:", QUERY);
    console.log("Razorpay GET - Variables:", { reseller_id: resellerId });
    console.log("Razorpay GET - Response:", result);
    
    if (result?.errors) {
      console.error("Razorpay GET - Errors:", result.errors);
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to fetch Razorpay config",
        data: null,
      };
    }
    if (result?.data?.mst_razorpay_config && result.data.mst_razorpay_config.length > 0) {
      return {
        success: true,
        data: result.data.mst_razorpay_config[0],
      };
    }
    return {
      success: true,
      data: null,
      message: "Razorpay config not found",
    };
  } catch (error: any) {
    console.error("Razorpay GET - Exception:", error);
    return {
      success: false,
      message: error.message || "Failed to fetch Razorpay config",
      data: null,
    };
  }
};

/**
 * Create or update Razorpay config
 */
export const upsertMstRazorpayConfig = async (
  resellerId: string,
  data: {
    key_id: string;
    key_secret: string;
    webhook_secret?: string;
    is_active?: boolean;
  }
) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!resellerId || typeof resellerId !== 'string' || !uuidRegex.test(resellerId)) {
    return {
      success: false,
      message: "Invalid reseller ID format",
    };
  }

  // Check if config exists
  const checkResult = await getMstRazorpayConfigByResellerId(resellerId);
  
  if (checkResult.success && checkResult.data) {
    // Update existing
    const UPDATE_MUTATION = `mutation UpdateMstRazorpayConfig(
      $id: uuid!
      $key_id: String!
      $key_secret: String!
      $webhook_secret: String
      $is_active: Boolean
    ) {
      update_mst_razorpay_config_by_pk(
        pk_columns: { id: $id }
        _set: {
          key_id: $key_id
          key_secret: $key_secret
          webhook_secret: $webhook_secret
          is_active: $is_active
        }
      ) {
        id
        reseller_id
        key_id
        is_active
      }
    }`;

    try {
      const result = await graphqlRequest(UPDATE_MUTATION, {
        id: checkResult.data.id,
        key_id: data.key_id,
        key_secret: data.key_secret,
        webhook_secret: data.webhook_secret || null,
        is_active: data.is_active !== undefined ? data.is_active : true,
      });

      if (result?.errors) {
        return {
          success: false,
          message: result.errors[0]?.message || "Failed to update Razorpay config",
        };
      }

      if (result?.data?.update_mst_razorpay_config_by_pk) {
        return {
          success: true,
          data: result.data.update_mst_razorpay_config_by_pk,
          message: "Razorpay config updated successfully",
        };
      }

      return {
        success: false,
        message: "Failed to update Razorpay config",
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Failed to update Razorpay config",
      };
    }
  } else {
    // Create new
    const INSERT_MUTATION = `mutation InsertMstRazorpayConfig(
      $reseller_id: uuid!
      $key_id: String!
      $key_secret: String!
      $webhook_secret: String
      $is_active: Boolean
    ) {
      insert_mst_razorpay_config_one(object: {
        reseller_id: $reseller_id
        key_id: $key_id
        key_secret: $key_secret
        webhook_secret: $webhook_secret
        is_active: $is_active
      }) {
        id
        reseller_id
        key_id
        is_active
      }
    }`;

    try {
      const result = await graphqlRequest(INSERT_MUTATION, {
        reseller_id: resellerId,
        key_id: data.key_id,
        key_secret: data.key_secret,
        webhook_secret: data.webhook_secret || null,
        is_active: data.is_active !== undefined ? data.is_active : true,
      });

      if (result?.errors) {
        return {
          success: false,
          message: result.errors[0]?.message || "Failed to create Razorpay config",
        };
      }

      if (result?.data?.insert_mst_razorpay_config_one) {
        return {
          success: true,
          data: result.data.insert_mst_razorpay_config_one,
          message: "Razorpay config created successfully",
        };
      }

      return {
        success: false,
        message: "Failed to create Razorpay config",
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Failed to create Razorpay config",
      };
    }
  }
};
