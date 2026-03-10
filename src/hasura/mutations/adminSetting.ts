import { graphqlRequest } from "@/hasura";

/**
 * Get admin setting (first row - singleton)
 */
export const getMstAdminSetting = async () => {
  const QUERY = `query GetMstAdminSetting {
    mst_admin_setting(limit: 1, order_by: { created_at: desc }) {
      id
      site_name
      site_email
      site_phone
      maintenance_mode
      created_at
      updated_at
    }
  }`;

  try {
    const result = await graphqlRequest(QUERY);
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to fetch admin setting",
        data: null,
      };
    }
    const row = result?.data?.mst_admin_setting?.[0] ?? null;
    return {
      success: true,
      data: row,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to fetch admin setting",
      data: null,
    };
  }
};

/**
 * Create admin setting row
 */
export const createMstAdminSetting = async (data: {
  site_name?: string | null;
  site_email?: string | null;
  site_phone?: string | null;
  maintenance_mode?: boolean;
}) => {
  const MUTATION = `mutation CreateMstAdminSetting(
    $site_name: String
    $site_email: String
    $site_phone: String
    $maintenance_mode: Boolean
  ) {
    insert_mst_admin_setting_one(object: {
      site_name: $site_name
      site_email: $site_email
      site_phone: $site_phone
      maintenance_mode: $maintenance_mode
    }) {
      id
      site_name
      site_email
      site_phone
      maintenance_mode
      created_at
      updated_at
    }
  }`;

  try {
    const res = await graphqlRequest(MUTATION, {
      site_name: data.site_name ?? null,
      site_email: data.site_email ?? null,
      site_phone: data.site_phone ?? null,
      maintenance_mode: data.maintenance_mode ?? false,
    });
    if (res?.errors) {
      return {
        success: false,
        message: res.errors[0]?.message || "Failed to create admin setting",
        data: null,
      };
    }
    const row = res?.data?.insert_mst_admin_setting_one;
    if (row) {
      return { success: true, data: row, message: "Admin setting created successfully" };
    }
    return { success: false, message: "Failed to create admin setting", data: null };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to create admin setting",
      data: null,
    };
  }
};

/**
 * Update admin setting by id
 */
export const updateMstAdminSetting = async (
  id: string,
  data: {
    site_name?: string | null;
    site_email?: string | null;
    site_phone?: string | null;
    maintenance_mode?: boolean;
  }
) => {
  const MUTATION = `mutation UpdateMstAdminSetting(
    $id: uuid!
    $site_name: String
    $site_email: String
    $site_phone: String
    $maintenance_mode: Boolean
  ) {
    update_mst_admin_setting_by_pk(
      pk_columns: { id: $id }
      _set: {
        site_name: $site_name
        site_email: $site_email
        site_phone: $site_phone
        maintenance_mode: $maintenance_mode
      }
    ) {
      id
      site_name
      site_email
      site_phone
      maintenance_mode
      created_at
      updated_at
    }
  }`;

  try {
    const res = await graphqlRequest(MUTATION, {
      id,
      site_name: data.site_name ?? null,
      site_email: data.site_email ?? null,
      site_phone: data.site_phone ?? null,
      maintenance_mode: data.maintenance_mode ?? false,
    });
    if (res?.errors) {
      return {
        success: false,
        message: res.errors[0]?.message || "Failed to update admin setting",
        data: null,
      };
    }
    const row = res?.data?.update_mst_admin_setting_by_pk;
    if (row) {
      return { success: true, data: row, message: "Admin setting updated successfully" };
    }
    return { success: false, message: "Failed to update admin setting", data: null };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to update admin setting",
      data: null,
    };
  }
};
