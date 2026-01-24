import { graphqlRequest } from "@/hasura";

/**
 * Get SMTP templates by admin ID
 */
export const getMstSmtpTemplatesByAdminId = async (adminId: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!adminId || typeof adminId !== 'string' || !uuidRegex.test(adminId)) {
    return {
      success: false,
      message: "Invalid admin ID format",
      data: [],
    };
  }

  const QUERY = `query GetMstSmtpTemplatesByAdminId($admin_id: uuid!) {
    mst_smtp_template(
      where: { admin_id: { _eq: $admin_id } }
      order_by: { created_at: desc }
    ) {
      id
      admin_id
      template_name
      subject
      body
      template_type
      variables
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
        message: result.errors[0]?.message || "Failed to fetch SMTP templates",
        data: [],
      };
    }
    return {
      success: true,
      data: result?.data?.mst_smtp_template || [],
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to fetch SMTP templates",
      data: [],
    };
  }
};

/**
 * Create SMTP template for admin
 */
export const createMstSmtpTemplateByAdminId = async (
  adminId: string,
  data: {
    template_name: string;
    subject: string;
    body: string;
    template_type?: string;
    variables?: any;
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

  const MUTATION = `mutation CreateMstSmtpTemplateByAdminId(
    $admin_id: uuid!
    $template_name: String!
    $subject: String!
    $body: String!
    $template_type: String
    $variables: jsonb
    $is_active: Boolean
  ) {
    insert_mst_smtp_template_one(object: {
      admin_id: $admin_id
      template_name: $template_name
      subject: $subject
      body: $body
      template_type: $template_type
      variables: $variables
      is_active: $is_active
    }) {
      id
      admin_id
      template_name
      subject
      body
      template_type
      variables
      is_active
    }
  }`;

  try {
    const result = await graphqlRequest(MUTATION, {
      admin_id: adminId,
      template_name: data.template_name,
      subject: data.subject,
      body: data.body,
      template_type: data.template_type || null,
      variables: data.variables || null,
      is_active: data.is_active !== undefined ? data.is_active : true,
    });

    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to create SMTP template",
      };
    }

    if (result?.data?.insert_mst_smtp_template_one) {
      return {
        success: true,
        data: result.data.insert_mst_smtp_template_one,
        message: "SMTP template created successfully",
      };
    }

    return {
      success: false,
      message: "Failed to create SMTP template",
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to create SMTP template",
    };
  }
};

