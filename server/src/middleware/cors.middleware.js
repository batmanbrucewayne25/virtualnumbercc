import { getHasuraClient } from '../config/hasura.client.js';

/**
 * Check if domain is approved in mst_reseller_domain table
 * @param {string} hostname - Domain hostname (e.g., "aaracollections.in")
 * @returns {Promise<boolean>}
 */
const isDomainApproved = async (hostname) => {
  if (!hostname) return false;

  // Normalize domain: lowercase, remove www prefix
  const normalizedDomain = hostname.toLowerCase().trim();
  const domainWithoutWww = normalizedDomain.replace(/^www\./, '');

  try {
    const client = getHasuraClient();
    
    const query = `
      query CheckDomainApproved($domain1: String!, $domain2: String!) {
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
            status
          }
        }
      }
    `;

    const result = await client.client.request(query, {
      domain1: normalizedDomain,
      domain2: domainWithoutWww,
    });

    if (result.mst_reseller_domain && result.mst_reseller_domain.length > 0) {
      const domainRecord = result.mst_reseller_domain[0];
      // Check if reseller is active
      return domainRecord.reseller && domainRecord.reseller.status === true;
    }

    return false;
  } catch (error) {
    console.error('Error checking domain approval:', error);
    // On error, deny access for security
    return false;
  }
};

/**
 * CORS origin validation function
 * Allows:
 * - Development origins (localhost)
 * - Approved domains from mst_reseller_domain table
 * - Origins from CORS_ORIGIN env variable
 */
export const corsOriginHandler = async (origin, callback) => {
  // Allow requests with no origin (mobile apps, Postman, etc.)
  if (!origin) {
    return callback(null, true);
  }

  // Parse origin to get hostname
  let hostname;
  try {
    const url = new URL(origin);
    hostname = url.hostname;
  } catch (e) {
    // Invalid URL, deny
    return callback(new Error('Invalid origin'));
  }

  // 1. Check hardcoded allowed origins from env
  const allowedOrigins = process.env.CORS_ORIGIN 
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
    : ['http://localhost:5173', 'http://localhost:5174'];

  if (allowedOrigins.includes(origin)) {
    return callback(null, true);
  }

  // 2. Allow localhost for development
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return callback(null, true);
  }

  // 3. Check database for approved domains
  const isApproved = await isDomainApproved(hostname);
  if (isApproved) {
    return callback(null, true);
  }

  // 4. Deny if not in any allowed list
  console.warn(`CORS blocked origin: ${origin} (hostname: ${hostname})`);
  return callback(new Error('Not allowed by CORS'));
};

