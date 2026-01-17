import { graphqlRequest } from "@/hasura";

/**
 * Get SMTP templates by reseller ID
 */
export const getMstSmtpTemplatesByResellerId = async (resellerId: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!resellerId || typeof resellerId !== 'string' || !uuidRegex.test(resellerId)) {
    return {
      success: false,
      message: "Invalid reseller ID format",
      data: [],
    };
  }

  const QUERY = `query GetMstSmtpTemplatesByResellerId($reseller_id: uuid!) {
    mst_smtp_template(
      where: { reseller_id: { _eq: $reseller_id } }
      order_by: { created_at: desc }
    ) {
      id
      reseller_id
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
    const result = await graphqlRequest(QUERY, { reseller_id: resellerId });
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
 * Get SMTP template by ID
 */
export const getMstSmtpTemplateById = async (id: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || typeof id !== 'string' || !uuidRegex.test(id)) {
    return {
      success: false,
      message: "Invalid template ID format",
      data: null,
    };
  }

  const QUERY = `query GetMstSmtpTemplateById($id: uuid!) {
    mst_smtp_template_by_pk(id: $id) {
      id
      reseller_id
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
    const result = await graphqlRequest(QUERY, { id });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to fetch SMTP template",
        data: null,
      };
    }
    if (result?.data?.mst_smtp_template_by_pk) {
      return {
        success: true,
        data: result.data.mst_smtp_template_by_pk,
      };
    }
    return {
      success: false,
      message: "SMTP template not found",
      data: null,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to fetch SMTP template",
      data: null,
    };
  }
};

/**
 * Create SMTP template
 */
export const createMstSmtpTemplate = async (
  resellerId: string,
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
  if (!resellerId || typeof resellerId !== 'string' || !uuidRegex.test(resellerId)) {
    return {
      success: false,
      message: "Invalid reseller ID format",
    };
  }

  const MUTATION = `mutation CreateMstSmtpTemplate(
    $reseller_id: uuid!
    $template_name: String!
    $subject: String!
    $body: String!
    $template_type: String
    $variables: jsonb
    $is_active: Boolean
  ) {
    insert_mst_smtp_template_one(object: {
      reseller_id: $reseller_id
      template_name: $template_name
      subject: $subject
      body: $body
      template_type: $template_type
      variables: $variables
      is_active: $is_active
    }) {
      id
      reseller_id
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
      reseller_id: resellerId,
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

/**
 * Update SMTP template
 */
export const updateMstSmtpTemplate = async (
  id: string,
  data: {
    template_name?: string;
    subject?: string;
    body?: string;
    template_type?: string;
    variables?: any;
    is_active?: boolean;
  }
) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || typeof id !== 'string' || !uuidRegex.test(id)) {
    return {
      success: false,
      message: "Invalid template ID format",
    };
  }

  const MUTATION = `mutation UpdateMstSmtpTemplate(
    $id: uuid!
    $template_name: String
    $subject: String
    $body: String
    $template_type: String
    $variables: jsonb
    $is_active: Boolean
  ) {
    update_mst_smtp_template_by_pk(
      pk_columns: { id: $id }
      _set: {
        template_name: $template_name
        subject: $subject
        body: $body
        template_type: $template_type
        variables: $variables
        is_active: $is_active
      }
    ) {
      id
      template_name
      subject
      body
      template_type
      variables
      is_active
    }
  }`;

  try {
    const variables: any = { id };
    if (data.template_name !== undefined) variables.template_name = data.template_name;
    if (data.subject !== undefined) variables.subject = data.subject;
    if (data.body !== undefined) variables.body = data.body;
    if (data.template_type !== undefined) variables.template_type = data.template_type;
    if (data.variables !== undefined) variables.variables = data.variables;
    if (data.is_active !== undefined) variables.is_active = data.is_active;

    const result = await graphqlRequest(MUTATION, variables);

    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to update SMTP template",
      };
    }

    if (result?.data?.update_mst_smtp_template_by_pk) {
      return {
        success: true,
        data: result.data.update_mst_smtp_template_by_pk,
        message: "SMTP template updated successfully",
      };
    }

    return {
      success: false,
      message: "Failed to update SMTP template",
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to update SMTP template",
    };
  }
};

/**
 * Delete SMTP template
 */
export const deleteMstSmtpTemplate = async (id: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || typeof id !== 'string' || !uuidRegex.test(id)) {
    return {
      success: false,
      message: "Invalid template ID format",
    };
  }

  const MUTATION = `mutation DeleteMstSmtpTemplate($id: uuid!) {
    delete_mst_smtp_template_by_pk(id: $id) {
      id
    }
  }`;

  try {
    const result = await graphqlRequest(MUTATION, { id });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to delete SMTP template",
      };
    }
    if (result?.data?.delete_mst_smtp_template_by_pk) {
      return {
        success: true,
        message: "SMTP template deleted successfully",
      };
    }
    return {
      success: false,
      message: "Failed to delete SMTP template",
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to delete SMTP template",
    };
  }
};
