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

      // Create admin in Hasura
      const mutation = `
        mutation InsertAdmin(
          $first_name: String!
          $last_name: String!
          $email: String!
          $phone: String
          $password_hash: String!
          $status: Boolean!
        ) {
          insert_mst_super_admin_one(object: {
            first_name: $first_name
            last_name: $last_name
            email: $email
            phone: $phone
            password_hash: $password_hash
            status: $status
          }) {
            id
            first_name
            last_name
            email
            phone
            status
            created_at
          }
        }
      `;

      const variables = {
        ...otherData,
        password_hash,
        phone: otherData.phone || null
      };

      const client = getHasuraClient();
      const data = await client.client.request(mutation, variables);
      return data.insert_mst_super_admin_one;
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
