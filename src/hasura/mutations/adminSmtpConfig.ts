import { graphqlRequest } from "@/hasura";

/**
 * Get SMTP config by admin ID
 * Note: Assuming mst_smtp_config has an admin_id field or we use a special identifier
 */
export const getMstSmtpConfigByAdminId = async (adminId: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!adminId || typeof adminId !== 'string' || !uuidRegex.test(adminId)) {
    return {
      success: false,
      message: "Invalid admin ID format",
      data: null,
    };
  }

  // Check if table has admin_id field, otherwise use a special query
  // For now, assuming we can query by admin_id or use a special identifier
  const QUERY = `query GetMstSmtpConfigByAdminId($admin_id: uuid!) {
    mst_smtp_config(where: { admin_id: { _eq: $admin_id } }, limit: 1) {
      id
      admin_id
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
    const result = await graphqlRequest(QUERY, { admin_id: adminId });
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
 * Create or update SMTP config for admin
 */
export const upsertMstSmtpConfigByAdminId = async (
  adminId: string,
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
  if (!adminId || typeof adminId !== 'string' || !uuidRegex.test(adminId)) {
    return {
      success: false,
      message: "Invalid admin ID format",
    };
  }

  // Check if config exists
  const checkResult = await getMstSmtpConfigByAdminId(adminId);
  
  if (checkResult.success && checkResult.data) {
    // Update existing
    const UPDATE_MUTATION = `mutation UpdateMstSmtpConfigByAdminId(
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
        admin_id
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
    const INSERT_MUTATION = `mutation InsertMstSmtpConfigByAdminId(
      $admin_id: uuid!
      $host: String!
      $port: Int!
      $username: String!
      $password: String!
      $from_email: String!
      $from_name: String
      $is_active: Boolean
    ) {
      insert_mst_smtp_config_one(object: {
        admin_id: $admin_id
        host: $host
        port: $port
        username: $username
        password: $password
        from_email: $from_email
        from_name: $from_name
        is_active: $is_active
      }) {
        id
        admin_id
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
        admin_id: adminId,
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

