import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getUserByEmail, createUser, client } from './hasuraService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Hash password using bcrypt
 */
export const hashPassword = async (password) => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

/**
 * Compare password with hash
 */
export const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

/**
 * Generate JWT token
 */
export const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

/**
 * Generate refresh token
 */
export const generateRefreshToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
};

/**
 * Verify JWT token
 */
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

/**
 * Login user
 */
export const login = async (email, password) => {
  // Get user from Hasura
  const user = await getUserByEmail(email);

  if (!user) {
    throw new Error('Invalid email or password');
  }

  // Check if user is active
  if (!user.status) {
    throw new Error('Account is inactive. Please contact support.');
  }

  // For existing users with plain text passwords, handle migration
  // Check if password is already hashed (starts with $2a$ or $2b$)
  const isHashed = user.password_hash?.startsWith('$2a$') || user.password_hash?.startsWith('$2b$');
  
  let passwordValid = false;
  
  if (isHashed) {
    // Password is hashed, use bcrypt compare
    passwordValid = await comparePassword(password, user.password_hash);
  } else {
    // Legacy: plain text password (for migration)
    // Hash the new password and update in database
    if (password === user.password_hash) {
      passwordValid = true;
      // Optionally: migrate to hashed password in background
      // const hashedPassword = await hashPassword(password);
      // await updateUserPassword(user.id, hashedPassword);
    }
  }

  if (!passwordValid) {
    throw new Error('Invalid email or password');
  }

  // Remove password_hash from user object
  const { password_hash, ...userWithoutPassword } = user;

  // Generate tokens
  const token = generateToken({
    userId: user.id,
    email: user.email,
  });

  const refreshToken = generateRefreshToken({
    userId: user.id,
    email: user.email,
  });

  return {
    success: true,
    token,
    refreshToken,
    user: userWithoutPassword,
    message: 'Login successful',
  };
};

/**
 * Get admin by email (for forgot password)
 */
export const getAdminByEmail = async (email) => {
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
      }
    }
  `;

  try {
    const data = await client.request(query, { email });
    return data.mst_super_admin?.[0] || null;
  } catch (error) {
    console.error('Hasura query error:', error);
    return null;
  }
};

/**
 * Generate password reset token
 */
export const generatePasswordResetToken = (userId, email) => {
  const payload = {
    userId,
    email,
    type: 'password_reset'
  };
  // Reset token expires in 1 hour
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
};

/**
 * Verify password reset token
 */
export const verifyPasswordResetToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== 'password_reset') {
      return null;
    }
    return decoded;
  } catch (error) {
    return null;
  }
};

/**
 * Forgot password - Generate reset token
 */
export const forgotPassword = async (email) => {
  try {
    // Check admin first
    let user = await getAdminByEmail(email);
    let userType = 'admin';
    
    if (!user) {
      // Check reseller
      user = await getUserByEmail(email);
      userType = 'reseller';
    }

    if (!user) {
      // Don't reveal if email exists for security
      return {
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      };
    }

    if (!user.status) {
      return {
        success: false,
        message: 'Account is inactive. Please contact support.'
      };
    }

    // Generate reset token
    const resetToken = generatePasswordResetToken(user.id, user.email);

    // Send email with reset link
    const { sendPasswordResetEmail } = await import('./emailService.js');
    const emailResult = await sendPasswordResetEmail(user.email, resetToken);

    // Log for development/testing
    if (process.env.NODE_ENV === 'development') {
      console.log('Password reset token generated for:', email);
      console.log('Reset token (for testing):', resetToken);
      console.log('Reset URL:', `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`);
    }

    // If email sending failed, log but don't fail the request (for security, don't reveal if email exists)
    if (!emailResult.success) {
      console.error('Failed to send password reset email:', emailResult.message);
      // Still return success to user (don't reveal if email exists)
    }

    return {
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
      // In development, include token for testing
      resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined
    };
  } catch (error) {
    console.error('Forgot password error:', error);
    return {
      success: false,
      message: 'An error occurred. Please try again later.'
    };
  }
};

/**
 * Reset password - Update password using reset token
 */
export const resetPassword = async (token, newPassword) => {
  try {
    // Verify reset token
    const decoded = verifyPasswordResetToken(token);
    if (!decoded) {
      return {
        success: false,
        message: 'Invalid or expired reset token.'
      };
    }

    const { userId, email } = decoded;

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update password - check admin first, then reseller
    let updated = false;
    let updateError = null;
    
    // Try updating admin first
    try {
      const adminUpdateMutation = `
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
      
      const adminResult = await client.request(adminUpdateMutation, {
        id: userId,
        password_hash: passwordHash
      });
      
      if (adminResult.update_mst_super_admin_by_pk) {
        updated = true;
      }
    } catch (adminError) {
      updateError = adminError;
      // If admin update fails, try reseller
      try {
        const resellerUpdateMutation = `
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
        
        const resellerResult = await client.request(resellerUpdateMutation, {
          id: userId,
          password_hash: passwordHash
        });
        
        if (resellerResult.update_mst_reseller_by_pk) {
          updated = true;
          updateError = null;
        }
      } catch (resellerError) {
        console.error('Error updating password (both admin and reseller failed):', {
          adminError,
          resellerError
        });
        updateError = resellerError;
      }
    }

    if (updated) {
      return {
        success: true,
        message: 'Password has been reset successfully. You can now login with your new password.'
      };
    }

    // If we got here, both updates failed
    const errorMessage = updateError?.response?.errors?.[0]?.message || 
                        updateError?.message || 
                        'Failed to update password. Please try again.';
    
    return {
      success: false,
      message: errorMessage
    };
  } catch (error) {
    console.error('Reset password error:', error);
    return {
      success: false,
      message: error.message || 'An error occurred. Please try again later.'
    };
  }
};

/**
 * Register new user
 */
export const register = async ({ first_name, last_name, email, phone, password }) => {
  // Check if user already exists
  const existingUser = await getUserByEmail(email);
  if (existingUser) {
    throw new Error('Email already registered');
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create user in Hasura
  const user = await createUser({
    first_name,
    last_name,
    email,
    phone,
    password_hash: passwordHash,
  });

  // Remove password_hash from response
  const { password_hash, ...userWithoutPassword } = user;

  // Generate tokens
  const token = generateToken({
    userId: user.id,
    email: user.email,
  });

  const refreshToken = generateRefreshToken({
    userId: user.id,
    email: user.email,
  });

  return {
    success: true,
    token,
    refreshToken,
    user: userWithoutPassword,
    message: 'Registration successful',
  };
};

/**
 * Refresh JWT token
 */
export const refreshToken = async (refreshTokenString) => {
  const decoded = verifyToken(refreshTokenString);

  if (!decoded) {
    throw new Error('Invalid or expired refresh token');
  }

  // Get user to ensure they still exist
  const user = await getUserByEmail(decoded.email);

  if (!user || !user.status) {
    throw new Error('User not found or inactive');
  }

  // Generate new tokens
  const token = generateToken({
    userId: user.id,
    email: user.email,
  });

  const newRefreshToken = generateRefreshToken({
    userId: user.id,
    email: user.email,
  });

  return {
    success: true,
    token,
    refreshToken: newRefreshToken,
    message: 'Token refreshed successfully',
  };
};
