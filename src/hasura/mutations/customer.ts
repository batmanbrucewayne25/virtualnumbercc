import { graphqlRequest } from "@/hasura";
import { normalizeDate } from "@/utils/dateComparison";

/**
 * Check if customer exists by email or phone
 */
export const checkMstCustomerExists = async (email: string, phone: string) => {
  const QUERY = `query CheckMstCustomerExists($email: String!, $phone: String!) {
    mst_customer(
      where: { 
        _or: [
          { email: { _eq: $email } }, 
          { phone: { _eq: $phone } }
        ] 
      }
    ) {
      id
      email
      phone
    }
  }`;

  try {
    const result = await graphqlRequest(QUERY, { email, phone });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to check customer",
        exists: false,
      };
    }
    if (result?.data?.mst_customer && result.data.mst_customer.length > 0) {
      return {
        success: true,
        exists: true,
        data: result.data.mst_customer[0],
      };
    }
    return {
      success: true,
      exists: false,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to check customer",
      exists: false,
    };
  }
};

/**
 * Create customer with all KYC data
 */
export const createMstCustomer = async (data: {
  reseller_id: string;
  email: string;
  password_hash: string;
  phone: string;
  business_email?: string;
  profile_name?: string;
  profile_image?: string;
  signature_hash?: string;
  signature_metadata?: any;
  signatureImage?: string;
  address?: any;
  pan_number?: string;
  pan_full_name?: string;
  pan_dob?: string;
  aadhaar_number?: string;
  aadhaar_dob?: string;
  dob_match_verified?: boolean;
  gender?: string;
  gstin?: string;
  business_name?: string;
  max_virtual_numbers?: number;
}) => {
  const MUTATION = `mutation CreateMstCustomer(
    $reseller_id: uuid!
    $email: String!
    $password_hash: String!
    $phone: String!
    $business_email: String
    $profile_name: String
    $profile_image: String
    $signature_hash: String
    $signature_metadata: jsonb
    $signatureImage: String
    $address: jsonb
    $pan_number: String
    $pan_full_name: String
    $pan_dob: date
    $aadhaar_number: String
    $aadhaar_dob: date
    $dob_match_verified: Boolean
    $gender: String
    $gstin: String
    $business_name: String
    $max_virtual_numbers: Int
  ) {
    insert_mst_customer_one(object: {
      reseller_id: $reseller_id
      email: $email
      password_hash: $password_hash
      phone: $phone
      business_email: $business_email
      profile_name: $profile_name
      profile_image: $profile_image
      signature_hash: $signature_hash
      signature_metadata: $signature_metadata
      signatureImage: $signatureImage
      address: $address
      pan_number: $pan_number
      pan_full_name: $pan_full_name
      pan_dob: $pan_dob
      aadhaar_number: $aadhaar_number
      aadhaar_dob: $aadhaar_dob
      dob_match_verified: $dob_match_verified
      gender: $gender
      gstin: $gstin
      business_name: $business_name
      max_virtual_numbers: $max_virtual_numbers
      status: "pending"
      kyc_status: "pending"
    }) {
      id
      reseller_id
      email
      phone
      business_email
      profile_name
      status
      kyc_status
      created_at
    }
  }`;

  try {
    const normalizedPanDob = data.pan_dob ? normalizeDate(data.pan_dob) || data.pan_dob : null;
    const normalizedAadhaarDob = data.aadhaar_dob ? normalizeDate(data.aadhaar_dob) || data.aadhaar_dob : null;
    const result = await graphqlRequest(MUTATION, {
      reseller_id: data.reseller_id,
      email: data.email,
      password_hash: data.password_hash,
      phone: data.phone,
      business_email: data.business_email || null,
      profile_name: data.profile_name || null,
      profile_image: data.profile_image || null,
      signature_hash: data.signature_hash || null,
      signature_metadata: data.signature_metadata || null,
      signatureImage: data.signatureImage || null,
      address: data.address || null,
      pan_number: data.pan_number || null,
      pan_full_name: data.pan_full_name || null,
      pan_dob: normalizedPanDob,
      aadhaar_number: data.aadhaar_number || null,
      aadhaar_dob: normalizedAadhaarDob,
      dob_match_verified: data.dob_match_verified || false,
      gender: data.gender || null,
      gstin: data.gstin || null,
      business_name: data.business_name || null,
      max_virtual_numbers: data.max_virtual_numbers || 3,
    });

    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to create customer",
        data: null,
      };
    }

    if (result?.data?.insert_mst_customer_one) {
      return {
        success: true,
        data: result.data.insert_mst_customer_one,
        message: "Customer created successfully",
      };
    }

    return {
      success: false,
      message: "Failed to create customer",
      data: null,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to create customer",
      data: null,
    };
  }
};

