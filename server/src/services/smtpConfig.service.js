import { getHasuraClient } from '../config/hasura.client.js';

/**
 * Get SMTP config by admin ID
 * @param {string} adminId - Admin ID
 * @returns {Promise<object|null>} SMTP config object or null if not found
 */
export const getAdminSmtpConfig = async (adminId) => {
  try {
    const client = getHasuraClient();
    
    const query = `
      query GetAdminSmtpConfig($admin_id: uuid!) {
        mst_smtp_config(
          where: { 
            admin_id: { _eq: $admin_id },
            is_active: { _eq: true }
          }
          limit: 1
          order_by: { created_at: desc }
        ) {
          id
          admin_id
          host
          port
          username
          password
          from_email
          from_name
          is_active
        }
      }
    `;
    
    const data = await client.client.request(query, { admin_id: adminId });
    
    console.log('[SMTP Config Service] Query result:', {
      admin_id: adminId,
      found_count: data.mst_smtp_config?.length || 0,
      has_password_field: data.mst_smtp_config?.[0]?.password !== undefined
    });
    
    if (data.mst_smtp_config && data.mst_smtp_config.length > 0) {
      const config = data.mst_smtp_config[0];
      // Check if password is missing (might be due to Hasura permissions)
      if (!config.password) {
        console.warn('[SMTP Config Service] Password field is missing or null in database response. This might be a Hasura permissions issue.');
      }
      return config;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching admin SMTP config from database:', error);
    return null;
  }
};

