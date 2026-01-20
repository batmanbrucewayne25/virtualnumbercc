import { graphqlRequest } from "@/hasura";

/**
 * Get approved customers with virtual numbers for a reseller
 */
export const getApprovedCustomersByReseller = async (
  resellerId: string,
  filters?: {
    startDate?: string;
    endDate?: string;
    searchTerm?: string;
    expiringSoon?: boolean;
  }
) => {
  // Build where clause - simplified for now, filtering will be done client-side
  let whereClause = `reseller_id: { _eq: $reseller_id }, status: { _eq: "approved" }`;

  const QUERY = `query GetApprovedCustomersByReseller(
    $reseller_id: uuid!
  ) {
    mst_customer(
      where: { ${whereClause} }
      order_by: { created_at: desc }
    ) {
      id
      profile_name
      email
      phone
      business_email
      pan_full_name
      aadhaar_number
      business_name
      status
      kyc_status
      created_at
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
      }
      mst_transactions(
        where: { status: { _eq: "success" } }
        order_by: { created_at: desc }
        limit: 1
      ) {
        id
        payment_mode
        payment_method
        amount
        payment_date
      }
    }
  }`;

  try {
    const variables: any = { 
      reseller_id: resellerId,
    };

    const result = await graphqlRequest(QUERY, variables);
    
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to fetch customers",
        data: [],
      };
    }
    
    let customers = result?.data?.mst_customer || [];

    // Client-side filtering
    if (filters?.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      customers = customers.filter((customer: any) => {
        const name = (customer.profile_name || customer.business_name || customer.pan_full_name || "").toLowerCase();
        const virtualNumber = customer.mst_virtual_number?.[0]?.virtual_number?.toLowerCase() || "";
        const callForward = customer.mst_virtual_number?.[0]?.call_forwarding_number?.toLowerCase() || "";
        return name.includes(searchLower) || virtualNumber.includes(searchLower) || callForward.includes(searchLower);
      });
    }

    // Filter by date range (purchase date)
    if (filters?.startDate || filters?.endDate) {
      customers = customers.filter((customer: any) => {
        const purchaseDate = customer.mst_virtual_number?.[0]?.purchase_date;
        if (!purchaseDate) return false;
        const purchase = new Date(purchaseDate);
        if (filters?.startDate && purchase < new Date(filters.startDate)) return false;
        if (filters?.endDate && purchase > new Date(filters.endDate)) return false;
        return true;
      });
    }

    // Filter expiring soon (within 30 days)
    if (filters?.expiringSoon) {
      const today = new Date();
      const thirtyDaysLater = new Date(today);
      thirtyDaysLater.setDate(today.getDate() + 30);
      customers = customers.filter((customer: any) => {
        const expiryDate = customer.mst_virtual_number?.[0]?.expiry_date;
        if (!expiryDate) return false;
        const expiry = new Date(expiryDate);
        return expiry >= today && expiry <= thirtyDaysLater;
      });
    }
    
    return {
      success: true,
      data: customers,
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
 * Get customer by ID with all details and transactions
 */
export const getCustomerWithTransactions = async (customerId: string) => {
  const QUERY = `query GetCustomerWithTransactions($id: uuid!) {
    mst_customer_by_pk(id: $id) {
      id
      reseller_id
      email
      phone
      business_email
      profile_name
      profile_image
      pan_number
      pan_full_name
      pan_dob
      aadhaar_number
      aadhaar_dob
      dob_match_verified
      gender
      gstin
      business_name
      address
      status
      kyc_status
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
      mst_transactions(
        order_by: { created_at: desc }
      ) {
        id
        transaction_number
        transaction_type
        payment_mode
        payment_method
        amount
        status
        reference_number
        payment_date
        failure_reason
        created_at
      }
    }
  }`;

  try {
    const result = await graphqlRequest(QUERY, { id: customerId });
    
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
 * Suspend customer account
 */
export const suspendCustomer = async (customerId: string) => {
  const MUTATION = `mutation SuspendCustomer($id: uuid!) {
    update_mst_customer_by_pk(
      pk_columns: { id: $id }
      _set: {
        status: "suspended"
      }
    ) {
      id
      status
      updated_at
    }
  }`;

  try {
    const result = await graphqlRequest(MUTATION, { id: customerId });
    
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to suspend customer",
        data: null,
      };
    }
    
    if (result?.data?.update_mst_customer_by_pk) {
      return {
        success: true,
        data: result.data.update_mst_customer_by_pk,
        message: "Customer account suspended successfully",
      };
    }
    
    return {
      success: false,
      message: "Failed to suspend customer",
      data: null,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to suspend customer",
      data: null,
    };
  }
};