/**
 * Get customer by ID
 */
export const getMstCustomerById = async (id: string) => {
  const QUERY = `query GetMstCustomerById($id: uuid!) {
    mst_customer_by_pk(id: $id) {
      id
      reseller_id
      email
      phone
      business_email
      profile_name
      profile_image
      signature_hash
      signature_metadata
      signatureImage
      address
      status
      kyc_status
      approval
      rejection_reason
      pan_number
      pan_full_name
      pan_dob
      aadhaar_number
      aadhaar_dob
      dob_match_verified
      gender
      gstin
      business_name
      max_virtual_numbers
      created_at
      updated_at
      mst_virtual_numbers {
        id
        virtual_number
        call_forwarding_number
        purchase_date
        expiry_date
        days_left
        status
        is_auto_renew
        subscription_plan_id
        created_at
        updated_at
      }
    }
  }`;

  try {
    const result = await graphqlRequest(QUERY, { id });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to fetch customer",
        data: null,
      };
    }
    if (result?.data?.mst_customer_by_pk) {
      return {
        success: true,
        data: result.data.mst_customer_by_pk,
      };
    }
    return {
      success: false,
      message: "Customer not found",
      data: null,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to fetch customer",
      data: null,
    };
  }
};

/**
 * Get all customers (for admins)
 */
export const getAllMstCustomers = async () => {
  const QUERY = `query GetAllMstCustomers {
    mst_customer(
      order_by: { created_at: desc }
    ) {
      id
      reseller_id
      email
      phone
      business_email
      profile_name
      status
      kyc_status
      approval
      created_at
      updated_at
      pan_number
      pan_full_name
      aadhaar_number
      gstin
      business_name
      signatureImage
      mst_reseller {
        id
        first_name
        last_name
        business_name
        brand_name
        email
      }
    }
  }`;

  try {
    const result = await graphqlRequest(QUERY, {});
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to fetch customers",
        data: [],
      };
    }
    if (result?.data?.mst_customer) {
      return {
        success: true,
        data: result.data.mst_customer,
      };
    }
    return {
      success: false,
      data: [],
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to fetch customers",
      data: [],
    };
  }
};

/**
 * Get all customers for a reseller
 */
export const getMstCustomersByReseller = async (resellerId: string) => {
  const QUERY = `query GetMstCustomersByReseller($reseller_id: uuid!) {
    mst_customer(
      where: { reseller_id: { _eq: $reseller_id } }
      order_by: { created_at: desc }
    ) {
      id
      email
      phone
      business_email
      profile_name
      status
      kyc_status
      approval
      created_at
      updated_at
      pan_number
      pan_full_name
      aadhaar_number
      gstin
      business_name
      signatureImage
      mst_reseller {
        id
        first_name
        last_name
        business_name
        brand_name
        email
      }
    }
  }`;

  try {
    const result = await graphqlRequest(QUERY, { reseller_id: resellerId });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to fetch customers",
        data: [],
      };
    }
    if (result?.data?.mst_customer) {
      return {
        success: true,
        data: result.data.mst_customer,
      };
    }
    return {
      success: false,
      data: [],
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to fetch customers",
      data: [],
    };
  }
};

/**
 * Update customer status
 */
export const updateMstCustomerStatus = async (
  id: string,
  status: string,
  kyc_status?: string,
  rejection_reason?: string
) => {
  const MUTATION = `mutation UpdateMstCustomerStatus(
    $id: uuid!
    $status: String
    $kyc_status: String
    $rejection_reason: String
    $approval: String
  ) {
    update_mst_customer_by_pk(
      pk_columns: { id: $id }
      _set: {
        status: $status
        kyc_status: $kyc_status
        rejection_reason: $rejection_reason
        approval: $approval
      }
    ) {
      id
      status
      kyc_status
      rejection_reason
      approval
      updated_at
    }
  }`;

  try {
    // Set approval field based on status
    let approvalValue = null;
    if (status === "approved" || status === "active") {
      approvalValue = "approved";
    } else if (status === "rejected") {
      approvalValue = "rejected";
    }

    const result = await graphqlRequest(MUTATION, {
      id,
      status,
      kyc_status: kyc_status || null,
      rejection_reason: rejection_reason || null,
      approval: approvalValue,
    });

    if (result?.errors) {
      return {
        success: false,
        message:
          result.errors[0]?.message || "Failed to update customer status",
        data: null,
      };
    }

    if (result?.data?.update_mst_customer_by_pk) {
      return {
        success: true,
        data: result.data.update_mst_customer_by_pk,
        message: "Customer status updated successfully",
      };
    }

    return {
      success: false,
      message: "Failed to update customer status",
      data: null,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to update customer status",
      data: null,
    };
  }
};

