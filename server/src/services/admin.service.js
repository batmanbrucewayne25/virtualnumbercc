import { hasuraClient, getHasuraClient } from '../config/hasura.client.js';
import bcrypt from 'bcryptjs';

export class AdminService {
  /**
   * Hash password using bcrypt
   */
  static async hashPassword(password) {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
  }

  /**
   * Get all admins
   * @returns {Promise<Array>}
   */
  static async getAllAdmins() {
    try {
      const query = `
        query GetAllAdmins {
          mst_super_admin(order_by: { created_at: desc }) {
            id
            first_name
            last_name
            email
            phone
            status
            created_at
            updated_at
          }
        }
      `;

      const client = getHasuraClient();
      const data = await client.client.request(query);
      return data.mst_super_admin || [];
    } catch (error) {
      console.error('Error fetching admins:', error);
      throw new Error('Failed to fetch admins from database');
    }
  }

  /**
   * Get admin by ID
   * @param {number} id 
   * @returns {Promise<object|null>}
   */
  static async getAdminById(id) {
    try {
      const query = `
        query GetAdminById($id: Int!) {
          mst_super_admin_by_pk(id: $id) {
            id
            first_name
            last_name
            email
            phone
            status
            created_at
            updated_at
          }
        }
      `;

      const client = getHasuraClient();
      const data = await client.client.request(query, { id });
      return data.mst_super_admin_by_pk;
    } catch (error) {
      console.error('Error fetching admin:', error);
      throw new Error('Failed to fetch admin from database');
    }
  }

  /**
   * Create new admin
   * @param {object} adminData 
   * @returns {Promise<object>}
   */
  static async createAdmin(adminData) {
    try {
      const { password, ...otherData } = adminData;

      // Check if admin already exists
      const existingAdmin = await this.getAdminByEmail(adminData.email);
      if (existingAdmin) {
        throw new Error('Admin with this email already exists');
      }

      // Hash password
      const password_hash = await this.hashPassword(password);

      // Get role name if role_id is provided
      let roleName = null;
      if (otherData.role_id) {
        try {
          const roleQuery = `
            query GetRoleById($id: uuid!) {
              mst_role_by_pk(id: $id) {
                id
                role_name
              }
            }
          `;
          const client = getHasuraClient();
          const roleResult = await client.client.request(roleQuery, { id: otherData.role_id });
          if (roleResult.mst_role_by_pk) {
            roleName = roleResult.mst_role_by_pk.role_name;
          }
        } catch (roleError) {
          console.warn('Could not fetch role name:', roleError);
          // Continue without role name
        }
      }

      // Create admin in Hasura
      const mutation = `
        mutation InsertAdmin(
          $first_name: String!
          $last_name: String!
          $email: String!
          $phone: String
          $password_hash: String!
          $status: Boolean!
          $role_id: uuid
        ) {
          insert_mst_super_admin_one(object: {
            first_name: $first_name
            last_name: $last_name
            email: $email
            phone: $phone
            password_hash: $password_hash
            status: $status
            role_id: $role_id
          }) {
            id
            first_name
            last_name
            email
            phone
            status
            role_id
            created_at
          }
        }
      `;

      const variables = {
        ...otherData,
        password_hash,
        phone: otherData.phone || null,
        role_id: otherData.role_id || null
      };

      const client = getHasuraClient();
      const data = await client.client.request(mutation, variables);
      const createdAdmin = data.insert_mst_super_admin_one;

      // Send welcome email with credentials
      try {
        console.log('[Admin Creation] 📧 Attempting to send welcome email to:', createdAdmin.email);
        console.log('[Admin Creation] Role name:', roleName || 'No role assigned');
        console.log('[Admin Creation] Password available:', password ? 'Yes' : 'No');
        
        // Import email service - use relative path from server/src/services to server/services
        // Path: ../../services/emailService.js (up two levels from src/services to server, then into services)
        const emailModule = await import('../../services/emailService.js');
        console.log('[Admin Creation] Email module imported. Available exports:', Object.keys(emailModule));
        
        if (!emailModule.sendAdminWelcomeEmail) {
          console.error('[Admin Creation] ❌ sendAdminWelcomeEmail function not found in emailService module');
          console.error('[Admin Creation] Available exports:', Object.keys(emailModule));
          throw new Error('sendAdminWelcomeEmail function not found in emailService module');
        }

        console.log('[Admin Creation] Calling sendAdminWelcomeEmail with:', {
          email: createdAdmin.email,
          firstName: createdAdmin.first_name,
          lastName: createdAdmin.last_name,
          hasPassword: !!password,
          roleName: roleName
        });
        
        const emailResult = await emailModule.sendAdminWelcomeEmail(
          createdAdmin.email,
          createdAdmin.first_name,
          createdAdmin.last_name,
          password, // Send plain password in email
          roleName
        );

        console.log('[Admin Creation] Email result:', JSON.stringify(emailResult, null, 2));

        if (!emailResult.success) {
          console.error('[Admin Creation] ❌ Failed to send admin welcome email:', emailResult.message);
          // Don't fail admin creation if email fails, just log it
        } else {
          console.log('[Admin Creation] ✅ Welcome email sent successfully! Message ID:', emailResult.messageId);
        }
      } catch (emailError) {
        console.error('[Admin Creation] ❌ Error sending admin welcome email:', emailError.message);
        console.error('[Admin Creation] Error name:', emailError.name);
        console.error('[Admin Creation] Error code:', emailError.code);
        if (emailError.stack) {
          console.error('[Admin Creation] Error stack:', emailError.stack);
        }
        // Don't fail admin creation if email fails
      }

      return createdAdmin;
    } catch (error) {
      console.error('Error creating admin:', error);
      throw new Error(error.message || 'Failed to create admin in database');
    }
  }

