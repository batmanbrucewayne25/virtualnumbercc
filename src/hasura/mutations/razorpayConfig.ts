import { graphqlRequest } from "@/hasura";

/**
 * Get Razorpay config by reseller ID
 */
export const getMstRazorpayConfigByResellerId = async (resellerId: string) => {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (
    !resellerId ||
    typeof resellerId !== "string" ||
    !uuidRegex.test(resellerId)
  ) {
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
      webhook_secret
      is_active
      created_at
      updated_at
    }
  }`;

  try {
    const result = await graphqlRequest(QUERY, { reseller_id: resellerId });

    if (result?.errors) {
      console.error("Razorpay GET - Errors:", result.errors);
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to fetch Razorpay config",
        data: null,
      };
    }
    if (
      result?.data?.mst_razorpay_config &&
      result.data.mst_razorpay_config.length > 0
    ) {
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
    key_id?: string;
    key_secret?: string;
    webhook_secret?: string;
    is_active?: boolean;
  }
) => {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (
    !resellerId ||
    typeof resellerId !== "string" ||
    !uuidRegex.test(resellerId)
  ) {
    return {
      success: false,
      message: "Invalid reseller ID format",
    };
  }

  // Check if config exists
  const checkResult = await getMstRazorpayConfigByResellerId(resellerId);

  if (checkResult.success && checkResult.data) {
    // Update existing - build _set object conditionally to avoid null values
    const setFields: Record<string, any> = {
      is_active: data.is_active !== undefined ? data.is_active : true,
    };

    if (
      data.key_id !== undefined &&
      data.key_id !== null &&
      data.key_id !== ""
    ) {
      setFields.key_id = data.key_id;
    }

    if (
      data.key_secret !== undefined &&
      data.key_secret !== null &&
      data.key_secret !== ""
    ) {
      setFields.key_secret = data.key_secret;
    }

    if (
      data.webhook_secret !== undefined &&
      data.webhook_secret !== null &&
      data.webhook_secret !== ""
    ) {
      setFields.webhook_secret = data.webhook_secret;
    }

    // Build mutation dynamically based on which fields are present
    const setFieldsStr = Object.keys(setFields)
      .map((key) => `${key}: $${key}`)
      .join("\n          ");
    const variableDefs = ["$id: uuid!"];
    const variablesObj: Record<string, any> = { id: checkResult.data.id };

    if (setFields.key_id !== undefined) {
      variableDefs.push("$key_id: String");
      variablesObj.key_id = setFields.key_id;
    }
    if (setFields.key_secret !== undefined) {
      variableDefs.push("$key_secret: String");
      variablesObj.key_secret = setFields.key_secret;
    }
    if (setFields.webhook_secret !== undefined) {
      variableDefs.push("$webhook_secret: String");
      variablesObj.webhook_secret = setFields.webhook_secret;
    }
    variableDefs.push("$is_active: Boolean");
    variablesObj.is_active = setFields.is_active;

    const UPDATE_MUTATION = `mutation UpdateMstRazorpayConfig(
      ${variableDefs.join("\n      ")}
    ) {
      update_mst_razorpay_config_by_pk(
        pk_columns: { id: $id }
        _set: {
          ${setFieldsStr}
        }
      ) {
        id
        reseller_id
        key_id
        is_active
      }
    }`;

    try {
      const result = await graphqlRequest(UPDATE_MUTATION, variablesObj);

      if (result?.errors) {
        return {
          success: false,
          message:
            result.errors[0]?.message || "Failed to update Razorpay config",
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
      $key_id: String
      $key_secret: String
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
        key_id: data.key_id || null,
        key_secret: data.key_secret || null,
        webhook_secret: data.webhook_secret || null,
        is_active: data.is_active !== undefined ? data.is_active : true,
      });

      if (result?.errors) {
        return {
          success: false,
          message:
            result.errors[0]?.message || "Failed to create Razorpay config",
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

/**
 * Get all resellers with Razorpay configured (for super admin)
 */
export const getResellersWithRazorpayConfig = async () => {
  const QUERY = `query GetResellersWithRazorpayConfig {
    mst_razorpay_config(where: { is_active: { _eq: true } }) {
      id
      reseller_id
      key_id
      is_active
      created_at
      mst_reseller {
        id
        first_name
        last_name
        email
        business_name
      }
    }
  }`;

  try {
    const result = await graphqlRequest(QUERY);

    if (result?.errors) {
      return {
        success: false,
        message:
          result.errors[0]?.message || "Failed to fetch reseller configs",
        data: [],
      };
    }

    return {
      success: true,
      data: result?.data?.mst_razorpay_config || [],
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to fetch reseller configs",
      data: [],
    };
  }
};
