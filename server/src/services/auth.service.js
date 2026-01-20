import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { hasuraClient, getHasuraClient } from '../config/hasura.client.js';

// JWT configuration with fallback
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export class AuthService {
  /**
   * Login user
   * @param {string} email 
   * @param {string} password 
   * @returns {Promise<{token: string, user: object}>}
   */
  static async login(email, password) {
    try {
      let user = null;
      let userType = 'reseller';

      // First check mst_super_admin (for admin login)
      const adminUser = await this.getAdminByEmail(email);
      if (adminUser) {
        user = adminUser;
        userType = 'admin';
      } else {
        // If not admin, check mst_reseller (for regular user login)
        user = await hasuraClient.getUserByEmail(email);
        
        // Check if reseller is approved before allowing login
        if (user && !user.approval_date) {
          // If reseller is not approved, check if they have been rejected
          if (user.rejection_reason) {
            throw new Error('Your account has been rejected. Please contact support for more information.');
          }
          // Reseller is pending approval
          throw new Error('Your account is pending approval. Please wait for administrator approval.');
        }
      }

      if (!user) {
        throw new Error('Invalid email or password');
      }

      // Verify password
      const isPasswordValid = await this.verifyPassword(
        password,
        user.password_hash
      );

      if (!isPasswordValid) {
        throw new Error('Invalid email or password');
      }

      // Generate JWT token with user type
      const token = this.generateToken(user, userType);

      // Remove password_hash from user object
      const { password_hash, ...userWithoutPassword } = user;

      return {
        token,
        user: userWithoutPassword
      };
    } catch (error) {
      throw new Error(error.message || 'Login failed');
    }
  }

  /**
   * Get admin by email (helper method for login)
   * @param {string} email 
   * @returns {Promise<object|null>}
   */
  static async getAdminByEmail(email) {
    try {
      const client = getHasuraClient();
      
      const query = `
        query GetAdminByEmail($email: String!) {
          mst_super_admin(where: { email: { _eq: $email } }, limit: 1) {
            id
            first_name
            last_name
            email
            phone
            password_hash
            status
            created_at
            updated_at
          }
        }
      `;

      const data = await client.client.request(query, { email });
      return data.mst_super_admin && data.mst_super_admin.length > 0 
        ? data.mst_super_admin[0] 
        : null;
    } catch (error) {
      console.error('Error fetching admin by email:', error);
      return null;
    }
  }

  /**
   * Register new user
   * @param {object} userData 
   * @returns {Promise<{token: string, user: object}>}
   */
  static async register(userData) {
    try {
      const { email, password, ...otherData } = userData;

      // Check if user already exists
      const existingUser = await hasuraClient.getUserByEmail(email);
      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // Hash password
      const password_hash = await this.hashPassword(password);

      // Create user in Hasura
      const user = await hasuraClient.createUser({
        ...otherData,
        email,
        password_hash,
        current_step: 1,
        is_email_verified: false,
        is_phone_verified: false,
        signup_completed: false,
        status: false
      });

      // Generate JWT token
      const token = this.generateToken(user);

      // Remove password_hash from user object
      const { password_hash: _, ...userWithoutPassword } = user;

      return {
        token,
        user: userWithoutPassword
      };
    } catch (error) {
      throw new Error(error.message || 'Registration failed');
    }
  }

  /**
   * Refresh JWT token
   * @param {string} oldToken 
   * @returns {Promise<{token: string}>}
   */
  static async refreshToken(oldToken) {
    try {
      // Verify old token (allow expired tokens for refresh)
      const decoded = jwt.verify(oldToken, JWT_SECRET, {
        ignoreExpiration: false
      });

      // Get user from Hasura
      const user = await hasuraClient.getUserById(decoded.userId);

      if (!user) {
        throw new Error('User not found');
      }

      // Generate new token
      const token = this.generateToken(user);

      return { token };
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Hash password using bcrypt
   * @param {string} password 
   * @returns {Promise<string>}
   */
  static async hashPassword(password) {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
  }

  /**
   * Verify password
   * @param {string} plainPassword 
   * @param {string} hashedPassword 
   * @returns {Promise<boolean>}
   */
  static async verifyPassword(plainPassword, hashedPassword) {
    // If password is stored as plain text (legacy), handle migration
    // Check if password is already hashed (bcrypt hashes start with $2a$, $2b$, or $2y$)
    if (hashedPassword.startsWith('$2')) {
      // It's a bcrypt hash, verify normally
      return await bcrypt.compare(plainPassword, hashedPassword);
    } else {
      // Plain text password (legacy) - compare directly but warn
      // TODO: After verification, hash and update in database
      console.warn('⚠️  Legacy plain text password detected. Please migrate to hashed passwords.');
      return plainPassword === hashedPassword;
    }
  }

  /**
   * Generate JWT token
   * @param {object} user 
   * @param {string} userType - 'admin' or 'reseller'
   * @returns {string}
   */
  static generateToken(user, userType = 'reseller') {
    const payload = {
      userId: user.id,
      email: user.email,
      role: userType // 'admin' or 'reseller'
    };

    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN
    });
  }

  /**
   * Verify JWT token
   * @param {string} token 
   * @returns {object} Decoded token payload
   */
  static verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
  }

  /**
   * Change password for authenticated user
   * @param {string} userId 
   * @param {string} currentPassword 
   * @param {string} newPassword 
   * @param {string} userRole - 'admin' or 'reseller'
   * @returns {Promise<{success: boolean, message: string}>}
   */
  static async changePassword(userId, currentPassword, newPassword, userRole) {
    try {
      const client = getHasuraClient();
      let user = null;

      // Get user from database based on role
      if (userRole === 'admin') {
        const query = `
          query GetAdminById($id: uuid!) {
            mst_super_admin_by_pk(id: $id) {
              id
              email
              password_hash
              status
            }
          }
        `;
        const result = await client.client.request(query, { id: userId });
        user = result.mst_super_admin_by_pk;
      } else if (userRole === 'reseller') {
        const query = `
          query GetResellerById($id: uuid!) {
            mst_reseller_by_pk(id: $id) {
              id
              email
              password_hash
              status
            }
          }
        `;
        const result = await client.client.request(query, { id: userId });
        user = result.mst_reseller_by_pk;
      }

      if (!user) {
        return {
          success: false,
          message: 'User not found.'
        };
      }

      // Check if user is active
      if (!user.status) {
        return {
          success: false,
          message: 'Account is inactive. Please contact support.'
        };
      }

      // Verify current password
      const passwordValid = await this.verifyPassword(currentPassword, user.password_hash);

      if (!passwordValid) {
        return {
          success: false,
          message: 'Current password is incorrect.'
        };
      }

      // Hash new password
      const passwordHash = await this.hashPassword(newPassword);

      // Update password in database
      let updated = false;

      if (userRole === 'admin') {
        const mutation = `
          mutation UpdateAdminPassword($id: uuid!, $password_hash: String!) {
            update_mst_super_admin_by_pk(
              pk_columns: { id: $id }
              _set: { password_hash: $password_hash }
            ) {
              id
              email
            }
          }
        `;
        const result = await client.client.request(mutation, {
          id: userId,
          password_hash: passwordHash
        });
        updated = !!result.update_mst_super_admin_by_pk;
      } else if (userRole === 'reseller') {
        const mutation = `
          mutation UpdateResellerPassword($id: uuid!, $password_hash: String!) {
            update_mst_reseller_by_pk(
              pk_columns: { id: $id }
              _set: { password_hash: $password_hash }
            ) {
              id
              email
            }
          }
        `;
        const result = await client.client.request(mutation, {
          id: userId,
          password_hash: passwordHash
        });
        updated = !!result.update_mst_reseller_by_pk;
      }

      if (updated) {
        return {
          success: true,
          message: 'Password changed successfully.'
        };
      }

      return {
        success: false,
        message: 'Failed to update password. Please try again.'
      };
    } catch (error) {
      console.error('Change password error:', error);
      return {
        success: false,
        message: error.message || 'An error occurred. Please try again later.'
      };
    }
  }
}
