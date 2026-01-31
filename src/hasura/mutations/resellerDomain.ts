import { graphqlRequest } from "@/hasura";

/**
 * Get reseller domain by reseller ID
 */
export const getMstResellerDomainByResellerId = async (resellerId: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!resellerId || typeof resellerId !== 'string' || !uuidRegex.test(resellerId)) {
    return {
      success: false,
      message: "Invalid reseller ID format",
      data: null,
    };
  }

  const QUERY = `query GetMstResellerDomainByResellerId($reseller_id: uuid!) {
    mst_reseller_domain(
      where: { reseller: { _eq: $reseller_id } }
      limit: 1
    ) {
      id
      domain
      reseller
      approved
      approvedBy
    }
  }`;

  try {
    const result = await graphqlRequest(QUERY, { reseller_id: resellerId });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to fetch reseller domain",
        data: null,
      };
    }
    if (result?.data?.mst_reseller_domain && result.data.mst_reseller_domain.length > 0) {
      return {
        success: true,
        data: result.data.mst_reseller_domain[0],
      };
    }
    return {
      success: true,
      data: null,
      message: "No domain configured",
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to fetch reseller domain",
      data: null,
    };
  }
};

/**
 * Get reseller by domain
 */
export const getMstResellerByDomain = async (domain: string) => {
  if (!domain || typeof domain !== 'string') {
    return {
      success: false,
      message: "Domain is required",
      data: null,
    };
  }

  const normalizedDomain = domain.toLowerCase().trim();
  const domainWithoutWww = normalizedDomain.replace(/^www\./, '');

  const QUERY = `query GetMstResellerByDomain($domain1: String!, $domain2: String!) {
    mst_reseller_domain(
      where: {
        _or: [
          { domain: { _eq: $domain1 } },
          { domain: { _eq: $domain2 } }
        ],
        approved: { _eq: true }
      }
      limit: 1
    ) {
      id
      domain
      approved
      reseller {
        id
        first_name
        last_name
        email
        business_name
        status
      }
    }
  }`;

  try {
    const result = await graphqlRequest(QUERY, {
      domain1: normalizedDomain,
      domain2: domainWithoutWww,
    });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to fetch reseller by domain",
        data: null,
      };
    }
    if (result?.data?.mst_reseller_domain && result.data.mst_reseller_domain.length > 0) {
      return {
        success: true,
        data: result.data.mst_reseller_domain[0],
      };
    }
    return {
      success: false,
      message: "Domain not found or not approved",
      data: null,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to fetch reseller by domain",
      data: null,
    };
  }
};

/**
 * Create or update reseller domain (sets approved to false if domain changes)
 */
