import { graphqlRequest } from "@/hasura";

/**
 * Get all permissions
 */
export const getMstPermissions = async () => {
  const QUERY = `query GetMstPermissions {
    mst_permission(order_by: { created_at: desc }) {
      id
      permission_name
      permission_code
      module
      description
      created_at
    }
  }`;

  try {
    const result = await graphqlRequest(QUERY);
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to fetch permissions",
        data: [],
      };
    }
    if (result?.data?.mst_permission) {
      return {
        success: true,
        data: result.data.mst_permission,
      };
    }
    return {
      success: false,
      data: [],
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to fetch permissions",
      data: [],
    };
  }
};

/**
 * Get permission by ID
 */
export const getMstPermissionById = async (id: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || typeof id !== 'string' || !uuidRegex.test(id)) {
    return {
      success: false,
      message: "Invalid permission ID format",
      data: null,
    };
  }

  const QUERY = `query GetMstPermissionById($id: uuid!) {
    mst_permission_by_pk(id: $id) {
      id
      permission_name
      permission_code
      module
      description
      created_at
    }
  }`;

  try {
    const result = await graphqlRequest(QUERY, { id });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to fetch permission",
        data: null,
      };
    }
    if (result?.data?.mst_permission_by_pk) {
      return {
        success: true,
        data: result.data.mst_permission_by_pk,
      };
    }
    return {
      success: false,
      message: "Permission not found",
      data: null,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to fetch permission",
      data: null,
    };
  }
};

/**
 * Get permissions by module
 */
export const getMstPermissionsByModule = async (module: string) => {
  const QUERY = `query GetMstPermissionsByModule($module: String!) {
    mst_permission(where: { module: { _eq: $module } }, order_by: { created_at: desc }) {
      id
      permission_name
      permission_code
      module
      description
      created_at
    }
  }`;

  try {
    const result = await graphqlRequest(QUERY, { module });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to fetch permissions",
        data: [],
      };
    }
    if (result?.data?.mst_permission) {
      return {
        success: true,
        data: result.data.mst_permission,
      };
    }
    return {
      success: false,
      data: [],
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to fetch permissions",
      data: [],
    };
  }
};

/**
 * Create new permission
 */
export const createMstPermission = async (data: {
  permission_name: string;
  permission_code: string;
  module?: string;
  description?: string;
}) => {
  const MUTATION = `mutation CreateMstPermission(
    $permission_name: String!
    $permission_code: String!
    $module: String
    $description: String
  ) {
    insert_mst_permission_one(object: {
      permission_name: $permission_name
      permission_code: $permission_code
      module: $module
      description: $description
    }) {
      id
      permission_name
      permission_code
      module
      description
      created_at
    }
  }`;

  try {
    const result = await graphqlRequest(MUTATION, {
      permission_name: data.permission_name,
      permission_code: data.permission_code,
      module: data.module || null,
      description: data.description || null,
    });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to create permission",
        data: null,
      };
    }
    if (result?.data?.insert_mst_permission_one) {
      return {
        success: true,
        data: result.data.insert_mst_permission_one,
        message: "Permission created successfully",
      };
    }
    return {
      success: false,
      message: "Failed to create permission",
      data: null,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to create permission",
      data: null,
    };
  }
};

/**
 * Update permission
 */
export const updateMstPermission = async (id: string, data: {
  permission_name?: string;
  permission_code?: string;
  module?: string;
  description?: string;
}) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || typeof id !== 'string' || !uuidRegex.test(id)) {
    return {
      success: false,
      message: "Invalid permission ID format",
    };
  }

  const MUTATION = `mutation UpdateMstPermission(
    $id: uuid!
    $permission_name: String
    $permission_code: String
    $module: String
    $description: String
  ) {
    update_mst_permission_by_pk(
      pk_columns: { id: $id }
      _set: {
        permission_name: $permission_name
        permission_code: $permission_code
        module: $module
        description: $description
      }
    ) {
      id
      permission_name
      permission_code
      module
      description
      created_at
    }
  }`;

  try {
    const updateData: any = { id };
    if (data.permission_name !== undefined) updateData.permission_name = data.permission_name;
    if (data.permission_code !== undefined) updateData.permission_code = data.permission_code;
    if (data.module !== undefined) updateData.module = data.module;
    if (data.description !== undefined) updateData.description = data.description;

    const result = await graphqlRequest(MUTATION, updateData);
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to update permission",
      };
    }
    if (result?.data?.update_mst_permission_by_pk) {
      return {
        success: true,
        data: result.data.update_mst_permission_by_pk,
        message: "Permission updated successfully",
      };
    }
    return {
      success: false,
      message: "Failed to update permission",
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to update permission",
    };
  }
};

/**
 * Delete permission by ID
 */
export const deleteMstPermission = async (id: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || typeof id !== 'string' || !uuidRegex.test(id)) {
    return {
      success: false,
      message: "Invalid permission ID format",
    };
  }

  const MUTATION = `mutation DeleteMstPermission($id: uuid!) {
    delete_mst_permission_by_pk(id: $id) {
      id
    }
  }`;

  try {
    const result = await graphqlRequest(MUTATION, { id });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to delete permission",
      };
    }
    if (result?.data?.delete_mst_permission_by_pk) {
      return {
        success: true,
        message: "Permission deleted successfully",
      };
    }
    return {
      success: false,
      message: "Failed to delete permission",
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to delete permission",
    };
  }
};