/**
 * Update customer fields (for admin editing)
 */
export const updateMstCustomer = async (
  id: string,
  data: {
    gender?: string;
    pan_number?: string;
    pan_dob?: string;
    [key: string]: any;
  }
) => {
  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || typeof id !== 'string' || !uuidRegex.test(id)) {
    return {
      success: false,
      message: "Invalid customer ID format",
    };
  }

  // Build dynamic mutation - only include fields that have values
  const setFields: string[] = [];
  const variables: any = { id };
  const variableDefs: string[] = ['$id: uuid!'];

  // Add fields only if they have values
  if (data.gender !== undefined && data.gender !== null && data.gender !== '') {
    setFields.push('gender: $gender');
    variables.gender = data.gender;
    variableDefs.push('$gender: String');
  }
  if (data.pan_number !== undefined && data.pan_number !== null && data.pan_number !== '') {
    setFields.push('pan_number: $pan_number');
    variables.pan_number = data.pan_number;
    variableDefs.push('$pan_number: String');
  }
  if (data.pan_dob !== undefined && data.pan_dob !== null && data.pan_dob !== '') {
    setFields.push('pan_dob: $pan_dob');
    variables.pan_dob = normalizeDate(data.pan_dob) || data.pan_dob;
    variableDefs.push('$pan_dob: date');
  }

  // If no fields to update, return error
  if (setFields.length === 0) {
    return {
      success: false,
      message: "No fields to update",
    };
  }

  const MUTATION = `mutation UpdateMstCustomer(
    ${variableDefs.join('\n    ')}
  ) {
    update_mst_customer_by_pk(
      pk_columns: { id: $id }
      _set: {
        ${setFields.join('\n        ')}
      }
    ) {
      id
      gender
      pan_number
      pan_dob
      updated_at
    }
  }`;

  try {
    const result = await graphqlRequest(MUTATION, variables);

    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to update customer",
      };
    }

    if (result?.data?.update_mst_customer_by_pk) {
      return {
        success: true,
        data: result.data.update_mst_customer_by_pk,
        message: "Customer updated successfully",
      };
    }

    return {
      success: false,
      message: "Failed to update customer",
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to update customer",
    };
  }
};

/**
 * Update customer signature
 */
export const updateCustomerSignature = async ({ 
  email, 
  signatureImage 
}: { 
  email: string; 
  signatureImage: string;
}) => {
  const MUTATION = `mutation UpdateCustomerSignature(
    $email: String!
    $signatureImage: String!
  ) {
    update_mst_customer(
      where: { email: { _eq: $email } }
      _set: {
        signatureImage: $signatureImage
      }
    ) {
      affected_rows
      returning {
        id
        email
        signatureImage
      }
    }
  }`;

  try {
    const result = await graphqlRequest(MUTATION, { email, signatureImage });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to update customer signature",
        data: null,
      };
    }
    if (result?.data?.update_mst_customer && result.data.update_mst_customer.returning.length > 0) {
      return {
        success: true,
        data: result.data.update_mst_customer.returning[0],
        message: "Signature updated successfully",
      };
    }
    return {
      success: false,
      message: "Failed to update customer signature",
      data: null,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to update customer signature",
      data: null,
    };
  }
};

/**
 * Update customer profile name and business name by email
 */
export const updateCustomerProfileName = async ({
  email,
  profile_name,
  business_name,
}: {
  email: string;
  profile_name?: string;
  business_name?: string;
}) => {
  const MUTATION = `mutation UpdateCustomerProfileName(
    $email: String!
    $profile_name: String
    $business_name: String
  ) {
    update_mst_customer(
      where: { email: { _eq: $email } }
      _set: {
        profile_name: $profile_name
        business_name: $business_name
      }
    ) {
      affected_rows
      returning {
        id
        email
        profile_name
        business_name
      }
    }
  }`;

  try {
    const result = await graphqlRequest(MUTATION, {
      email,
      profile_name: profile_name || null,
      business_name: business_name || null,
    });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to update profile name",
        data: null,
      };
    }
    if (result?.data?.update_mst_customer?.returning?.length > 0) {
      return {
        success: true,
        data: result.data.update_mst_customer.returning[0],
      };
    }
    return { success: false, message: "Failed to update profile name", data: null };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to update profile name",
      data: null,
    };
  }
};

/**
 * Get customer by email
 */
