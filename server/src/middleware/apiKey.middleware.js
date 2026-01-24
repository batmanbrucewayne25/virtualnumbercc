/**
 * API Key Authentication Middleware
 * Validates API key from Authorization header for external API access
 */

import { getHasuraClient } from '../config/hasura.client.js';

/**
 * Validate API key from request
 * @param {string} apiKey - API key from Authorization header
 * @returns {Promise<{valid: boolean, resellerId?: string}>}
 */
const validateApiKey = async (apiKey) => {
  if (!apiKey) {
    return { valid: false };
  }

  try {
    const client = getHasuraClient();
    
    // Try to find API key in database
    // Option 1: Check if there's an mst_api_key table
    // Option 2: Check reseller table for api_key field
    // For now, checking reseller table assuming api_key field exists
    
    const query = `
      query GetResellerByApiKey($api_key: String!) {
        mst_reseller(
          where: { 
            api_key: { _eq: $api_key },
            status: { _eq: true }
          }
          limit: 1
        ) {
          id
          api_key
          status
        }
      }
    `;

    try {
      const result = await client.client.request(query, { api_key: apiKey });
      
      if (result.mst_reseller && result.mst_reseller.length > 0) {
        const reseller = result.mst_reseller[0];
        return { 
          valid: true, 
          resellerId: reseller.id 
        };
      }
    } catch (queryError) {
      // If query fails (field doesn't exist), fall back to environment variable
      console.warn('API key database query failed, using env variable fallback:', queryError.message);
      
      // Fallback to environment variable validation
      const VALID_API_KEYS = process.env.API_KEYS ? process.env.API_KEYS.split(',') : [];
      if (VALID_API_KEYS.includes(apiKey)) {
        return { valid: true };
      }
    }

    return { valid: false };
  } catch (error) {
    console.error('Error validating API key:', error);
    return { valid: false };
  }
};

/**
 * API Key Authentication Middleware
 */
export const apiKeyMiddleware = async (req, res, next) => {
  try {
    // Get API key from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 401,
        message: 'API key required. Please provide Authorization: Bearer YOUR_API_KEY'
      });
    }

    const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Validate API key
    const validation = await validateApiKey(apiKey);

    if (!validation.valid) {
      return res.status(401).json({
        status: 401,
        message: 'Invalid API key'
      });
    }

    // Attach API key info to request
    req.apiKey = apiKey;
    req.resellerId = validation.resellerId || null; // Will be set when database validation is implemented

    next();
  } catch (error) {
    console.error('API Key Middleware Error:', error);
    return res.status(500).json({
      status: 500,
      message: 'Authentication error'
    });
  }
};

