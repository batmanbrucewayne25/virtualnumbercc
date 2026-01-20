import { graphqlRequest } from "@/hasura";

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
  signature_storage_url?: string;
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
    $signature_storage_url: String
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
      signature_storage_url: $signature_storage_url
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
      signature_storage_url: data.signature_storage_url || null,
      address: data.address || null,
      pan_number: data.pan_number || null,
      pan_full_name: data.pan_full_name || null,
      pan_dob: data.pan_dob || null,
      aadhaar_number: data.aadhaar_number || null,
      aadhaar_dob: data.aadhaar_dob || null,
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
      signature_storage_url
      address
      status
      kyc_status
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
      created_at
      updated_at
      pan_number
      pan_full_name
      aadhaar_number
      gstin
      business_name
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
  ) {
    update_mst_customer_by_pk(
      pk_columns: { id: $id }
      _set: {
        status: $status
        kyc_status: $kyc_status
        rejection_reason: $rejection_reason
      }
    ) {
      id
      status
      kyc_status
      rejection_reason
      updated_at
    }
  }`;

  try {
    const result = await graphqlRequest(MUTATION, {
      id,
      status,
      kyc_status: kyc_status || null,
      rejection_reason: rejection_reason || null,
    });

    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to update customer status",
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

