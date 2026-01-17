import { graphqlRequest } from "@/hasura";

/**
 * Get SMTP config by reseller ID
 */
export const getMstSmtpConfigByResellerId = async (resellerId: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!resellerId || typeof resellerId !== 'string' || !uuidRegex.test(resellerId)) {
    return {
      success: false,
      message: "Invalid reseller ID format",
      data: null,
    };
  }

  const QUERY = `query GetMstSmtpConfigByResellerId($reseller_id: uuid!) {
    mst_smtp_config(where: { reseller_id: { _eq: $reseller_id } }, limit: 1) {
      id
      reseller_id
      host
      port
      username
      from_email
      from_name
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
        message: result.errors[0]?.message || "Failed to fetch SMTP config",
        data: null,
      };
    }
    if (result?.data?.mst_smtp_config && result.data.mst_smtp_config.length > 0) {
      return {
        success: true,
        data: result.data.mst_smtp_config[0],
      };
    }
    return {
      success: true,
      data: null,
      message: "SMTP config not found",
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to fetch SMTP config",
      data: null,
    };
  }
};

/**
 * Create or update SMTP config
 */
export const upsertMstSmtpConfig = async (
  resellerId: string,
  data: {
    host: string;
    port: number;
    username: string;
    password: string;
    from_email: string;
    from_name?: string;
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
  const checkResult = await getMstSmtpConfigByResellerId(resellerId);
  
  if (checkResult.success && checkResult.data) {
    // Update existing
    const UPDATE_MUTATION = `mutation UpdateMstSmtpConfig(
      $id: uuid!
      $host: String!
      $port: Int!
      $username: String!
      $password: String!
      $from_email: String!
      $from_name: String
      $is_active: Boolean
    ) {
      update_mst_smtp_config_by_pk(
        pk_columns: { id: $id }
        _set: {
          host: $host
          port: $port
          username: $username
          password: $password
          from_email: $from_email
          from_name: $from_name
          is_active: $is_active
        }
      ) {
        id
        reseller_id
        host
        port
        username
        from_email
        from_name
        is_active
      }
    }`;

    try {
      const result = await graphqlRequest(UPDATE_MUTATION, {
        id: checkResult.data.id,
        host: data.host,
        port: data.port,
        username: data.username,
        password: data.password,
        from_email: data.from_email,
        from_name: data.from_name || null,
        is_active: data.is_active !== undefined ? data.is_active : true,
      });

      if (result?.errors) {
        return {
          success: false,
          message: result.errors[0]?.message || "Failed to update SMTP config",
        };
      }

      if (result?.data?.update_mst_smtp_config_by_pk) {
        return {
          success: true,
          data: result.data.update_mst_smtp_config_by_pk,
          message: "SMTP config updated successfully",
        };
      }

      return {
        success: false,
        message: "Failed to update SMTP config",
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Failed to update SMTP config",
      };
    }
  } else {
    // Create new
    const INSERT_MUTATION = `mutation InsertMstSmtpConfig(
      $reseller_id: uuid!
      $host: String!
      $port: Int!
      $username: String!
      $password: String!
      $from_email: String!
      $from_name: String
      $is_active: Boolean
    ) {
      insert_mst_smtp_config_one(object: {
        reseller_id: $reseller_id
        host: $host
        port: $port
        username: $username
        password: $password
        from_email: $from_email
        from_name: $from_name
        is_active: $is_active
      }) {
        id
        reseller_id
        host
        port
        username
        from_email
        from_name
        is_active
      }
    }`;

    try {
      const result = await graphqlRequest(INSERT_MUTATION, {
        reseller_id: resellerId,
        host: data.host,
        port: data.port,
        username: data.username,
        password: data.password,
        from_email: data.from_email,
        from_name: data.from_name || null,
        is_active: data.is_active !== undefined ? data.is_active : true,
      });

      if (result?.errors) {
        return {
          success: false,
          message: result.errors[0]?.message || "Failed to create SMTP config",
        };
      }

      if (result?.data?.insert_mst_smtp_config_one) {
        return {
          success: true,
          data: result.data.insert_mst_smtp_config_one,
          message: "SMTP config created successfully",
        };
      }

      return {
        success: false,
        message: "Failed to create SMTP config",
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Failed to create SMTP config",
      };
    }
  }
};
