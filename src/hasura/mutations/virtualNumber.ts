import { graphqlRequest } from "@/hasura";

/**
 * Create a virtual number for a customer
 */
export const createMstVirtualNumber = async (data: {
  customer_id: string;
  reseller_id: string;
  virtual_number: string;
  call_forwarding_number?: string;
  purchase_date?: string;
  expiry_date?: string;
  status?: string;
  subscription_plan_id?: string;
  is_auto_renew?: boolean;
}) => {
  const MUTATION = `mutation CreateMstVirtualNumber(
    $customer_id: uuid!
    $reseller_id: uuid!
    $virtual_number: String!
    $call_forwarding_number: String
    $purchase_date: date
    $expiry_date: date
    $status: String
    $subscription_plan_id: uuid
    $is_auto_renew: Boolean
  ) {
    insert_mst_virtual_number_one(object: {
      customer_id: $customer_id
      reseller_id: $reseller_id
      virtual_number: $virtual_number
      call_forwarding_number: $call_forwarding_number
      purchase_date: $purchase_date
      expiry_date: $expiry_date
      status: $status
      subscription_plan_id: $subscription_plan_id
      is_auto_renew: $is_auto_renew
    }) {
      id
      customer_id
      reseller_id
      virtual_number
      call_forwarding_number
      purchase_date
      expiry_date
      status
      subscription_plan_id
      is_auto_renew
      created_at
    }
  }`;

  try {
    // Set defaults
    const purchaseDate = data.purchase_date || new Date().toISOString().split("T")[0];
    const expiryDate = data.expiry_date || (() => {
      const date = new Date(purchaseDate);
      date.setDate(date.getDate() + 360);
      return date.toISOString().split("T")[0];
    })();
    const status = data.status || "active";

    const result = await graphqlRequest(MUTATION, {
      customer_id: data.customer_id,
      reseller_id: data.reseller_id,
      virtual_number: data.virtual_number,
      call_forwarding_number: data.call_forwarding_number || null,
      purchase_date: purchaseDate,
      expiry_date: expiryDate,
      status: status,
      subscription_plan_id: data.subscription_plan_id || null,
      is_auto_renew: data.is_auto_renew !== undefined ? data.is_auto_renew : false,
    });

    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to create virtual number",
        data: null,
      };
    }

    if (result?.data?.insert_mst_virtual_number_one) {
      return {
        success: true,
        data: result.data.insert_mst_virtual_number_one,
        message: "Virtual number created successfully",
      };
    }

    return {
      success: false,
      message: "Failed to create virtual number",
      data: null,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to create virtual number",
      data: null,
    };
  }
};

