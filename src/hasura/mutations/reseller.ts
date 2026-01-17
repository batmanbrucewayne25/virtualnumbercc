import { graphqlRequest } from "@/hasura";
import { createMstWallet, creditWallet } from "./wallet";
import { upsertNumberLimits } from "./numberLimits";

/**
 * Get all resellers (excluding soft-deleted records)
 */
export const getMstResellers = async () => {
  const QUERY = `query GetMstResellers {
    mst_reseller(
      where: { _or: [{ isDelete: { _is_null: true } }, { isDelete: { _eq: false } }] }
      order_by: { created_at: desc }
    ) {
      id
      first_name
      last_name
      email
      phone
      business_name
      business_email
      gstin
      status
      signup_completed
      created_at
      updated_at
      isDelete
      approval_date
      approved_by
      rejection_reason
      grace_period_days
      mst_wallet {
        id
        reseller_id
        user_type
        balance
        credit_amount
        debit_amount
        last_transaction_at
        created_at
        updated_at
      }
    }
  }`;

  try {
    const result = await graphqlRequest(QUERY);
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to fetch resellers",
        data: [],
      };
    }
    if (result?.data?.mst_reseller) {
      return {
        success: true,
        data: result.data.mst_reseller,
      };
    }
    return {
      success: false,
      data: [],
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || "Failed to fetch resellers",
      data: [],
    };
  }
};

/**
 * Get reseller by ID
 */
