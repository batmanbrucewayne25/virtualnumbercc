import { graphqlRequest } from "@/hasura";

/**
 * Get all roles
 */
export const getMstRoles = async () => {
  const QUERY = `query GetMstRoles {
    mst_role(order_by: { created_at: desc }) {
      id
      role_name
      role_type
      description
      is_active
      created_at
      updated_at
    }
  }`;

  try {
    const result = await graphqlRequest(QUERY);
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to fetch roles",
        data: [],
      };
    }
    if (result?.data?.mst_role) {
      return {
        success: true,
        data: result.data.mst_role,
      };
    }
    return {
      success: false,
      data: [],
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to fetch roles",
      data: [],
    };
  }
};

/**
 * Get role by ID
 */
export const getMstRoleById = async (id: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || typeof id !== 'string' || !uuidRegex.test(id)) {
    return {
      success: false,
      message: "Invalid role ID format",
      data: null,
    };
  }

  const QUERY = `query GetMstRoleById($id: uuid!) {
    mst_role_by_pk(id: $id) {
      id
      role_name
      role_type
      description
      is_active
      created_at
      updated_at
    }
  }`;

  try {
    const result = await graphqlRequest(QUERY, { id });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to fetch role",
        data: null,
      };
    }
    if (result?.data?.mst_role_by_pk) {
      return {
        success: true,
        data: result.data.mst_role_by_pk,
      };
    }
    return {
      success: false,
      message: "Role not found",
      data: null,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to fetch role",
      data: null,
    };
  }
};

/**
 * Create new role
 */
export const createMstRole = async (data: {
  role_name: string;
  role_type: string;
  description?: string;
  is_active?: boolean;
}) => {
  const MUTATION = `mutation CreateMstRole(
    $role_name: String!
    $role_type: String!
    $description: String
    $is_active: Boolean
  ) {
    insert_mst_role_one(object: {
      role_name: $role_name
      role_type: $role_type
      description: $description
      is_active: $is_active
    }) {
      id
      role_name
      role_type
      description
      is_active
      created_at
      updated_at
    }
  }`;

  try {
    const result = await graphqlRequest(MUTATION, {
      role_name: data.role_name,
      role_type: data.role_type,
      description: data.description || null,
      is_active: data.is_active !== undefined ? data.is_active : true,
    });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to create role",
        data: null,
      };
    }
    if (result?.data?.insert_mst_role_one) {
      return {
        success: true,
        data: result.data.insert_mst_role_one,
        message: "Role created successfully",
      };
    }
    return {
      success: false,
      message: "Failed to create role",
      data: null,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to create role",
      data: null,
    };
  }
};

/**
 * Update role
 */
export const updateMstRole = async (id: string, data: {
  role_name?: string;
  role_type?: string;
  description?: string;
  is_active?: boolean;
}) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || typeof id !== 'string' || !uuidRegex.test(id)) {
    return {
      success: false,
      message: "Invalid role ID format",
    };
  }

  const MUTATION = `mutation UpdateMstRole(
    $id: uuid!
    $role_name: String
    $role_type: String
    $description: String
    $is_active: Boolean
  ) {
    update_mst_role_by_pk(
      pk_columns: { id: $id }
      _set: {
        role_name: $role_name
        role_type: $role_type
        description: $description
        is_active: $is_active
      }
    ) {
      id
      role_name
      role_type
      description
      is_active
      updated_at
    }
  }`;

  try {
    const updateData: any = { id };
    if (data.role_name !== undefined) updateData.role_name = data.role_name;
    if (data.role_type !== undefined) updateData.role_type = data.role_type;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;

    const result = await graphqlRequest(MUTATION, updateData);
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to update role",
      };
    }
    if (result?.data?.update_mst_role_by_pk) {
      return {
        success: true,
        data: result.data.update_mst_role_by_pk,
        message: "Role updated successfully",
      };
    }
    return {
      success: false,
      message: "Failed to update role",
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to update role",
    };
  }
};

/**
 * Delete role by ID
 */