export const upsertMstResellerDomain = async (
  resellerId: string,
  domain: string,
  adminId?: string
) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!resellerId || typeof resellerId !== 'string' || !uuidRegex.test(resellerId)) {
    return {
      success: false,
      message: "Invalid reseller ID format",
    };
  }

  if (!domain || typeof domain !== 'string' || domain.trim() === '') {
    console.warn("upsertMstResellerDomain: Domain is empty or invalid", { domain, resellerId });
    return {
      success: false,
      message: "Domain is required",
    };
  }

  // Normalize domain
  const normalizedDomain = domain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  
  console.log("upsertMstResellerDomain called:", { resellerId, domain, normalizedDomain });

  try {
    // Check if reseller already has a domain
    const existingResult = await getMstResellerDomainByResellerId(resellerId);
    console.log("Existing domain result:", existingResult);
    
    let approved = true;
    
    // Determine approval status:
    // - If no existing domain: auto-approve (first time setup)
    // - If domain exists and is different: require approval (domain change)
    // - If domain exists and is same: keep existing approval status
    if (existingResult.success && existingResult.data) {
      // Domain record exists
      if (existingResult.data.domain !== normalizedDomain) {
        // Domain is being changed - require approval
        approved = false;
        console.log("Domain change detected - requires approval");
      } else {
        // Same domain - no update needed
        console.log("Same domain - no update needed, returning existing data");
        return {
          success: true,
          data: existingResult.data,
          message: "Domain unchanged",
        };
      }
    } else {
      // No existing domain - first time setup, auto-approve
      approved = true;
      console.log("First time domain setup - auto-approving");
      console.log("Will INSERT new domain record");
    }
    
    let MUTATION: string;
    let variables: any;

    if (existingResult.success && existingResult.data) {
      // Update existing record
      // Build mutation based on whether approvedBy is provided
      if (adminId && uuidRegex.test(adminId)) {
        MUTATION = `mutation UpdateMstResellerDomain(
          $id: uuid!
          $domain: String!
          $approved: Boolean!
          $approvedBy: uuid
        ) {
          update_mst_reseller_domain_by_pk(
            pk_columns: { id: $id }
            _set: {
              domain: $domain
              approved: $approved
              approvedBy: $approvedBy
            }
          ) {
            id
            domain
            reseller
            approved
            approvedBy
          }
        }`;
        variables = {
          id: existingResult.data.id,
          domain: normalizedDomain,
          approved,
          approvedBy: adminId,
        };
      } else {
        MUTATION = `mutation UpdateMstResellerDomain(
          $id: uuid!
          $domain: String!
          $approved: Boolean!
        ) {
          update_mst_reseller_domain_by_pk(
            pk_columns: { id: $id }
            _set: {
              domain: $domain
              approved: $approved
            }
          ) {
            id
            domain
            reseller
            approved
            approvedBy
          }
        }`;
        variables = {
          id: existingResult.data.id,
          domain: normalizedDomain,
          approved,
        };
      }
    } else {
      // Insert new record
      // Build mutation based on whether approvedBy is provided
      if (adminId && uuidRegex.test(adminId)) {
        MUTATION = `mutation InsertMstResellerDomain(
          $reseller_id: uuid!
          $domain: String!
          $approved: Boolean!
          $approvedBy: uuid
        ) {
          insert_mst_reseller_domain_one(
            object: {
              reseller: $reseller_id
              domain: $domain
              approved: $approved
              approvedBy: $approvedBy
            }
          ) {
            id
            domain
            reseller
            approved
            approvedBy
          }
        }`;
        variables = {
          reseller_id: resellerId,
          domain: normalizedDomain,
          approved,
          approvedBy: adminId,
        };
      } else {
        // Insert without approvedBy (reseller updating their own domain)
        MUTATION = `mutation InsertMstResellerDomain(
          $reseller_id: uuid!
          $domain: String!
          $approved: Boolean!
        ) {
          insert_mst_reseller_domain_one(
            object: {
              reseller: $reseller_id
              domain: $domain
              approved: $approved
            }
          ) {
            id
            domain
            reseller
            approved
            approvedBy
          }
        }`;
        variables = {
          reseller_id: resellerId,
          domain: normalizedDomain,
          approved,
        };
        console.log("Inserting new domain WITHOUT approvedBy (reseller self-update)");
      }
    }

    console.log("=== DOMAIN MUTATION DEBUG ===");
    console.log("Mutation type:", existingResult.success && existingResult.data ? "UPDATE" : "INSERT");
    console.log("Variables:", JSON.stringify(variables, null, 2));
    console.log("Mutation:", MUTATION);
    console.log("Has existing domain:", existingResult.success && !!existingResult.data);
    console.log("Existing domain data:", existingResult.data);
    
    try {
      console.log("🚀 About to call graphqlRequest with:");
      console.log("  Mutation:", MUTATION.substring(0, 200) + "...");
      console.log("  Variables:", variables);
      
      const result = await graphqlRequest(MUTATION, variables);
      
      console.log("=== GRAPHQL RESPONSE ===");
      console.log("Full result:", JSON.stringify(result, null, 2));
      console.log("Response status:", result?.data ? "SUCCESS" : "NO DATA");
      console.log("Has errors:", !!result?.errors);
      console.log("Response type:", typeof result);
      console.log("Response keys:", Object.keys(result || {}));
      
      if (result?.errors) {
        console.error("=== GRAPHQL ERRORS ===");
        console.error("Error count:", result.errors.length);
        result.errors.forEach((error: any, index: number) => {
          console.error(`Error ${index + 1}:`, {
            message: error.message,
            extensions: error.extensions,
            path: error.path,
            code: error.extensions?.code,
          });
        });
        return {
          success: false,
          message: result.errors[0]?.message || "Failed to save domain",
          errors: result.errors,
          fullResult: result,
        };
      }
      
      // Check both possible response keys
      const insertResult = result?.data?.insert_mst_reseller_domain_one;
      const updateResult = result?.data?.update_mst_reseller_domain_by_pk;
      const domainRecord = insertResult || updateResult;
      
      console.log("=== MUTATION RESULT ===");
      console.log("Domain record:", domainRecord);
      console.log("Insert result:", insertResult);
      console.log("Update result:", updateResult);
      console.log("All data keys:", Object.keys(result?.data || {}));
      console.log("Data object:", result?.data);
      
      if (domainRecord) {
        console.log("✅ Domain record saved/updated successfully:", domainRecord);
        console.log("✅ Record ID:", domainRecord.id);
        console.log("✅ Record domain:", domainRecord.domain);
        console.log("✅ Record approved:", domainRecord.approved);
        return {
          success: true,
          data: domainRecord,
          message: approved 
            ? "Domain saved successfully" 
            : "Domain change submitted for approval",
        };
      }
      
      // If we get here, the mutation didn't return a record
      console.error("❌ No domain record returned from mutation");
      console.error("Result data:", result?.data);
      console.error("Result keys:", Object.keys(result?.data || {}));
      console.error("Full result object:", result);
      console.error("Insert result is:", insertResult);
      console.error("Update result is:", updateResult);
      console.error("Both are falsy:", !insertResult && !updateResult);
      
      // Check if data exists but is null
      if (result?.data) {
        console.error("Data exists but record is null/undefined");
        if (result.data.insert_mst_reseller_domain_one === null) {
          console.error("⚠️ insert_mst_reseller_domain_one returned NULL - might be a permissions issue");
        }
        if (result.data.update_mst_reseller_domain_by_pk === null) {
          console.error("⚠️ update_mst_reseller_domain_by_pk returned NULL - might be a permissions issue");
        }
      }
      
      return {
        success: false,
        message: "Failed to save domain - no record returned. Check console for details.",
        data: result?.data,
        fullResult: result,
      };
    } catch (error: any) {
      console.error("=== EXCEPTION IN MUTATION ===");
      console.error("Error type:", error?.constructor?.name);
      console.error("Error message:", error?.message);
      console.error("Error stack:", error?.stack);
      console.error("Full error:", error);
      
      return {
        success: false,
        message: error?.message || "Exception occurred while saving domain",
        error: error,
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to save domain",
    };
  }
};

