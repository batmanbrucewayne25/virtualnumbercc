import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { hasuraClient, getHasuraClient } from "../config/hasura.client.js";

// JWT configuration with fallback
const JWT_SECRET = process.env.JWT_SECRET || "JWT_SECRET";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// Log JWT_SECRET status on module load (for debugging)
if (!process.env.JWT_SECRET) {
  console.warn(
    "⚠️  [AuthService] JWT_SECRET not set in environment, using fallback secret"
  );
} else {
  console.log("✅ [AuthService] JWT_SECRET is set from environment");
}

export class AuthService {
  /**
   * Login user
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{token: string, user: object}>}
   */
  static async login(email, password) {
    try {
      console.log("🔐 Login attempt for email:", email);
      let user = null;
      let userType = "reseller";

      // First check mst_super_admin (for admin login)
      console.log("📋 Checking for admin user...");
      const adminUser = await this.getAdminByEmail(email);
      if (adminUser) {
        console.log("✅ Admin user found:", adminUser.email);
        user = adminUser;
        userType = "admin";
      } else {
        console.log("❌ Admin user not found, checking reseller...");
        // If not admin, check mst_reseller (for reseller login)
        user = await hasuraClient.getUserByEmail(email);

        if (user) {
          console.log("✅ Reseller user found:", user.email);
          console.log("📊 Reseller status:", {
            approval_date: user.approval_date,
            suspended_at: user.suspended_at,
            rejection_reason: user.rejection_reason,
            status: user.status,
          });
          userType = "reseller";

          // Check if reseller is approved before allowing login
          if (!user.approval_date) {
            // If reseller is not approved, check if they have been rejected
            if (user.rejection_reason) {
              console.log(
                "🚫 Reseller account rejected:",
                user.rejection_reason
              );
              throw new Error(
                "Your account has been rejected. Please contact support for more information."
              );
            }
            // Reseller is pending approval
            console.log("⏳ Reseller account pending approval");
            throw new Error(
              "Your account is pending approval. Please wait for administrator approval."
            );
          }

          // Check if reseller is suspended (check suspended_at field)
          if (user.suspended_at) {
            console.log(
              "🚫 Reseller account suspended:",
              user.suspended_reason
            );
            throw new Error(
              "Your account has been suspended. Please contact admin for more information."
            );
          }

          // Check reseller validity expiry (only for resellers, not admins)
          if (user.approval_date) {
            console.log("🔍 Checking reseller validity...");
            const validityCheck = await this.checkResellerValidity(user.id);
            console.log("📅 Validity check result:", validityCheck);
            if (!validityCheck.isValid) {
              throw new Error(
                validityCheck.message ||
                  "Your account has expired. Please contact admin."
              );
            }
          }
        } else {
          console.log("❌ Reseller user not found, checking customer...");
          // If not reseller, check mst_customer (for customer login)
          try {
            user = await hasuraClient.getCustomerByEmail(email);

            if (user) {
              console.log("✅ Customer user found:", user.email);
              userType = "customer";

              // Check customer status
              // Note: status might be a string like "pending", "active", "suspended", "inactive"
              if (user.status === "suspended" || user.status === "inactive") {
                console.log("🚫 Customer account suspended or inactive");
                throw new Error(
                  "Your account is inactive. Please contact support."
                );
              }

              // Customers don't need approval like resellers, but check kyc_status if needed
              if (user.kyc_status === "rejected") {
                console.log("🚫 Customer KYC rejected");
                throw new Error(
                  "Your KYC verification was rejected. Please contact support."
                );
              }
            } else {
              console.log("❌ Customer user not found");
            }
          } catch (error) {
            console.error("❌ Error checking customer:", error.message);
            // If it's a business logic error (suspended, rejected), re-throw it
            if (
              error.message.includes("inactive") ||
              error.message.includes("rejected")
            ) {
              throw error;
            }
            // Otherwise, log and continue - user will be null and we'll throw "Invalid email or password"
            console.log(
              "⚠️  Customer lookup failed, treating as user not found"
            );
            user = null;
          }
        }
      }

      if (!user) {
        console.log("❌ No user found with email:", email);
        throw new Error("Invalid email or password");
      }

      // Verify password
      if (!user.password_hash) {
        throw new Error("Invalid email or password");
      }

      const isPasswordValid = await this.verifyPassword(
        password,
        user.password_hash
      );

      if (!isPasswordValid) {
        throw new Error("Invalid email or password");
      }

      // Generate JWT token with user type
      console.log("🎫 Generating JWT token for user type:", userType);
      const token = this.generateToken(user, userType);

      // Remove password_hash from user object
      const { password_hash, ...userWithoutPassword } = user;

      console.log("✅ Login successful for:", email, "User type:", userType);
      return {
        token,
        user: userWithoutPassword,
      };
    } catch (error) {
      console.error("❌ Login error:", error.message);
      console.error("📚 Error stack:", error.stack);
      throw new Error(error.message || "Login failed");
    }
  }

