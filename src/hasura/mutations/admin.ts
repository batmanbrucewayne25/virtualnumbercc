import { graphqlRequest } from "@/hasura";

/**
 * Get all super admins
 */
export const getMstSuperAdmins = async () => {
  const QUERY = `query GetMstSuperAdmins {
    mst_super_admin(order_by: { created_at: desc }) {
      id
      first_name
      last_name
      email
      phone
      status
      created_at
      updated_at
    }
  }`;

  try {
    const result = await graphqlRequest(QUERY);
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to fetch admins",
        data: [],
      };
    }
    if (result?.data?.mst_super_admin) {
      return {
        success: true,
        data: result.data.mst_super_admin,
      };
    }
    return {
      success: false,
      data: [],
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || "Failed to fetch admins",
      data: [],
    };
  }
};

/**
 * Get super admin by ID
 */
export const getMstSuperAdminById = async (id: string) => {
  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || typeof id !== 'string' || !uuidRegex.test(id)) {
    return {
      success: false,
      message: "Invalid admin ID format",
      data: null,
    };
  }

  const QUERY = `query GetMstSuperAdminById($id: uuid!) {
    mst_super_admin_by_pk(id: $id) {
      id
      first_name
      last_name
      email
      phone
      status
      created_at
      updated_at
    }
  }`;

  try {
    const result = await graphqlRequest(QUERY, { id });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to fetch admin",
        data: null,
      };
    }
    if (result?.data?.mst_super_admin_by_pk) {
      return {
        success: true,
        data: result.data.mst_super_admin_by_pk,
      };
    }
    return {
      success: false,
      message: "Admin not found",
      data: null,
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || "Failed to fetch admin",
      data: null,
    };
  }
};

/**
 * Delete super admin by ID
 */
export const deleteMstSuperAdmin = async (id: string) => {
  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || typeof id !== 'string' || !uuidRegex.test(id)) {
    return {
      success: false,
      message: "Invalid admin ID format",
    };
  }

  const MUTATION = `mutation DeleteMstSuperAdmin($id: uuid!) {
    delete_mst_super_admin_by_pk(id: $id) {
      id
    }
  }`;

  try {
    const result = await graphqlRequest(MUTATION, { id });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to delete admin",
      };
    }
    if (result?.data?.delete_mst_super_admin_by_pk) {
      return {
        success: true,
        message: "Admin deleted successfully",
      };
    }
    return {
      success: false,
      message: "Failed to delete admin",
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || "Failed to delete admin",
    };
  }
};

/**
 * Update super admin
 */
export const updateMstSuperAdmin = async (id: string, data: {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  status?: boolean;
}) => {
  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || typeof id !== 'string' || !uuidRegex.test(id)) {
    return {
      success: false,
      message: "Invalid admin ID format",
    };
  }

  const MUTATION = `mutation UpdateMstSuperAdmin(
    $id: uuid!
    $first_name: String
    $last_name: String
    $email: String
    $phone: String
    $status: Boolean
  ) {
    update_mst_super_admin_by_pk(
      pk_columns: { id: $id }
      _set: {
        first_name: $first_name
        last_name: $last_name
        email: $email
        phone: $phone
        status: $status
      }
    ) {
      id
      first_name
      last_name
      email
      phone
      status
      updated_at
    }
  }`;

  try {
    const result = await graphqlRequest(MUTATION, { id, ...data });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to update admin",
      };
    }
    if (result?.data?.update_mst_super_admin_by_pk) {
      return {
        success: true,
        data: result.data.update_mst_super_admin_by_pk,
        message: "Admin updated successfully",
      };
    }
    return {
      success: false,
      message: "Failed to update admin",
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || "Failed to update admin",
    };
  }
};
