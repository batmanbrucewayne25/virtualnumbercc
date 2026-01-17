import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { hasuraClient, getHasuraClient } from '../config/hasura.client.js';

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
      const decoded = jwt.verify(oldToken, process.env.JWT_SECRET, {
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

    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });
  }

  /**
   * Verify JWT token
   * @param {string} token 
   * @returns {object} Decoded token payload
   */
  static verifyToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET);
  }
}