  /**
   * Check reseller validity expiry
   * @param {string} resellerId
   * @returns {Promise<{isValid: boolean, message?: string}>}
   */
  static async checkResellerValidity(resellerId) {
    try {
      const client = getHasuraClient();

      const query = `
        query GetResellerValidity($reseller_id: uuid!) {
          mst_reseller_validity(
            where: { 
              reseller_id: { _eq: $reseller_id }
            }
            limit: 1
          ) {
            id
            validity_end_date
            status
          }
        }
      `;

      const result = await client.client.request(query, {
        reseller_id: resellerId,
      });
      const validity = result.mst_reseller_validity?.[0];

      // If no validity record exists, allow login (for backward compatibility)
      // Existing resellers without validity records can still login
      if (!validity) {
        return {
          isValid: true,
          message: "No validity record found",
        };
      }

      // Check status - if EXPIRED or SUSPENDED, block login
      if (validity.status === "EXPIRED" || validity.status === "SUSPENDED") {
        return {
          isValid: false,
          message: "Your account has expired. Please contact admin.",
        };
      }

      // Check if validity has expired by date (even if status is still ACTIVE)
      const validityEndDate = new Date(validity.validity_end_date);
      const now = new Date();

      if (validityEndDate < now) {
        return {
          isValid: false,
          message: "Your account has expired. Please contact admin.",
        };
      }

      return {
        isValid: true,
      };
    } catch (error) {
      console.error("Error checking reseller validity:", error);
      // On error, allow login (fail open) - you may want to change this to fail closed
      return {
        isValid: true,
        message: "Error checking validity, allowing login",
      };
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
      console.error("Error fetching admin by email:", error);
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
        throw new Error("User with this email already exists");
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
        status: false,
      });

      // Generate JWT token
      const token = this.generateToken(user);

      // Remove password_hash from user object
      const { password_hash: _, ...userWithoutPassword } = user;

      return {
        token,
        user: userWithoutPassword,
      };
    } catch (error) {
      throw new Error(error.message || "Registration failed");
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
        ignoreExpiration: false,
      });

      // Get user from Hasura
      const user = await hasuraClient.getUserById(decoded.userId);

      if (!user) {
        throw new Error("User not found");
      }

      // Generate new token
      const token = this.generateToken(user);

      return { token };
    } catch (error) {
      throw new Error("Invalid or expired token");
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
    // Handle null or undefined password hash
    if (!hashedPassword) {
      console.warn("⚠️  Password hash is null or undefined");
      return false;
    }

    // Check if password is bcrypt hash (starts with $2a$, $2b$, or $2y$)
    if (hashedPassword.startsWith("$2")) {
      // It's a bcrypt hash, verify normally
      return await bcrypt.compare(plainPassword, hashedPassword);
    }

    // Check if password is SHA-256 hash (64 hex characters)
    // Customers use SHA-256 hashes created on client side
    if (
      hashedPassword.length === 64 &&
      /^[a-f0-9]{64}$/i.test(hashedPassword)
    ) {
      const hash = crypto
        .createHash("sha256")
        .update(plainPassword)
        .digest("hex");
      return hash.toLowerCase() === hashedPassword.toLowerCase();
    }

    // Plain text password (legacy) - compare directly but warn
    // TODO: After verification, hash and update in database
    console.warn(
      "⚠️  Legacy plain text password detected. Please migrate to hashed passwords."
    );

    // Try multiple comparison methods for plain text passwords
    // Some databases might store passwords with extra whitespace or encoding issues
    const exactMatch = plainPassword === hashedPassword;
    const trimmedMatch = plainPassword.trim() === hashedPassword.trim();

    return exactMatch || trimmedMatch;
  }

  /**
   * Generate JWT token
   * @param {object} user
   * @param {string} userType - 'admin' or 'reseller'
   * @returns {string}
   */
  static generateToken(user, userType = "reseller") {
    const payload = {
      userId: user.id,
      email: user.email,
      role: userType, // 'admin' or 'reseller'
    };

    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });
  }

  /**
   * Verify JWT token
   * @param {string} token
   * @returns {object} Decoded token payload
   */
  static verifyToken(token) {
    console.log(
      "🔐 [AuthService] Verifying token with JWT_SECRET:",
      JWT_SECRET ? "SET" : "NOT SET"
    );
    console.log(
      "🔐 [AuthService] JWT_SECRET length:",
      JWT_SECRET ? JWT_SECRET.length : 0
    );
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      console.log("✅ [AuthService] Token verified successfully");
      return decoded;
    } catch (error) {
      console.error(
        "❌ [AuthService] Token verification error:",
        error.name,
        error.message
      );
      throw error;
    }
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
      if (userRole === "admin") {
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
      } else if (userRole === "reseller") {
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
          message: "User not found.",
        };
      }

      // Check if user is active
      if (!user.status) {
        return {
          success: false,
          message: "Account is inactive. Please contact support.",
        };
      }

      // Verify current password
      const passwordValid = await this.verifyPassword(
        currentPassword,
        user.password_hash
      );

      if (!passwordValid) {
        return {
          success: false,
          message: "Current password is incorrect.",
        };
      }

      // Hash new password
      const passwordHash = await this.hashPassword(newPassword);

      // Update password in database
      let updated = false;

      if (userRole === "admin") {
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
          password_hash: passwordHash,
        });
        updated = !!result.update_mst_super_admin_by_pk;
      } else if (userRole === "reseller") {
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
          password_hash: passwordHash,
        });
        updated = !!result.update_mst_reseller_by_pk;
      }

      if (updated) {
        return {
          success: true,
          message: "Password changed successfully.",
        };
      }

      return {
        success: false,
        message: "Failed to update password. Please try again.",
      };
    } catch (error) {
      console.error("Change password error:", error);
      return {
        success: false,
        message: error.message || "An error occurred. Please try again later.",
      };
    }
  }
}