export const deleteMstRole = async (id: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || typeof id !== 'string' || !uuidRegex.test(id)) {
    return {
      success: false,
      message: "Invalid role ID format",
    };
  }

  const MUTATION = `mutation DeleteMstRole($id: uuid!) {
    delete_mst_role_by_pk(id: $id) {
      id
    }
  }`;

  try {
    const result = await graphqlRequest(MUTATION, { id });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to delete role",
      };
    }
    if (result?.data?.delete_mst_role_by_pk) {
      return {
        success: true,
        message: "Role deleted successfully",
      };
    }
    return {
      success: false,
      message: "Failed to delete role",
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to delete role",
    };
  }
};

/**
 * Get role permissions by role ID
 */
export const getMstRolePermissions = async (roleId: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!roleId || typeof roleId !== 'string' || !uuidRegex.test(roleId)) {
    return {
      success: false,
      message: "Invalid role ID format",
      data: [],
    };
  }

  const QUERY = `query GetMstRolePermissions($role_id: uuid!) {
    mst_role_permission(where: { role_id: { _eq: $role_id } }) {
      id
      role_id
      permission_id
      can_view
      can_create
      can_update
      can_delete
      mst_permission {
        id
        permission_name
        permission_code
        module
        description
      }
    }
  }`;

  try {
    const result = await graphqlRequest(QUERY, { role_id: roleId });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to fetch role permissions",
        data: [],
      };
    }
    if (result?.data?.mst_role_permission) {
      return {
        success: true,
        data: result.data.mst_role_permission,
      };
    }
    return {
      success: false,
      data: [],
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to fetch role permissions",
      data: [],
    };
  }
};

/**
 * Create or update role permission
 */
export const upsertMstRolePermission = async (data: {
  role_id: string;
  permission_id: string;
  can_view?: boolean;
  can_create?: boolean;
  can_update?: boolean;
  can_delete?: boolean;
}) => {
  const MUTATION = `mutation UpsertMstRolePermission(
    $role_id: uuid!
    $permission_id: uuid!
    $can_view: Boolean
    $can_create: Boolean
    $can_update: Boolean
    $can_delete: Boolean
  ) {
    insert_mst_role_permission_one(
      object: {
        role_id: $role_id
        permission_id: $permission_id
        can_view: $can_view
        can_create: $can_create
        can_update: $can_update
        can_delete: $can_delete
      }
      on_conflict: {
        constraint: mst_role_permission_role_id_permission_id_key
        update_columns: [can_view, can_create, can_update, can_delete]
      }
    ) {
      id
      role_id
      permission_id
      can_view
      can_create
      can_update
      can_delete
    }
  }`;

  try {
    const result = await graphqlRequest(MUTATION, {
      role_id: data.role_id,
      permission_id: data.permission_id,
      can_view: data.can_view !== undefined ? data.can_view : false,
      can_create: data.can_create !== undefined ? data.can_create : false,
      can_update: data.can_update !== undefined ? data.can_update : false,
      can_delete: data.can_delete !== undefined ? data.can_delete : false,
    });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to save role permission",
        data: null,
      };
    }
    if (result?.data?.insert_mst_role_permission_one) {
      return {
        success: true,
        data: result.data.insert_mst_role_permission_one,
        message: "Role permission saved successfully",
      };
    }
    return {
      success: false,
      message: "Failed to save role permission",
      data: null,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to save role permission",
      data: null,
    };
  }
};

/**
 * Delete role permission
 */
export const deleteMstRolePermission = async (id: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || typeof id !== 'string' || !uuidRegex.test(id)) {
    return {
      success: false,
      message: "Invalid permission ID format",
    };
  }

  const MUTATION = `mutation DeleteMstRolePermission($id: uuid!) {
    delete_mst_role_permission_by_pk(id: $id) {
      id
    }
  }`;

  try {
    const result = await graphqlRequest(MUTATION, { id });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to delete role permission",
      };
    }
    if (result?.data?.delete_mst_role_permission_by_pk) {
      return {
        success: true,
        message: "Role permission deleted successfully",
      };
    }
    return {
      success: false,
      message: "Failed to delete role permission",
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to delete role permission",
    };
  }
};

