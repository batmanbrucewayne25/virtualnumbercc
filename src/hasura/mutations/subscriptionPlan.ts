import { graphqlRequest } from "@/hasura";

/**
 * Get all subscription plans (excluding soft-deleted records if applicable)
 */
export const getMstSubscriptionPlans = async () => {
  const QUERY = `query GetMstSubscriptionPlans {
    mst_subscription_plan(
      order_by: { created_at: desc }
    ) {
      id
      reseller_id
      plan_name
      amount
      currency
      duration_days
      razorpay_plan_id
      razorpay_link_id
      is_active
      description
      created_at
      updated_at
      mst_reseller {
        id
        first_name
        last_name
        email
        business_name
      }
    }
  }`;

  try {
    const result = await graphqlRequest(QUERY);
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to fetch subscription plans",
        data: [],
      };
    }
    if (result?.data?.mst_subscription_plan) {
      return {
        success: true,
        data: result.data.mst_subscription_plan,
      };
    }
    return {
      success: false,
      data: [],
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || "Failed to fetch subscription plans",
      data: [],
    };
  }
};

/**
 * Get subscription plan by ID
 */
export const getMstSubscriptionPlanById = async (id: string) => {
  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || typeof id !== 'string' || !uuidRegex.test(id)) {
    return {
      success: false,
      message: "Invalid subscription plan ID format",
      data: null,
    };
  }

  const QUERY = `query GetMstSubscriptionPlanById($id: uuid!) {
    mst_subscription_plan_by_pk(id: $id) {
      id
      reseller_id
      plan_name
      amount
      currency
      duration_days
      razorpay_plan_id
      razorpay_link_id
      is_active
      description
      created_at
      updated_at
      mst_reseller {
        id
        first_name
        last_name
        email
        business_name
      }
    }
  }`;

  try {
    const result = await graphqlRequest(QUERY, { id });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to fetch subscription plan",
        data: null,
      };
    }
    if (result?.data?.mst_subscription_plan_by_pk) {
      return {
        success: true,
        data: result.data.mst_subscription_plan_by_pk,
      };
    }
    return {
      success: false,
      message: "Subscription plan not found",
      data: null,
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || "Failed to fetch subscription plan",
      data: null,
    };
  }
};

/**
 * Delete subscription plan by ID
 */
export const deleteMstSubscriptionPlan = async (id: string) => {
  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || typeof id !== 'string' || !uuidRegex.test(id)) {
    return {
      success: false,
      message: "Invalid subscription plan ID format",
    };
  }

  const MUTATION = `mutation DeleteMstSubscriptionPlan($id: uuid!) {
    delete_mst_subscription_plan_by_pk(id: $id) {
      id
    }
  }`;

  try {
    const result = await graphqlRequest(MUTATION, { id });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to delete subscription plan",
      };
    }
    if (result?.data?.delete_mst_subscription_plan_by_pk) {
      return {
        success: true,
        message: "Subscription plan deleted successfully",
      };
    }
    return {
      success: false,
      message: "Failed to delete subscription plan",
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || "Failed to delete subscription plan",
    };
  }
};

/**
 * Update subscription plan
 */
export const updateMstSubscriptionPlan = async (id: string, data: {
  reseller_id?: string;
  plan_name?: string;
  amount?: number;
  currency?: string;
  razorpay_plan_id?: string;
  razorpay_link_id?: string;
  duration_days?: number;
  is_active?: boolean;
  description?: string;
  [key: string]: any;
}) => {
  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || typeof id !== 'string' || !uuidRegex.test(id)) {
    return {
      success: false,
      message: "Invalid subscription plan ID format",
    };
  }

  const MUTATION = `mutation UpdateMstSubscriptionPlan(
    $id: uuid!
    $reseller_id: uuid
    $plan_name: String
    $amount: numeric
    $currency: String
    $razorpay_plan_id: String
    $razorpay_link_id: String
    $duration_days: Int
    $is_active: Boolean
    $description: String
  ) {
    update_mst_subscription_plan_by_pk(
      pk_columns: { id: $id }
      _set: {
        reseller_id: $reseller_id
        plan_name: $plan_name
        amount: $amount
        currency: $currency
        razorpay_plan_id: $razorpay_plan_id
        razorpay_link_id: $razorpay_link_id
        duration_days: $duration_days
        is_active: $is_active
        description: $description
      }
    ) {
      id
      reseller_id
      plan_name
      amount
      currency
      razorpay_plan_id
      razorpay_link_id
      duration_days
      is_active
      description
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
        message: result.errors[0]?.message || "Failed to update subscription plan",
      };
    }
    if (result?.data?.update_mst_subscription_plan_by_pk) {
      return {
        success: true,
        data: result.data.update_mst_subscription_plan_by_pk,
        message: "Subscription plan updated successfully",
      };
    }
    return {
      success: false,
      message: "Failed to update subscription plan",
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || "Failed to update subscription plan",
    };
  }
};

/**
 * Create subscription plan
 */
export const createMstSubscriptionPlan = async (data: {
  reseller_id: string;
  plan_name: string;
  amount: number;
  currency?: string;
  razorpay_plan_id?: string;
  razorpay_link_id?: string;
  duration_days?: number;
  is_active?: boolean;
  description?: string;
}) => {
  const MUTATION = `mutation CreateMstSubscriptionPlan(
    $reseller_id: uuid!
    $plan_name: String!
    $amount: numeric!
    $currency: String
    $razorpay_plan_id: String
    $razorpay_link_id: String
    $duration_days: Int
    $is_active: Boolean
    $description: String
  ) {
    insert_mst_subscription_plan_one(
      object: {
        reseller_id: $reseller_id
        plan_name: $plan_name
        amount: $amount
        currency: $currency
        razorpay_plan_id: $razorpay_plan_id
        razorpay_link_id: $razorpay_link_id
        duration_days: $duration_days
        is_active: $is_active
        description: $description
      }
    ) {
      id
      reseller_id
      plan_name
      amount
      currency
      duration_days
      razorpay_plan_id
      razorpay_link_id
      duration_days
      is_active
      description
      created_at
      updated_at
    }
  }`;

  try {
    const result = await graphqlRequest(MUTATION, {
      ...data,
      currency: data.currency || 'INR',
      is_active: data.is_active !== undefined ? data.is_active : true,
    });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to create subscription plan",
      };
    }
    if (result?.data?.insert_mst_subscription_plan_one) {
      return {
        success: true,
        data: result.data.insert_mst_subscription_plan_one,
        message: "Subscription plan created successfully",
      };
    }
    return {
      success: false,
      message: "Failed to create subscription plan",
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || "Failed to create subscription plan",
    };
  }
};
