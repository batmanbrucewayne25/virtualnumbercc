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
      role_id
      created_at
      updated_at
    }
  }`;

  try {
    const result = await graphqlRequest(QUERY);
    if (result?.errors) {
      console.error("GraphQL errors in getMstSuperAdmins:", result.errors);
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
    console.warn("No data returned from getMstSuperAdmins query");
    return {
      success: false,
      message: "No data returned from query",
      data: [],
    };
  } catch (error: any) {
    console.error("Error in getMstSuperAdmins:", error);
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
      role_id
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
  role_id?: string | null;
}) => {
  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || typeof id !== 'string' || !uuidRegex.test(id)) {
    return {
      success: false,
      message: "Invalid admin ID format",
    };
  }

  try {
    // Build the _set object, only including fields that are explicitly provided (not undefined)
    const setFields: any = {};
    const variables: any = { id };
    const setFieldsList: string[] = [];

    if (data.first_name !== undefined) {
      setFields.first_name = data.first_name;
      variables.first_name = data.first_name;
      setFieldsList.push('first_name: $first_name');
    }
    if (data.last_name !== undefined) {
      setFields.last_name = data.last_name;
      variables.last_name = data.last_name;
      setFieldsList.push('last_name: $last_name');
    }
    if (data.email !== undefined) {
      setFields.email = data.email;
      variables.email = data.email;
      setFieldsList.push('email: $email');
    }
    if (data.phone !== undefined) {
      setFields.phone = data.phone;
      variables.phone = data.phone;
      setFieldsList.push('phone: $phone');
    }
    if (data.status !== undefined) {
      setFields.status = data.status;
      variables.status = data.status;
      setFieldsList.push('status: $status');
    }
    if (data.role_id !== undefined) {
      setFields.role_id = data.role_id;
      variables.role_id = data.role_id;
      setFieldsList.push('role_id: $role_id');
    }

    // Build variable definitions dynamically
    const variableDefs: string[] = ['$id: uuid!'];
    if (variables.first_name !== undefined) variableDefs.push('$first_name: String');
    if (variables.last_name !== undefined) variableDefs.push('$last_name: String');
    if (variables.email !== undefined) variableDefs.push('$email: String');
    if (variables.phone !== undefined) variableDefs.push('$phone: String');
    if (variables.status !== undefined) variableDefs.push('$status: Boolean');
    if (variables.role_id !== undefined) variableDefs.push('$role_id: uuid');

    // Build dynamic mutation - only include fields that are being updated
    const setClause = setFieldsList.length > 0 
      ? `_set: { ${setFieldsList.join(', ')} }`
      : '';

    const MUTATION = `mutation UpdateMstSuperAdmin(
      ${variableDefs.join('\n      ')}
    ) {
      update_mst_super_admin_by_pk(
        pk_columns: { id: $id }${setClause ? '\n        ' + setClause : ''}
      ) {
        id
        first_name
        last_name
        email
        phone
        status
        role_id
        updated_at
      }
    }`;

    const result = await graphqlRequest(MUTATION, variables);
    if (result?.errors) {
      console.error("GraphQL errors in updateMstSuperAdmin:", result.errors);
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
