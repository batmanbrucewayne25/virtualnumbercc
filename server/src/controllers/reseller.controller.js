import { asyncHandler } from '../utils/asyncHandler.js';
import { getHasuraClient } from '../config/hasura.client.js';

/**
 * @desc    Get reseller by custom domain (only approved domains)
 * @route   GET /api/reseller/by-domain
 * @access  Public
 */
export const getResellerByDomain = asyncHandler(async (req, res) => {
  const { domain } = req.query;

  if (!domain) {
    return res.status(400).json({
      success: false,
      message: 'Domain parameter is required',
    });
  }

  try {
    const client = getHasuraClient();
    
    // Normalize domain: lowercase, remove protocol, remove www prefix for matching
    const normalizedDomain = domain.toLowerCase().trim();
    const domainWithoutWww = normalizedDomain.replace(/^www\./, '');
    
    // Query reseller_domain table (only approved domains)
    // First, get the domain record with reseller UUID
    const domainQuery = `
      query GetResellerByDomain($domain1: String!, $domain2: String!) {
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
          reseller
        }
      }
    `;

    const domainResult = await client.client.request(domainQuery, {
      domain1: normalizedDomain,
      domain2: domainWithoutWww,
    });

    if (domainResult.mst_reseller_domain && domainResult.mst_reseller_domain.length > 0) {
      const domainRecord = domainResult.mst_reseller_domain[0];
      
      // Fetch reseller separately since reseller is a UUID, not a relationship
      if (!domainRecord.reseller) {
        return res.status(404).json({
          success: false,
          message: 'Reseller not found for this domain',
        });
      }

      const resellerQuery = `
        query GetResellerById($id: uuid!) {
          mst_reseller_by_pk(id: $id) {
            id
            first_name
            last_name
            email
            business_name
            brand_name
            logo
            status
          }
        }
      `;

      const resellerResult = await client.client.request(resellerQuery, {
        id: domainRecord.reseller
      });

      const reseller = resellerResult.mst_reseller_by_pk;
      
      // Check if reseller exists and is active
      if (!reseller) {
        return res.status(404).json({
          success: false,
          message: 'Reseller not found',
        });
      }

      if (reseller.status !== true) {
        return res.status(404).json({
          success: false,
          message: 'Reseller account is not active',
        });
      }

      return res.json({
        success: true,
        data: {
          resellerId: reseller.id,
          resellerName: reseller.brand_name || reseller.business_name || `${reseller.first_name} ${reseller.last_name}`.trim(),
          brandName: reseller.brand_name || null,
          businessName: reseller.business_name || null,
          logo: reseller.logo || null,
          domain: domainRecord.domain,
        },
      });
    }

    return res.status(404).json({
      success: false,
      message: 'Domain not found or not approved',
    });
  } catch (error) {
    console.error('Error fetching reseller by domain:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch reseller by domain',
    });
  }
});