  /**
   * Update admin
   * @param {number} id 
   * @param {object} updateData 
   * @returns {Promise<object|null>}
   */
  static async updateAdmin(id, updateData) {
    try {
      const mutation = `
        mutation UpdateAdmin(
          $id: Int!
          $first_name: String
          $last_name: String
          $email: String
          $phone: String
          $status: Boolean
        ) {
          update_mst_super_admin_by_pk(
            pk_columns: { id: $id }
            _set: {
              first_name: $first_name
              last_name: $last_name
              email: $email
              phone: $phone
              status: $status
            }
          ) {
            id
            first_name
            last_name
            email
            phone
            status
            updated_at
          }
        }
      `;

      const client = getHasuraClient();
      const data = await client.client.request(mutation, { id, ...updateData });
      return data.update_mst_super_admin_by_pk;
    } catch (error) {
      console.error('Error updating admin:', error);
      throw new Error('Failed to update admin in database');
    }
  }

  /**
   * Delete admin
   * @param {number} id 
   * @returns {Promise<boolean>}
   */
  static async deleteAdmin(id) {
    try {
      const mutation = `
        mutation DeleteAdmin($id: Int!) {
          delete_mst_super_admin_by_pk(id: $id) {
            id
          }
        }
      `;

      const client = getHasuraClient();
      const data = await client.client.request(mutation, { id });
      return !!data.delete_mst_super_admin_by_pk;
    } catch (error) {
      console.error('Error deleting admin:', error);
      throw new Error('Failed to delete admin from database');
    }
  }

  /**
   * Get admin by email (helper method)
   * @param {string} email 
   * @returns {Promise<object|null>}
   */
  static async getAdminByEmail(email) {
    try {
      const query = `
        query GetAdminByEmail($email: String!) {
          mst_super_admin(where: { email: { _eq: $email } }, limit: 1) {
            id
            email
          }
        }
      `;

      const client = getHasuraClient();
      const data = await client.client.request(query, { email });
      return data.mst_super_admin && data.mst_super_admin.length > 0 ? data.mst_super_admin[0] : null;
    } catch (error) {
      console.error('Error fetching admin by email:', error);
      return null;
    }
  }
}
