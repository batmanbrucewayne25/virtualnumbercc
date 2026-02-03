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
          reseller
        }
      }
    `;

    const result = await client.client.request(query, {
      domain1: normalizedDomain,
      domain2: domainWithoutWww,
    });

    if (result.mst_reseller_domain && result.mst_reseller_domain.length > 0) {
      const domainRecord = result.mst_reseller_domain[0];
      
      // Fetch reseller separately since reseller is a UUID, not a relationship
      if (domainRecord.reseller) {
        const resellerQuery = `
          query GetResellerStatus($id: uuid!) {
            mst_reseller_by_pk(id: $id) {
              id
              status
            }
          }
        `;
        
        const resellerResult = await client.client.request(resellerQuery, {
          id: domainRecord.reseller
        });
        
        // Check if reseller is active
        return resellerResult.mst_reseller_by_pk && resellerResult.mst_reseller_by_pk.status === true;
      }
      
      return false;
    }

    return false;
  } catch (error) {
    console.error('Error checking domain approval:', error);
    console.error('Error details:', error.message, error.stack);
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
    console.error('Invalid origin URL:', origin, e.message);
    return callback(new Error('Invalid origin'));
  }

  console.log(`[CORS] Checking origin: ${origin} (hostname: ${hostname})`);

  // 1. Check hardcoded allowed origins from env
  const allowedOrigins = process.env.CORS_ORIGIN 
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
    : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3001', 'https://app.virtualnumberindia.in'];

  if (allowedOrigins.includes(origin)) {
    console.log(`[CORS] Origin allowed via CORS_ORIGIN env: ${origin}`);
    return callback(null, true);
  }

  // 2. Allow localhost for development (any port)
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    console.log(`[CORS] Origin allowed (localhost): ${origin}`);
    return callback(null, true);
  }

  // 3. Check database for approved domains
  try {
    const isApproved = await isDomainApproved(hostname);
    if (isApproved) {
      console.log(`[CORS] Origin allowed (approved domain): ${origin}`);
      return callback(null, true);
    } else {
      console.log(`[CORS] Domain not approved in database: ${hostname}`);
    }
  } catch (error) {
    console.error(`[CORS] Error checking domain approval for ${hostname}:`, error);
    // Continue to deny if there's an error
  }

  // 4. Deny if not in any allowed list
  console.warn(`[CORS] Blocked origin: ${origin} (hostname: ${hostname})`);
  return callback(new Error('Not allowed by CORS'));
};

