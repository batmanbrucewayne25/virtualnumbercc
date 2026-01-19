import { graphqlRequest } from "@/hasura";

/**
 * Get user with role and permissions
 * This fetches the admin user with their role and all role permissions
 */
export const getUserWithPermissions = async (email: string) => {
  const QUERY = `query GetUserWithPermissions($email: String!) {
    mst_super_admin(where: { email: { _eq: $email } }, limit: 1) {
      id
      first_name
      last_name
      email
      phone
      status
      role_id
      mst_roles {
        id
        role_name
        role_type
        mst_role_permissions {
          can_create
          can_delete
          can_update
          can_view
          mst_permission {
            permission_code
            permission_name
            module
          }
        }
      }
      created_at
      updated_at
    }
  }`;

  try {
    const result = await graphqlRequest(QUERY, { email });
    if (result?.errors) {
      console.error("GraphQL errors in getUserWithPermissions:", result.errors);
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to fetch user permissions",
        data: null,
      };
    }
    if (result?.data?.mst_super_admin && result.data.mst_super_admin.length > 0) {
      return {
        success: true,
        data: result.data.mst_super_admin[0],
      };
    }
    return {
      success: false,
      message: "User not found",
      data: null,
    };
  } catch (error: any) {
    console.error("Error in getUserWithPermissions:", error);
    return {
      success: false,
      message: error.message || "Failed to fetch user permissions",
      data: null,
    };
  }
};