/**
 * Approve reseller domain
 */
export const approveMstResellerDomain = async (
  domainId: string,
      approvedBy: string
) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!domainId || typeof domainId !== 'string' || !uuidRegex.test(domainId)) {
    return {
      success: false,
      message: "Invalid domain ID format",
    };
  }
  if (!approvedBy || typeof approvedBy !== 'string' || !uuidRegex.test(approvedBy)) {
    return {
      success: false,
      message: "Invalid admin ID format",
    };
  }

  const MUTATION = `mutation ApproveMstResellerDomain(
    $id: uuid!
    $approvedBy: uuid!
  ) {
    update_mst_reseller_domain_by_pk(
      pk_columns: { id: $id }
      _set: {
        approved: true
        approvedBy: $approvedBy
      }
    ) {
      id
      domain
      approved
      approvedBy
    }
  }`;

  try {
    const result = await graphqlRequest(MUTATION, {
      id: domainId,
      approvedBy: approvedBy,
    });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to approve domain",
      };
    }
    if (result?.data?.update_mst_reseller_domain_by_pk) {
      return {
        success: true,
        data: result.data.update_mst_reseller_domain_by_pk,
        message: "Domain approved successfully",
      };
    }
    return {
      success: false,
      message: "Failed to approve domain",
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to approve domain",
    };
  }
};

/**
 * Get all pending domain approvals
 */
export const getPendingDomainApprovals = async () => {
  // First, get all pending domains
  const DOMAIN_QUERY = `query GetPendingDomainApprovals {
    mst_reseller_domain(
      where: { approved: { _eq: false } }
    ) {
      id
      domain
      reseller
      approved
      approvedBy
    }
  }`;

  try {
    const domainResult = await graphqlRequest(DOMAIN_QUERY);
    if (domainResult?.errors) {
      return {
        success: false,
        message: domainResult.errors[0]?.message || "Failed to fetch pending approvals",
        data: [],
      };
    }

    const domains = domainResult?.data?.mst_reseller_domain || [];
    
    // Fetch reseller data for each domain
    const domainsWithResellerData = await Promise.all(
      domains.map(async (domainRecord) => {
        if (!domainRecord.reseller) {
          return { ...domainRecord, reseller_data: null };
        }

        // Fetch reseller details
        const RESELLER_QUERY = `query GetResellerById($id: uuid!) {
          mst_reseller_by_pk(id: $id) {
            id
            first_name
            last_name
            email
            business_name
          }
        }`;

        try {
          const resellerResult = await graphqlRequest(RESELLER_QUERY, { id: domainRecord.reseller });
          return {
            ...domainRecord,
            reseller_data: resellerResult?.data?.mst_reseller_by_pk || null,
          };
        } catch (err) {
          console.warn(`Failed to fetch reseller ${domainRecord.reseller}:`, err);
          return { ...domainRecord, reseller_data: null };
        }
      })
    );

    return {
      success: true,
      data: domainsWithResellerData,
    };
  } catch (error) {
    return {
      success: false,
      message: error?.message || "Failed to fetch pending approvals",
      data: [],
    };
  }
};

/**
 * TEST FUNCTION - Can be called from browser console
 * Usage: window.testDomainInsert('reseller-uuid-here', 'example.com')
 */
export const testDomainInsert = async (resellerId: string, domain: string) => {
  console.log("🧪 TEST: Starting domain insert test");
  console.log("Reseller ID:", resellerId);
  console.log("Domain:", domain);
  
  const result = await upsertMstResellerDomain(resellerId, domain);
  
  console.log("🧪 TEST RESULT:", result);
  return result;
};

// Make it available globally for testing
if (typeof window !== 'undefined') {
  (window as any).testDomainInsert = testDomainInsert;
}

