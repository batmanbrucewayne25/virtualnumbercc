import { graphqlRequest } from "@/hasura";
import { createMstWallet, creditWallet } from "./wallet";
import { upsertNumberLimits } from "./numberLimits";
import { upsertResellerValidity, createResellerValidityHistory, getResellerValidity } from "./resellerValidity";

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
      suspended_reason
      suspended_at
      suspended_by
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
      pan_dob
      pan_full_name
      aadhaar_number
      aadhar_photo
      business_address
      constitution_of_business
      nature_bus_activities
      legal_name
      gst_pan_number
      referral_link
      approval_date
      approved_by
      rejection_reason
      grace_period_days
      current_step
      is_aadhaar_verified
      is_pan_verified
      is_gst_verified
      is_email_verified
      is_phone_verified
      profile_image
      suspended_reason
      suspended_at
      suspended_by
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
  address?: string[] | string;
  dob?: string;
  gender?: string;
  pan_number?: string;
  pan_dob?: string;
  aadhaar_number?: string;
  business_address?: string;
  constitution_of_business?: string;
  nature_bus_activities?: string;
  legal_name?: string;
  gst_pan_number?: string;
  gstin_status?: string;
  validity_date?: string | null;
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
    $address: [String!]
    $dob: String
    $gender: String
    $pan_number: String
    $pan_dob: String
    $aadhaar_number: String
    $business_address: String
    $constitution_of_business: String
    $nature_bus_activities: String
    $legal_name: String
    $gst_pan_number: String
    $gstin_status: String
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
        pan_dob: $pan_dob
        aadhaar_number: $aadhaar_number
        business_address: $business_address
        constitution_of_business: $constitution_of_business
        nature_bus_activities: $nature_bus_activities
        legal_name: $legal_name
        gst_pan_number: $gst_pan_number
        gstin_status: $gstin_status
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
    // Extract validity_date before processing other fields
    const validityDate = data.validity_date;
    
    // Remove undefined values before sending and handle address array
    const cleanedData: any = {};
    Object.keys(data).forEach(key => {
      // Skip validity_date as it's not a field in mst_reseller table
      if (key === 'validity_date') {
        return;
      }
      
      if (data[key] !== undefined) {
        // Handle address field - convert string to array if needed
        if (key === 'address' && typeof data[key] === 'string') {
          // If address is a string, convert to array (split by newline or comma)
          const addressStr = data[key] as string;
          cleanedData[key] = addressStr.trim() ? addressStr.split(/\n|,/).map(a => a.trim()).filter(a => a) : null;
        } else if (key === 'address' && Array.isArray(data[key])) {
          // If already an array, use it as is
          cleanedData[key] = (data[key] as string[]).length > 0 ? data[key] : null;
        } else {
          cleanedData[key] = data[key];
        }
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
      // Handle validity date update if provided
      if (validityDate) {
        try {
          const { getResellerValidity, upsertResellerValidity, createResellerValidityHistory } = await import('./resellerValidity');
          const { getMstWalletByResellerId } = await import('./wallet');

          // Get current validity for history
          const currentValidityResult = await getResellerValidity(id);
          const currentValidity = currentValidityResult.success ? currentValidityResult.data : null;

          // Get wallet ID (needed for validity update)
          let walletId: string | null = null;
          const walletResult = await getMstWalletByResellerId(id);
          if (walletResult.success && walletResult.data) {
            walletId = walletResult.data.id;
          } else {
            // If no wallet exists, create one with 0 balance
            const { createMstWallet } = await import('./wallet');
            const createWalletResult = await createMstWallet({
              reseller_id: id,
              balance: 0,
              credit_amount: 0,
            });
            if (createWalletResult.success && createWalletResult.data) {
              walletId = createWalletResult.data.id;
            }
          }

          if (walletId) {
            // Calculate validity dates
            const now = new Date();
            // If there's a current validity, use its start date, otherwise use now
            const validityStartDate = currentValidity?.validity_start_date 
              ? new Date(currentValidity.validity_start_date).toISOString()
              : now.toISOString();
            const validityEndDate = new Date(validityDate);
            validityEndDate.setHours(23, 59, 59, 999); // Set to end of day
            const validityDays = Math.ceil((validityEndDate.getTime() - new Date(validityStartDate).getTime()) / (1000 * 60 * 60 * 24));

            if (validityDays > 0) {
              // Upsert validity
              const validityResult = await upsertResellerValidity({
                reseller_id: id,
                validity_start_date: validityStartDate,
                validity_end_date: validityEndDate.toISOString(),
                validity_days: validityDays,
                last_wallet_id: walletId,
                last_recharge_amount: currentValidity?.last_recharge_amount || 0,
                status: 'ACTIVE',
              });

              if (!validityResult.success) {
                console.warn('Failed to update reseller validity:', validityResult.message);
              } else {
                // Create history record
                const historyResult = await createResellerValidityHistory({
                  reseller_id: id,
                  wallet_id: walletId,
                  recharge_amount: currentValidity?.last_recharge_amount || 0,
                  previous_validity_start: currentValidity?.validity_start_date || null,
                  previous_validity_end: currentValidity?.validity_end_date || null,
                  new_validity_start: validityStartDate,
                  new_validity_end: validityEndDate.toISOString(),
                  validity_days: validityDays,
                  action: 'ADMIN_UPDATE',
                });

                if (!historyResult.success) {
                  console.warn('Failed to create validity history:', historyResult.message);
                }
              }
            }
          } else {
            console.warn('Cannot update validity: Wallet could not be created or retrieved');
          }
        } catch (validityError) {
          console.error('Error updating reseller validity:', validityError);
          // Don't fail the reseller update if validity update fails
        }
      }

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
    validity_date?: string | null;
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
    let walletId: string | null = null;
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
      } else {
        // Get wallet ID from the result
        walletId = walletResult.data?.wallet?.id || null;
      }
    }

    // Handle validity date if provided
    if (data.validity_date) {
      try {
        // Get or create wallet if it doesn't exist (needed for validity)
        if (!walletId) {
          // Get existing wallet or create one with 0 balance
          const { getMstWalletByResellerId } = await import('./wallet');
          const walletCheck = await getMstWalletByResellerId(id);
          
          if (walletCheck.success && walletCheck.data) {
            walletId = walletCheck.data.id;
          } else {
            // Create wallet with 0 balance
            const { createMstWallet } = await import('./wallet');
            const createWalletResult = await createMstWallet({
              reseller_id: id,
              balance: 0,
              credit_amount: 0,
            });
            if (createWalletResult.success && createWalletResult.data) {
              walletId = createWalletResult.data.id;
            }
          }
        }

        if (walletId) {
          // Get current validity for history
          const currentValidityResult = await getResellerValidity(id);
          const currentValidity = currentValidityResult.success ? currentValidityResult.data : null;

          // Calculate validity dates
          const now = new Date();
          const validityStartDate = now.toISOString();
          const validityEndDate = new Date(data.validity_date);
          validityEndDate.setHours(23, 59, 59, 999); // Set to end of day
          const validityDays = Math.ceil((validityEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

          if (validityDays > 0) {
            // Upsert validity
            const validityResult = await upsertResellerValidity({
              reseller_id: id,
              validity_start_date: validityStartDate,
              validity_end_date: validityEndDate.toISOString(),
              validity_days: validityDays,
              last_wallet_id: walletId,
              last_recharge_amount: data.wallet_balance || 0,
              status: 'ACTIVE',
            });

            if (!validityResult.success) {
              console.warn("Failed to update reseller validity:", validityResult.message);
            } else {
              // Create history record
              const historyResult = await createResellerValidityHistory({
                reseller_id: id,
                wallet_id: walletId,
                recharge_amount: data.wallet_balance || 0,
                previous_validity_start: currentValidity?.validity_start_date || null,
                previous_validity_end: currentValidity?.validity_end_date || null,
                new_validity_start: validityStartDate,
                new_validity_end: validityEndDate.toISOString(),
                validity_days: validityDays,
                action: 'RESELLER_APPROVAL',
              });

              if (!historyResult.success) {
                console.warn("Failed to create validity history:", historyResult.message);
              }
            }
          }
        } else {
          console.warn("Cannot set validity: Wallet could not be created or retrieved");
        }
      } catch (validityError) {
        console.error("Error setting reseller validity:", validityError);
        // Don't fail the approval if validity update fails
      }
    } else if (data.wallet_balance !== undefined && data.wallet_balance > 0) {
      // If validity_date is not set but wallet_balance is provided, 
      // creditWallet function will automatically update reseller validity
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

/**
 * Suspend reseller
 */
export const suspendMstReseller = async (
  id: string,
  suspendedBy: string,
  suspendedReason: string
) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || typeof id !== 'string' || !uuidRegex.test(id)) {
    return {
      success: false,
      message: "Invalid reseller ID format",
    };
  }
  if (!suspendedBy || typeof suspendedBy !== 'string' || !uuidRegex.test(suspendedBy)) {
    return {
      success: false,
      message: "Invalid suspended_by ID format",
    };
  }
  if (!suspendedReason || typeof suspendedReason !== 'string' || suspendedReason.trim() === '') {
    return {
      success: false,
      message: "Suspension reason is required",
    };
  }

  const MUTATION = `mutation SuspendMstReseller(
    $id: uuid!
    $suspended_reason: String!
    $suspended_at: timestamp!
    $suspended_by: uuid!
  ) {
    update_mst_reseller_by_pk(
      pk_columns: { id: $id }
      _set: {
        suspended_reason: $suspended_reason
        suspended_at: $suspended_at
        suspended_by: $suspended_by
        status: false
      }
    ) {
      id
      suspended_reason
      suspended_at
      suspended_by
      status
    }
  }`;

  try {
    const result = await graphqlRequest(MUTATION, {
      id,
      suspended_reason: suspendedReason.trim(),
      suspended_at: new Date().toISOString(),
      suspended_by: suspendedBy,
    });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to suspend reseller",
      };
    }
    if (result?.data?.update_mst_reseller_by_pk) {
      return {
        success: true,
        data: result.data.update_mst_reseller_by_pk,
        message: "Reseller suspended successfully",
      };
    }
    return {
      success: false,
      message: "Failed to suspend reseller",
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || "Failed to suspend reseller",
    };
  }
};

