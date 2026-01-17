import { graphqlRequest } from "@/hasura";

/**
 * Get WhatsApp templates by reseller ID
 */
export const getMstWhatsappTemplatesByResellerId = async (resellerId: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!resellerId || typeof resellerId !== 'string' || !uuidRegex.test(resellerId)) {
    return {
      success: false,
      message: "Invalid reseller ID format",
      data: [],
    };
  }

  const QUERY = `query GetMstWhatsappTemplatesByResellerId($reseller_id: uuid!) {
    mst_whatsapp_template(
      where: { reseller_id: { _eq: $reseller_id } }
      order_by: { created_at: desc }
    ) {
      id
      reseller_id
      template_name
      template_id
      message_body
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
        message: result.errors[0]?.message || "Failed to fetch WhatsApp templates",
        data: [],
      };
    }
    return {
      success: true,
      data: result?.data?.mst_whatsapp_template || [],
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to fetch WhatsApp templates",
      data: [],
    };
  }
};

/**
 * Get WhatsApp template by ID
 */
export const getMstWhatsappTemplateById = async (id: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || typeof id !== 'string' || !uuidRegex.test(id)) {
    return {
      success: false,
      message: "Invalid template ID format",
      data: null,
    };
  }

  const QUERY = `query GetMstWhatsappTemplateById($id: uuid!) {
    mst_whatsapp_template_by_pk(id: $id) {
      id
      reseller_id
      template_name
      template_id
      message_body
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
        message: result.errors[0]?.message || "Failed to fetch WhatsApp template",
        data: null,
      };
    }
    if (result?.data?.mst_whatsapp_template_by_pk) {
      return {
        success: true,
        data: result.data.mst_whatsapp_template_by_pk,
      };
    }
    return {
      success: false,
      message: "WhatsApp template not found",
      data: null,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to fetch WhatsApp template",
      data: null,
    };
  }
};

/**
 * Create WhatsApp template
 */
export const createMstWhatsappTemplate = async (
  resellerId: string,
  data: {
    template_name: string;
    template_id: string;
    message_body: string;
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

  const MUTATION = `mutation CreateMstWhatsappTemplate(
    $reseller_id: uuid!
    $template_name: String!
    $template_id: String!
    $message_body: String!
    $template_type: String
    $variables: jsonb
    $is_active: Boolean
  ) {
    insert_mst_whatsapp_template_one(object: {
      reseller_id: $reseller_id
      template_name: $template_name
      template_id: $template_id
      message_body: $message_body
      template_type: $template_type
      variables: $variables
      is_active: $is_active
    }) {
      id
      reseller_id
      template_name
      template_id
      message_body
      template_type
      variables
      is_active
    }
  }`;

  try {
    const result = await graphqlRequest(MUTATION, {
      reseller_id: resellerId,
      template_name: data.template_name,
      template_id: data.template_id,
      message_body: data.message_body,
      template_type: data.template_type || null,
      variables: data.variables || null,
      is_active: data.is_active !== undefined ? data.is_active : true,
    });

    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to create WhatsApp template",
      };
    }

    if (result?.data?.insert_mst_whatsapp_template_one) {
      return {
        success: true,
        data: result.data.insert_mst_whatsapp_template_one,
        message: "WhatsApp template created successfully",
      };
    }

    return {
      success: false,
      message: "Failed to create WhatsApp template",
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to create WhatsApp template",
    };
  }
};

/**
 * Update WhatsApp template
 */
export const updateMstWhatsappTemplate = async (
  id: string,
  data: {
    template_name?: string;
    template_id?: string;
    message_body?: string;
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

  const MUTATION = `mutation UpdateMstWhatsappTemplate(
    $id: uuid!
    $template_name: String
    $template_id: String
    $message_body: String
    $template_type: String
    $variables: jsonb
    $is_active: Boolean
  ) {
    update_mst_whatsapp_template_by_pk(
      pk_columns: { id: $id }
      _set: {
        template_name: $template_name
        template_id: $template_id
        message_body: $message_body
        template_type: $template_type
        variables: $variables
        is_active: $is_active
      }
    ) {
      id
      template_name
      template_id
      message_body
      template_type
      variables
      is_active
    }
  }`;

  try {
    const variables: any = { id };
    if (data.template_name !== undefined) variables.template_name = data.template_name;
    if (data.template_id !== undefined) variables.template_id = data.template_id;
    if (data.message_body !== undefined) variables.message_body = data.message_body;
    if (data.template_type !== undefined) variables.template_type = data.template_type;
    if (data.variables !== undefined) variables.variables = data.variables;
    if (data.is_active !== undefined) variables.is_active = data.is_active;

    const result = await graphqlRequest(MUTATION, variables);

    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to update WhatsApp template",
      };
    }

    if (result?.data?.update_mst_whatsapp_template_by_pk) {
      return {
        success: true,
        data: result.data.update_mst_whatsapp_template_by_pk,
        message: "WhatsApp template updated successfully",
      };
    }

    return {
      success: false,
      message: "Failed to update WhatsApp template",
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to update WhatsApp template",
    };
  }
};

/**
 * Delete WhatsApp template
 */
export const deleteMstWhatsappTemplate = async (id: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || typeof id !== 'string' || !uuidRegex.test(id)) {
    return {
      success: false,
      message: "Invalid template ID format",
    };
  }

  const MUTATION = `mutation DeleteMstWhatsappTemplate($id: uuid!) {
    delete_mst_whatsapp_template_by_pk(id: $id) {
      id
    }
  }`;

  try {
    const result = await graphqlRequest(MUTATION, { id });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to delete WhatsApp template",
      };
    }
    if (result?.data?.delete_mst_whatsapp_template_by_pk) {
      return {
        success: true,
        message: "WhatsApp template deleted successfully",
      };
    }
    return {
      success: false,
      message: "Failed to delete WhatsApp template",
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to delete WhatsApp template",
    };
  }
};