export const getMstResellerById = async (id: string) => {
  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || typeof id !== 'string' || !uuidRegex.test(id)) {
    return {
      success: false,
      message: "Invalid reseller ID format",
      data: null,
    };
  }

  const QUERY = `query GetMstResellerById($id: uuid!) {
    mst_reseller_by_pk(id: $id) {
      id
      first_name
      last_name
      email
      phone
      business_name
      business_email
      gstin
      gstin_status
      status
      signup_completed
      created_at
      updated_at
      address
      dob
      gender
      pan_number
      aadhaar_number
      business_address
      constitution_of_business
      nature_bus_activities
      legal_name
      referral_link
      approval_date
      approved_by
      rejection_reason
      grace_period_days
      mst_wallet {
        id
        reseller_id
        user_type
        balance
        credit_amount
        debit_amount
        last_transaction_at
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
        message: result.errors[0]?.message || "Failed to fetch reseller",
        data: null,
      };
    }
    if (result?.data?.mst_reseller_by_pk) {
      return {
        success: true,
        data: result.data.mst_reseller_by_pk,
      };
    }
    return {
      success: false,
      message: "Reseller not found",
      data: null,
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || "Failed to fetch reseller",
      data: null,
    };
  }
};

/**
 * Soft delete reseller by ID (sets isDelete to true)
 */
export const deleteMstReseller = async (id: string) => {
  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || typeof id !== 'string' || !uuidRegex.test(id)) {
    return {
      success: false,
      message: "Invalid reseller ID format",
    };
  }

  const MUTATION = `mutation SoftDeleteMstReseller($id: uuid!) {
    update_mst_reseller_by_pk(
      pk_columns: { id: $id }
      _set: { isDelete: true }
    ) {
      id
      isDelete
    }
  }`;

  try {
    const result = await graphqlRequest(MUTATION, { id });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to delete reseller",
      };
    }
    if (result?.data?.update_mst_reseller_by_pk) {
      return {
        success: true,
        message: "Reseller deleted successfully",
      };
    }
    return {
      success: false,
      message: "Failed to delete reseller",
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || "Failed to delete reseller",
    };
  }
};

/**
 * Update reseller
 */
export const updateMstReseller = async (id: string, data: {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  business_name?: string;
  business_email?: string;
  gstin?: string;
  status?: boolean;
  address?: string;
  dob?: string;
  gender?: string;
  pan_number?: string;
  aadhaar_number?: string;
  business_address?: string;
  constitution_of_business?: string;
  nature_bus_activities?: string;
  legal_name?: string;
  [key: string]: any;
}) => {
  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || typeof id !== 'string' || !uuidRegex.test(id)) {
    return {
      success: false,
      message: "Invalid reseller ID format",
    };
  }

  const MUTATION = `mutation UpdateMstReseller(
    $id: uuid!
    $first_name: String
    $last_name: String
    $email: String
    $phone: String
    $business_name: String
    $business_email: String
    $gstin: String
    $status: Boolean
    $address: String
    $dob: String
    $gender: String
    $pan_number: String
    $aadhaar_number: String
    $business_address: String
    $constitution_of_business: String
    $nature_bus_activities: String
    $legal_name: String
  ) {
    update_mst_reseller_by_pk(
      pk_columns: { id: $id }
      _set: {
        first_name: $first_name
        last_name: $last_name
        email: $email
        phone: $phone
        business_name: $business_name
        business_email: $business_email
        gstin: $gstin
        status: $status
        address: $address
        dob: $dob
        gender: $gender
        pan_number: $pan_number
        aadhaar_number: $aadhaar_number
        business_address: $business_address
        constitution_of_business: $constitution_of_business
        nature_bus_activities: $nature_bus_activities
        legal_name: $legal_name
      }
    ) {
      id
      first_name
      last_name
      email
      phone
      business_name
      business_email
      gstin
      status
      updated_at
    }
  }`;

  try {
    // Remove undefined values before sending
    const cleanedData: any = {};
    Object.keys(data).forEach(key => {
      if (data[key] !== undefined) {
        cleanedData[key] = data[key];
      }
    });

    const result = await graphqlRequest(MUTATION, { id, ...cleanedData });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to update reseller",
      };
    }
    if (result?.data?.update_mst_reseller_by_pk) {
      return {
        success: true,
        data: result.data.update_mst_reseller_by_pk,
        message: "Reseller updated successfully",
      };
    }
    return {
      success: false,
      message: "Failed to update reseller",
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || "Failed to update reseller",
    };
  }
};

/**
 * Approve reseller
 */
export const approveMstReseller = async (
  id: string,
  approvedBy: string,
  data: {
    wallet_balance?: number;
    grace_period_days?: number;
    virtual_numbers_count?: number;
    price_per_number?: number;
  }
) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || typeof id !== 'string' || !uuidRegex.test(id)) {
    return {
      success: false,
      message: "Invalid reseller ID format",
    };
  }
  if (!approvedBy || typeof approvedBy !== 'string' || !uuidRegex.test(approvedBy)) {
    return {
      success: false,
      message: "Invalid approved_by ID format",
    };
  }

  const MUTATION = `mutation ApproveMstReseller(
    $id: uuid!
    $approved_by: uuid!
    $approval_date: timestamp!
    $grace_period_days: Int
    $rejection_reason: String
  ) {
    update_mst_reseller_by_pk(
      pk_columns: { id: $id }
      _set: {
        approval_date: $approval_date
        approved_by: $approved_by
        rejection_reason: $rejection_reason
        grace_period_days: $grace_period_days
        status: true
      }
    ) {
      id
      approval_date
      approved_by
      rejection_reason
      grace_period_days
      status
    }
  }`;

  try {
    const approvalDate = new Date().toISOString();
    const variables: any = {
      id,
      approved_by: approvedBy,
      approval_date: approvalDate,
      rejection_reason: null,
    };

    if (data.grace_period_days !== undefined) {
      variables.grace_period_days = data.grace_period_days;
    }

    // Update reseller approval status
    const result = await graphqlRequest(MUTATION, variables);
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to approve reseller",
      };
    }
    if (!result?.data?.update_mst_reseller_by_pk) {
      return {
        success: false,
        message: "Failed to approve reseller",
      };
    }

    // Create wallet and credit initial balance if provided
    if (data.wallet_balance !== undefined && data.wallet_balance > 0) {
      const walletResult = await creditWallet(
        id,
        data.wallet_balance,
        `Initial wallet balance upon approval`,
        `APPROVAL_${id}`
      );

      if (!walletResult.success) {
        // Log warning but don't fail the approval
        console.warn("Failed to create wallet:", walletResult.message);
      }
    }

    // Update number limits if virtual_numbers_count is provided
    if (data.virtual_numbers_count !== undefined && data.virtual_numbers_count !== null) {
      const numberLimitsResult = await upsertNumberLimits(
        id,
        data.virtual_numbers_count
      );

      if (!numberLimitsResult.success) {
        // Log warning but don't fail the approval
        console.warn("Failed to update number limits:", numberLimitsResult.message);
      }
    }

    return {
      success: true,
      data: result.data.update_mst_reseller_by_pk,
      message: "Reseller approved successfully",
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || "Failed to approve reseller",
    };
  }
};

/**
 * Reject reseller
 */
export const rejectMstReseller = async (
  id: string,
  approvedBy: string,
  rejectionReason: string
) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || typeof id !== 'string' || !uuidRegex.test(id)) {
    return {
      success: false,
      message: "Invalid reseller ID format",
    };
  }
  if (!approvedBy || typeof approvedBy !== 'string' || !uuidRegex.test(approvedBy)) {
    return {
      success: false,
      message: "Invalid approved_by ID format",
    };
  }
  if (!rejectionReason || typeof rejectionReason !== 'string' || rejectionReason.trim() === '') {
    return {
      success: false,
      message: "Rejection reason is required",
    };
  }

  const MUTATION = `mutation RejectMstReseller(
    $id: uuid!
    $rejection_reason: String!
    $status: Boolean!
  ) {
    update_mst_reseller_by_pk(
      pk_columns: { id: $id }
      _set: {
        rejection_reason: $rejection_reason
        approval_date: null
        approved_by: null
        status: $status
      }
    ) {
      id
      rejection_reason
      approval_date
      approved_by
      status
    }
  }`;

  try {
    const result = await graphqlRequest(MUTATION, {
      id,
      rejection_reason: rejectionReason.trim(),
      status: false,
    });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to reject reseller",
      };
    }
    if (result?.data?.update_mst_reseller_by_pk) {
      return {
        success: true,
        data: result.data.update_mst_reseller_by_pk,
        message: "Reseller rejected successfully",
      };
    }
    return {
      success: false,
      message: "Failed to reject reseller",
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || "Failed to reject reseller",
    };
  }
};
