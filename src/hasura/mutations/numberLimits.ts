import { graphqlRequest } from "@/hasura";

/**
 * Create or update number limits for a reseller
 */
export const upsertNumberLimits = async (
  resellerId: string,
  maxVirtualNumbers: number
) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!resellerId || typeof resellerId !== 'string' || !uuidRegex.test(resellerId)) {
    return {
      success: false,
      message: "Invalid reseller ID format",
    };
  }

  if (maxVirtualNumbers === null || maxVirtualNumbers === undefined || isNaN(maxVirtualNumbers) || maxVirtualNumbers < 0) {
    return {
      success: false,
      message: "Invalid max virtual numbers value",
    };
  }

  // First, check if a record exists for this reseller
  const CHECK_QUERY = `query CheckNumberLimits($reseller_id: uuid!) {
    number_limits(where: { reseller_id: { _eq: $reseller_id } }) {
      id
      reseller_id
      max_virtual_numbers
    }
  }`;

  try {
    const checkResult = await graphqlRequest(CHECK_QUERY, { reseller_id: resellerId });
    
    if (checkResult?.errors) {
      return {
        success: false,
        message: checkResult.errors[0]?.message || "Failed to check number limits",
      };
    }

    const existingRecord = checkResult?.data?.number_limits?.[0];

    if (existingRecord) {
      // Update existing record
      const UPDATE_MUTATION = `mutation UpdateNumberLimits(
        $reseller_id: uuid!
        $max_virtual_numbers: Int!
      ) {
        update_number_limits(
          where: { reseller_id: { _eq: $reseller_id } }
          _set: { max_virtual_numbers: $max_virtual_numbers }
        ) {
          affected_rows
          returning {
            id
            reseller_id
            max_virtual_numbers
          }
        }
      }`;

      const updateResult = await graphqlRequest(UPDATE_MUTATION, {
        reseller_id: resellerId,
        max_virtual_numbers: maxVirtualNumbers,
      });

      if (updateResult?.errors) {
        return {
          success: false,
          message: updateResult.errors[0]?.message || "Failed to update number limits",
        };
      }

      if (updateResult?.data?.update_number_limits?.affected_rows > 0) {
        return {
          success: true,
          data: updateResult.data.update_number_limits.returning[0],
          message: "Number limits updated successfully",
        };
      }

      return {
        success: false,
        message: "Failed to update number limits",
      };
    } else {
      // Insert new record
      const INSERT_MUTATION = `mutation InsertNumberLimits(
        $reseller_id: uuid!
        $max_virtual_numbers: Int!
      ) {
        insert_number_limits_one(object: {
          reseller_id: $reseller_id
          max_virtual_numbers: $max_virtual_numbers
        }) {
          id
          reseller_id
          max_virtual_numbers
        }
      }`;

      const insertResult = await graphqlRequest(INSERT_MUTATION, {
        reseller_id: resellerId,
        max_virtual_numbers: maxVirtualNumbers,
      });

      if (insertResult?.errors) {
        return {
          success: false,
          message: insertResult.errors[0]?.message || "Failed to create number limits",
        };
      }

      if (insertResult?.data?.insert_number_limits_one) {
        return {
          success: true,
          data: insertResult.data.insert_number_limits_one,
          message: "Number limits created successfully",
        };
      }

      return {
        success: false,
        message: "Failed to create number limits",
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to upsert number limits",
    };
  }
};

/**
 * Get number limits by reseller ID
 */
export const getNumberLimitsByResellerId = async (resellerId: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!resellerId || typeof resellerId !== 'string' || !uuidRegex.test(resellerId)) {
    return {
      success: false,
      message: "Invalid reseller ID format",
      data: null,
    };
  }

  const QUERY = `query GetNumberLimitsByResellerId($reseller_id: uuid!) {
    number_limits(where: { reseller_id: { _eq: $reseller_id } }) {
      id
      reseller_id
      max_virtual_numbers
    }
  }`;

  try {
    const result = await graphqlRequest(QUERY, { reseller_id: resellerId });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to fetch number limits",
        data: null,
      };
    }
    if (result?.data?.number_limits && result.data.number_limits.length > 0) {
      return {
        success: true,
        data: result.data.number_limits[0],
      };
    }
    return {
      success: true,
      data: null,
      message: "Number limits not found",
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to fetch number limits",
      data: null,
    };
  }
};
