import { graphqlRequest } from "@/hasura";

/**
 * Create a new transaction
 */
export const createMstTransaction = async (data: {
  customer_id?: string;
  reseller_id: string;
  virtual_number_id?: string;
  transaction_type: string;
  payment_mode?: string;
  payment_method?: string;
  amount: number;
  status?: string;
  razorpay_payment_id?: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
  reference_number?: string;
  payment_date?: string;
  failure_reason?: string;
}) => {
  // Generate unique transaction number
  const transactionNumber = `TXN${Date.now()}${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

  const MUTATION = `mutation CreateMstTransaction(
    $transaction_number: String!
    $customer_id: uuid
    $reseller_id: uuid!
    $virtual_number_id: uuid
    $transaction_type: String!
    $payment_mode: String
    $payment_method: String
    $amount: numeric!
    $status: String
    $razorpay_payment_id: String
    $razorpay_order_id: String
    $razorpay_signature: String
    $reference_number: String
    $payment_date: date
    $failure_reason: String
  ) {
    insert_mst_transaction_one(object: {
      transaction_number: $transaction_number
      customer_id: $customer_id
      reseller_id: $reseller_id
      virtual_number_id: $virtual_number_id
      transaction_type: $transaction_type
      payment_mode: $payment_mode
      payment_method: $payment_method
      amount: $amount
      status: $status
      razorpay_payment_id: $razorpay_payment_id
      razorpay_order_id: $razorpay_order_id
      razorpay_signature: $razorpay_signature
      reference_number: $reference_number
      payment_date: $payment_date
      failure_reason: $failure_reason
    }) {
      id
      transaction_number
      customer_id
      reseller_id
      virtual_number_id
      transaction_type
      payment_mode
      payment_method
      amount
      status
      reference_number
      payment_date
      created_at
    }
  }`;

  try {
    const result = await graphqlRequest(MUTATION, {
      transaction_number: transactionNumber,
      customer_id: data.customer_id || null,
      reseller_id: data.reseller_id,
      virtual_number_id: data.virtual_number_id || null,
      transaction_type: data.transaction_type,
      payment_mode: data.payment_mode || null,
      payment_method: data.payment_method || null,
      amount: data.amount,
      status: data.status || "pending",
      razorpay_payment_id: data.razorpay_payment_id || null,
      razorpay_order_id: data.razorpay_order_id || null,
      razorpay_signature: data.razorpay_signature || null,
      reference_number: data.reference_number || null,
      payment_date: data.payment_date || null,
      failure_reason: data.failure_reason || null,
    });

    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to create transaction",
        data: null,
      };
    }

    if (result?.data?.insert_mst_transaction_one) {
      return {
        success: true,
        data: result.data.insert_mst_transaction_one,
        message: "Transaction created successfully",
      };
    }

    return {
      success: false,
      message: "Failed to create transaction",
      data: null,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to create transaction",
      data: null,
    };
  }
};

/**
 * Get all transactions for a reseller
 */
export const getMstTransactionsByReseller = async (
  resellerId: string,
  filters?: {
    status?: string;
    startDate?: string;
    endDate?: string;
    searchTerm?: string;
  }
) => {
  // Build the query - search will be filtered client-side
  let whereClause = `reseller_id: { _eq: $reseller_id }`;
  if (filters?.status && filters.status !== "all") {
    whereClause += `, status: { _eq: $status }`;
  }
  if (filters?.startDate) {
    whereClause += `, payment_date: { _gte: $start_date }`;
  }
  if (filters?.endDate) {
    whereClause += `, payment_date: { _lte: $end_date }`;
  }

  const QUERY = `query GetMstTransactionsByReseller(
    $reseller_id: uuid!
    $status: String
    $start_date: date
    $end_date: date
  ) {
    mst_transaction(
      where: { ${whereClause} }
      order_by: { created_at: desc }
    ) {
      id
      transaction_number
      customer_id
      reseller_id
      virtual_number_id
      transaction_type
      payment_mode
      payment_method
      amount
      status
      razorpay_payment_id
      razorpay_order_id
      reference_number
      payment_date
      failure_reason
      created_at
      updated_at
      mst_customer {
        id
        profile_name
        email
        phone
      }
      mst_virtual_number {
        id
        virtual_number
      }
      mst_reseller {
        id
        business_name
        first_name
        last_name
      }
    }
  }`;

  try {
    const variables: any = { reseller_id: resellerId };
    
    if (filters?.status && filters.status !== "all") {
      variables.status = filters.status;
    }
    if (filters?.startDate) {
      variables.start_date = filters.startDate;
    }
    if (filters?.endDate) {
      variables.end_date = filters.endDate;
    }

    const result = await graphqlRequest(QUERY, variables);
    
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to fetch transactions",
        data: [],
      };
    }
    
    if (result?.data?.mst_transaction) {
      return {
        success: true,
        data: result.data.mst_transaction,
      };
    }
    
    return {
      success: false,
      data: [],
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to fetch transactions",
      data: [],
    };
  }
};

/**
 * Update transaction status
 */
export const updateMstTransactionStatus = async (
  id: string,
  status: string,
  failure_reason?: string
) => {
  const MUTATION = `mutation UpdateMstTransactionStatus(
    $id: uuid!
    $status: String!
    $failure_reason: String
  ) {
    update_mst_transaction_by_pk(
      pk_columns: { id: $id }
      _set: {
        status: $status
        failure_reason: $failure_reason
      }
    ) {
      id
      status
      failure_reason
      updated_at
    }
  }`;

  try {
    const result = await graphqlRequest(MUTATION, {
      id,
      status,
      failure_reason: failure_reason || null,
    });

    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to update transaction status",
        data: null,
      };
    }

    if (result?.data?.update_mst_transaction_by_pk) {
      return {
        success: true,
        data: result.data.update_mst_transaction_by_pk,
        message: "Transaction status updated successfully",
      };
    }

    return {
      success: false,
      message: "Failed to update transaction status",
      data: null,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to update transaction status",
      data: null,
    };
  }
};