export const getMstCustomerByEmail = async ({ email }: { email: string }) => {
  const QUERY = `query GetMstCustomerByEmail($email: String!) {
    mst_customer(
      where: { email: { _eq: $email } }
      limit: 1
    ) {
      id
      email
      phone
      pan_number
      pan_full_name
      pan_dob
      aadhaar_number
      aadhaar_dob
      dob_match_verified
      gender
      address
      profile_image
      signatureImage
      created_at
      updated_at
    }
  }`;

  try {
    const result = await graphqlRequest(QUERY, { email });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to fetch customer",
        data: null,
      };
    }
    if (result?.data?.mst_customer && result.data.mst_customer.length > 0) {
      return {
        success: true,
        data: { mst_customer: result.data.mst_customer },
      };
    }
    return {
      success: true,
      data: { mst_customer: [] },
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to fetch customer",
      data: null,
    };
  }
};

/**
 * Update customer PAN step
 */
export const updateCustomerPanStep = async ({ 
  email, 
  pan_number, 
  pan_dob, 
  pan_full_name 
}: { 
  email: string; 
  pan_number?: string; 
  pan_dob?: string; 
  pan_full_name?: string;
}) => {
  const UPDATE_PAN = `mutation UpdateCustomerPanStep(
    $email: String!, 
    $pan_number: String, 
    $pan_dob: date, 
    $pan_full_name: String
  ) {
    update_mst_customer(
      where: { email: { _eq: $email } }, 
      _set: { 
        pan_number: $pan_number, 
        pan_dob: $pan_dob, 
        pan_full_name: $pan_full_name
      }
    ) {
      affected_rows
      returning {
        id
        email
        pan_number
        pan_dob
        pan_full_name
      }
    }
  }`;

  const normalizedPanDob = pan_dob ? normalizeDate(pan_dob) || pan_dob : null;
  return graphqlRequest(UPDATE_PAN, { 
    email, 
    pan_number: pan_number || null, 
    pan_dob: normalizedPanDob, 
    pan_full_name: pan_full_name || null 
  });
};

/**
 * Update customer Aadhaar step
 */
export const updateCustomerAadhaarStep = async ({ 
  email, 
  aadhaar_number, 
  dob, 
  gender, 
  aadhar_photo, 
  address 
}: { 
  email: string; 
  aadhaar_number?: string; 
  dob?: string; 
  gender?: string; 
  aadhar_photo?: string; 
  address?: any;
}) => {
  // Build dynamic mutation - only include fields that have values
  const setFields: string[] = [];
  const variables: any = { email };
  const variableDefs: string[] = ['$email: String!'];

  // Add fields only if they have values
  if (aadhaar_number !== undefined && aadhaar_number !== null && aadhaar_number !== '') {
    setFields.push('aadhaar_number: $aadhaar_number');
    variables.aadhaar_number = aadhaar_number;
    variableDefs.push('$aadhaar_number: String');
  }
  if (dob !== undefined && dob !== null && dob !== '') {
    setFields.push('aadhaar_dob: $aadhaar_dob');
    variables.aadhaar_dob = normalizeDate(dob) || dob;
    variableDefs.push('$aadhaar_dob: date');
  }
  if (gender) {
    setFields.push('gender: $gender');
    variables.gender = gender;
    variableDefs.push('$gender: String');
  }
  if (aadhar_photo) {
    // Note: customer table might use different field name, adjust as needed
    setFields.push('profile_image: $profile_image');
    variables.profile_image = aadhar_photo;
    variableDefs.push('$profile_image: String');
  }
  if (address) {
    setFields.push('address: $address');
    variables.address = address;
    variableDefs.push('$address: jsonb');
  }

  // If no fields to update, return early
  if (setFields.length === 0) {
    return {
      errors: [],
      data: { update_mst_customer: { affected_rows: 0 } }
    };
  }

  const UPDATE_AADHAAR = `mutation UpdateCustomerAadhaarStep(
    ${variableDefs.join('\n    ')}
  ) {
    update_mst_customer(
      where: { email: { _eq: $email } }
      _set: {
        ${setFields.join('\n        ')}
      }
    ) {
      affected_rows
      returning {
        id
        email
        aadhaar_number
        aadhaar_dob
        gender
        address
        profile_image
      }
    }
  }`;

  console.log("UpdateCustomerAadhaarStep mutation:", {
    variables: { ...variables, aadhar_photo: variables.profile_image?.substring(0, 50) },
    setFields,
  });

  const result = await graphqlRequest(UPDATE_AADHAAR, variables);
  
  console.log("UpdateCustomerAadhaarStep result:", result);
  
  return result;
};