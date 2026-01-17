import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getUserByEmail, createUser } from './hasuraService.js';

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
