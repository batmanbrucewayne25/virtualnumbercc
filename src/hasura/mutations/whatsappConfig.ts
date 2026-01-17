import { graphqlRequest } from "@/hasura";

/**
 * Get WhatsApp config by reseller ID
 */
export const getMstWhatsappConfigByResellerId = async (resellerId: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!resellerId || typeof resellerId !== 'string' || !uuidRegex.test(resellerId)) {
    return {
      success: false,
      message: "Invalid reseller ID format",
      data: null,
    };
  }

  const QUERY = `query GetMstWhatsappConfigByResellerId($reseller_id: uuid!) {
    mst_whatsapp_config(where: { reseller_id: { _eq: $reseller_id } }, limit: 1) {
      id
      reseller_id
      api_key
      api_url
      phone_number_id
      business_account_id
      is_active
      created_at
      updated_at
    }
  }`;

  try {
    const result = await graphqlRequest(QUERY, { reseller_id: resellerId });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to fetch WhatsApp config",
        data: null,
      };
    }
    if (result?.data?.mst_whatsapp_config && result.data.mst_whatsapp_config.length > 0) {
      return {
        success: true,
        data: result.data.mst_whatsapp_config[0],
      };
    }
    return {
      success: true,
      data: null,
      message: "WhatsApp config not found",
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to fetch WhatsApp config",
      data: null,
    };
  }
};

/**
 * Create or update WhatsApp config
 */
export const upsertMstWhatsappConfig = async (
  resellerId: string,
  data: {
    api_key: string;
    api_url: string;
    phone_number_id: string;
    business_account_id?: string;
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
  const checkResult = await getMstWhatsappConfigByResellerId(resellerId);
  
  if (checkResult.success && checkResult.data) {
    // Update existing - only include api_key if provided (not empty)
    const hasApiKey = data.api_key && data.api_key.trim() !== "";

    // Build mutation dynamically based on whether api_key is provided
    const UPDATE_MUTATION = hasApiKey
      ? `mutation UpdateMstWhatsappConfig(
          $id: uuid!
          $api_key: String!
          $api_url: String!
          $phone_number_id: String!
          $business_account_id: String
          $is_active: Boolean
        ) {
          update_mst_whatsapp_config_by_pk(
            pk_columns: { id: $id }
            _set: {
              api_key: $api_key
              api_url: $api_url
              phone_number_id: $phone_number_id
              business_account_id: $business_account_id
              is_active: $is_active
            }
          ) {
            id
            reseller_id
            api_url
            phone_number_id
            business_account_id
            is_active
          }
        }`
      : `mutation UpdateMstWhatsappConfig(
          $id: uuid!
          $api_url: String!
          $phone_number_id: String!
          $business_account_id: String
          $is_active: Boolean
        ) {
          update_mst_whatsapp_config_by_pk(
            pk_columns: { id: $id }
            _set: {
              api_url: $api_url
              phone_number_id: $phone_number_id
              business_account_id: $business_account_id
              is_active: $is_active
            }
          ) {
            id
            reseller_id
            api_url
            phone_number_id
            business_account_id
            is_active
          }
        }`;

    try {
      const variables: any = {
        id: checkResult.data.id,
        api_url: data.api_url,
        phone_number_id: data.phone_number_id,
        business_account_id: data.business_account_id || null,
        is_active: data.is_active !== undefined ? data.is_active : true,
      };

      // Only include api_key in variables if it's provided
      if (hasApiKey) {
        variables.api_key = data.api_key.trim();
      }

      const result = await graphqlRequest(UPDATE_MUTATION, variables);

      if (result?.errors) {
        return {
          success: false,
          message: result.errors[0]?.message || "Failed to update WhatsApp config",
        };
      }

      if (result?.data?.update_mst_whatsapp_config_by_pk) {
        return {
          success: true,
          data: result.data.update_mst_whatsapp_config_by_pk,
          message: "WhatsApp config updated successfully",
        };
      }

      return {
        success: false,
        message: "Failed to update WhatsApp config",
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Failed to update WhatsApp config",
      };
    }
  } else {
    // Create new
    const INSERT_MUTATION = `mutation InsertMstWhatsappConfig(
      $reseller_id: uuid!
      $api_key: String!
      $api_url: String!
      $phone_number_id: String!
      $business_account_id: String
      $is_active: Boolean
    ) {
      insert_mst_whatsapp_config_one(object: {
        reseller_id: $reseller_id
        api_key: $api_key
        api_url: $api_url
        phone_number_id: $phone_number_id
        business_account_id: $business_account_id
        is_active: $is_active
      }) {
        id
        reseller_id
        api_url
        phone_number_id
        business_account_id
        is_active
      }
    }`;

    try {
      const result = await graphqlRequest(INSERT_MUTATION, {
        reseller_id: resellerId,
        api_key: data.api_key,
        api_url: data.api_url,
        phone_number_id: data.phone_number_id,
        business_account_id: data.business_account_id || null,
        is_active: data.is_active !== undefined ? data.is_active : true,
      });

      if (result?.errors) {
        return {
          success: false,
          message: result.errors[0]?.message || "Failed to create WhatsApp config",
        };
      }

      if (result?.data?.insert_mst_whatsapp_config_one) {
        return {
          success: true,
          data: result.data.insert_mst_whatsapp_config_one,
          message: "WhatsApp config created successfully",
        };
      }

      return {
        success: false,
        message: "Failed to create WhatsApp config",
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Failed to create WhatsApp config",
      };
    }
  }
};
