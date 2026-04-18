import { asyncHandler } from '../utils/asyncHandler.js';
import { getHasuraClient } from '../config/hasura.client.js';
import { formatCustomerDisplayName } from '../utils/emailBranding.js';
import { sendCustomerKycSubmittedAdminEmail } from '../services/transactionalEmail.service.js';

/**
 * @desc    Get reseller by custom domain (only approved domains)
 * @route   GET /api/reseller/by-domain
 * @access  Public
 */
function isLocalhost(hostOrDomain) {
  if (!hostOrDomain || typeof hostOrDomain !== 'string') return false;
  const h = hostOrDomain.toLowerCase().trim();
  return h === 'localhost' || h === '127.0.0.1' || h.includes('localhost');
}

/**
 * Fetch maintenance_mode from mst_admin_setting (first row)
 * @param {object} client - Hasura client
 * @returns {Promise<boolean>}
 */
async function getMaintenanceMode(client) {
  try {
    const result = await client.client.request(`
      query GetMaintenanceMode {
        mst_admin_setting(limit: 1, order_by: { created_at: desc }) {
          maintenance_mode
        }
      }
    `);
    const row = result?.mst_admin_setting?.[0];
    return row?.maintenance_mode ?? false;
  } catch (err) {
    console.error('Error fetching maintenance mode:', err);
    return false;
  }
}

/**
 * @desc    Global maintenance flag from mst_admin_setting (no auth)
 * @route   GET /api/reseller/maintenance-mode
 * @access  Public
 */
export const getMaintenanceModeStatus = asyncHandler(async (req, res) => {
  try {
    const client = getHasuraClient();
    const maintenanceMode = await getMaintenanceMode(client);
    return res.json({
      success: true,
      data: { maintenanceMode },
    });
  } catch (error) {
    console.error('Error in getMaintenanceModeStatus:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch maintenance mode',
    });
  }
});

export const getResellerByDomain = asyncHandler(async (req, res) => {
  const { domain } = req.query;
  const requestHost = req.get('host') || '';

  // Allow localhost alone: when request is from localhost and default reseller is configured
  const isRequestFromLocalhost = isLocalhost(requestHost);
  const defaultResellerId = process.env.DEFAULT_RESELLER_ID_FOR_LOCALHOST;
  const domainIsLocalhost = domain && isLocalhost(domain.trim());

  if (isRequestFromLocalhost && defaultResellerId && (!domain || domainIsLocalhost)) {
    try {
      const client = getHasuraClient();
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
        id: defaultResellerId.trim(),
      });
      const reseller = resellerResult.mst_reseller_by_pk;
      if (reseller && reseller.status === true) {
        const maintenanceMode = await getMaintenanceMode(client);
        return res.json({
          success: true,
          data: {
            resellerId: reseller.id,
            resellerName: reseller.brand_name || reseller.business_name || `${reseller.first_name} ${reseller.last_name}`.trim(),
            brandName: reseller.brand_name || null,
            businessName: reseller.business_name || null,
            logo: reseller.logo || null,
            domain: 'localhost',
            maintenanceMode,
          },
        });
      }
    } catch (err) {
      console.error('Error fetching default reseller for localhost:', err);
    }
  }

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

      const maintenanceMode = await getMaintenanceMode(client);
      return res.json({
        success: true,
        data: {
          resellerId: reseller.id,
          resellerName: reseller.brand_name || reseller.business_name || `${reseller.first_name} ${reseller.last_name}`.trim(),
          brandName: reseller.brand_name || null,
          businessName: reseller.business_name || null,
          logo: reseller.logo || null,
          domain: domainRecord.domain,
          maintenanceMode,
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

const uuidRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * @desc    Email reseller when a customer completes ClientHub KYC (final review step)
 * @route   POST /api/reseller/notify-customer-kyc-submitted
 * @access  Public (resellerId + customerId; server verifies customer belongs to reseller)
 */
export const notifyCustomerKycSubmitted = asyncHandler(async (req, res) => {
  const { resellerId, customerId } = req.body || {};

  if (!resellerId || !customerId) {
    return res.status(400).json({
      success: false,
      message: 'resellerId and customerId are required',
    });
  }
  if (!uuidRe.test(String(resellerId)) || !uuidRe.test(String(customerId))) {
    return res.status(400).json({
      success: false,
      message: 'Invalid resellerId or customerId',
    });
  }

  try {
    const client = getHasuraClient();
    const data = await client.client.request(
      `query KycSubmittedNotify($cid: uuid!) {
        mst_customer_by_pk(id: $cid) {
          id
          email
          firstName
          lastName
          profile_name
          reseller_id
          mst_reseller {
            id
            email
            brand_name
            business_name
            first_name
            last_name
          }
        }
      }`,
      { cid: customerId },
    );
    const cust = data?.mst_customer_by_pk;
    if (!cust || String(cust.reseller_id) !== String(resellerId)) {
      return res.status(403).json({
        success: false,
        message: 'Customer not found for this reseller',
      });
    }

    const r = cust.mst_reseller;
    if (!r?.email) {
      return res.status(422).json({
        success: false,
        message: 'Reseller has no email configured; cannot send notification',
      });
    }

    const resellerGreetingName =
      `${r.first_name || ""} ${r.last_name || ""}`.trim() ||
      r.brand_name ||
      r.business_name ||
      r.email;
    const brandName =
      r.brand_name ||
      r.business_name ||
      `${r.first_name || ""} ${r.last_name || ""}`.trim() ||
      r.email;
    const customerName = formatCustomerDisplayName(cust) || cust.email;

    const emailResult = await sendCustomerKycSubmittedAdminEmail({
      resellerEmail: r.email,
      resellerGreetingName,
      brandName,
      customerName,
      customerEmail: cust.email,
      resellerId: String(resellerId),
      customerId: String(customerId),
    });

    const ok = emailResult?.success === true;
    return res.status(ok ? 200 : 502).json({
      success: ok,
      message: ok
        ? 'Reseller notified of new customer KYC submission'
        : emailResult?.message || 'Failed to send email',
    });
  } catch (err) {
    console.error('[notifyCustomerKycSubmitted]', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to process notification',
    });
  }
});

