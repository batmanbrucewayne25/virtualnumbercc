import { graphqlRequest } from "@/hasura";

export type AllowedCustomerRow = {
  id: string;
  email: string | null;
  phone: string | null;
  created_at: string;
};

function normalizeEmail(email: string | null | undefined): string | null {
  if (email == null || typeof email !== "string") return null;
  const v = email.trim().toLowerCase();
  return v === "" ? null : v;
}

function normalizePhone(phone: string | null | undefined): string | null {
  if (phone == null || typeof phone !== "string") return null;
  const v = phone.replace(/\D/g, "");
  return v.length >= 10 ? v : null;
}

/**
 * List allowed customers for a reseller (via Hasura).
 */
export const getResellerAllowedCustomers = async (
  resellerId: string
): Promise<{ success: boolean; data?: AllowedCustomerRow[]; message?: string }> => {
  const QUERY = `query GetResellerAllowedCustomers($reseller_id: uuid!) {
    reseller_allowed_customer(
      where: { reseller_id: { _eq: $reseller_id } }
      order_by: { created_at: desc }
    ) {
      id
      email
      phone
      created_at
    }
  }`;
  try {
    const result = await graphqlRequest(QUERY, { reseller_id: resellerId });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to fetch list",
      };
    }
    const rows = result?.data?.reseller_allowed_customer ?? [];
    return { success: true, data: rows };
  } catch (e: any) {
    return {
      success: false,
      message: e?.message || "Failed to fetch allowed customers",
    };
  }
};

/**
 * Insert one allowed customer. At least one of email or phone required. Values are normalized.
 */
export const insertResellerAllowedCustomerOne = async (
  resellerId: string,
  payload: { email?: string | null; phone?: string | null }
): Promise<{ success: boolean; data?: AllowedCustomerRow; message?: string }> => {
  const email = normalizeEmail(payload.email);
  const phone = normalizePhone(payload.phone);
  if (!email && !phone) {
    return { success: false, message: "At least one of email or phone is required." };
  }
  const MUTATION = `mutation InsertResellerAllowedCustomerOne(
    $reseller_id: uuid!
    $email: String
    $phone: String
  ) {
    insert_reseller_allowed_customer_one(
      object: { reseller_id: $reseller_id, email: $email, phone: $phone }
    ) {
      id
      email
      phone
      created_at
    }
  }`;
  try {
    const result = await graphqlRequest(MUTATION, {
      reseller_id: resellerId,
      email: email ?? null,
      phone: phone ?? null,
    });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to add contact",
      };
    }
    const row = result?.data?.insert_reseller_allowed_customer_one;
    if (!row) return { success: false, message: "No data returned" };
    return { success: true, data: row };
  } catch (e: any) {
    return {
      success: false,
      message: e?.message || "Failed to add allowed customer",
    };
  }
};

/**
 * Update one allowed customer by primary key.
 */
export const updateResellerAllowedCustomerByPk = async (
  id: string,
  payload: { email?: string | null; phone?: string | null }
): Promise<{ success: boolean; message?: string }> => {
  const email = payload.email !== undefined ? normalizeEmail(payload.email) : undefined;
  const phone = payload.phone !== undefined ? normalizePhone(payload.phone) : undefined;
  if (email !== undefined && phone !== undefined && !email && !phone) {
    return { success: false, message: "At least one of email or phone must be set." };
  }
  const setClause: string[] = [];
  const variables: Record<string, unknown> = { id };
  if (email !== undefined) {
    setClause.push("email: $email");
    variables.email = email;
  }
  if (phone !== undefined) {
    setClause.push("phone: $phone");
    variables.phone = phone;
  }
  if (setClause.length === 0) return { success: true };
  const varDefs = ["$id: uuid!"];
  if (email !== undefined) varDefs.push("$email: String");
  if (phone !== undefined) varDefs.push("$phone: String");
  const MUTATION = `mutation UpdateResellerAllowedCustomerByPk(${varDefs.join(", ")}) {
    update_reseller_allowed_customer_by_pk(
      pk_columns: { id: $id }
      _set: { ${setClause.join(", ")} }
    ) {
      id
    }
  }`;
  try {
    const result = await graphqlRequest(MUTATION, variables);
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to update",
      };
    }
    if (!result?.data?.update_reseller_allowed_customer_by_pk) {
      return { success: false, message: "Update failed" };
    }
    return { success: true };
  } catch (e: any) {
    return {
      success: false,
      message: e?.message || "Failed to update allowed customer",
    };
  }
};

/**
 * Delete one allowed customer by primary key.
 */
export const deleteResellerAllowedCustomerByPk = async (
  id: string
): Promise<{ success: boolean; message?: string }> => {
  const MUTATION = `mutation DeleteResellerAllowedCustomerByPk($id: uuid!) {
    delete_reseller_allowed_customer_by_pk(id: $id) {
      id
    }
  }`;
  try {
    const result = await graphqlRequest(MUTATION, { id });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to delete",
      };
    }
    if (!result?.data?.delete_reseller_allowed_customer_by_pk) {
      return { success: false, message: "Delete failed" };
    }
    return { success: true };
  } catch (e: any) {
    return {
      success: false,
      message: e?.message || "Failed to delete allowed customer",
    };
  }
};

/**
 * Delete all allowed customers for a reseller (for bulk replace).
 */
export const deleteResellerAllowedCustomers = async (
  resellerId: string
): Promise<{ success: boolean; affected_rows?: number; message?: string }> => {
  const MUTATION = `mutation DeleteResellerAllowedCustomers($reseller_id: uuid!) {
    delete_reseller_allowed_customer(where: { reseller_id: { _eq: $reseller_id } }) {
      affected_rows
    }
  }`;
  try {
    const result = await graphqlRequest(MUTATION, { reseller_id: resellerId });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to delete all",
      };
    }
    const affected =
      result?.data?.delete_reseller_allowed_customer?.affected_rows ?? 0;
    return { success: true, affected_rows: affected };
  } catch (e: any) {
    return {
      success: false,
      message: e?.message || "Failed to delete allowed customers",
    };
  }
};

export type AllowedCustomerInsertInput = {
  reseller_id: string;
  email?: string | null;
  phone?: string | null;
};

/**
 * Bulk insert allowed customers (after normalizing email/phone). Used for upload.
 */
export const insertResellerAllowedCustomers = async (
  objects: AllowedCustomerInsertInput[]
): Promise<{ success: boolean; affected_rows?: number; message?: string }> => {
  const normalized = objects.map((o) => ({
    reseller_id: o.reseller_id,
    email: normalizeEmail(o.email) ?? undefined,
    phone: normalizePhone(o.phone) ?? undefined,
  })).filter((o) => o.email != null || o.phone != null);
  if (normalized.length === 0) {
    return { success: true, affected_rows: 0 };
  }
  const MUTATION = `mutation InsertResellerAllowedCustomers($objects: [reseller_allowed_customer_insert_input!]!) {
    insert_reseller_allowed_customer(objects: $objects) {
      affected_rows
    }
  }`;
  try {
    const result = await graphqlRequest(MUTATION, { objects: normalized });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to bulk insert",
      };
    }
    const affected = result?.data?.insert_reseller_allowed_customer?.affected_rows ?? 0;
    return { success: true, affected_rows: affected };
  } catch (e: any) {
    return {
      success: false,
      message: e?.message || "Failed to insert allowed customers",
    };
  }
};

export {
  normalizeEmail as normalizeAllowedCustomerEmail,
  normalizePhone as normalizeAllowedCustomerPhone,
};