/**
 * Reactivate suspended reseller
 */
export const reactivateMstReseller = async (
  id: string,
  reactivatedBy: string
) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || typeof id !== 'string' || !uuidRegex.test(id)) {
    return {
      success: false,
      message: "Invalid reseller ID format",
    };
  }
  if (!reactivatedBy || typeof reactivatedBy !== 'string' || !uuidRegex.test(reactivatedBy)) {
    return {
      success: false,
      message: "Invalid reactivated_by ID format",
    };
  }

  const MUTATION = `mutation ReactivateMstReseller(
    $id: uuid!
    $status: Boolean!
  ) {
    update_mst_reseller_by_pk(
      pk_columns: { id: $id }
      _set: {
        suspended_reason: null
        suspended_at: null
        suspended_by: null
        status: $status
      }
    ) {
      id
      suspended_reason
      suspended_at
      suspended_by
      status
    }
  }`;

  try {
    const result = await graphqlRequest(MUTATION, {
      id,
      status: true,
    });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to reactivate reseller",
      };
    }
    if (result?.data?.update_mst_reseller_by_pk) {
      return {
        success: true,
        data: result.data.update_mst_reseller_by_pk,
        message: "Reseller reactivated successfully",
      };
    }
    return {
      success: false,
      message: "Failed to reactivate reseller",
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || "Failed to reactivate reseller",
    };
  }
};
