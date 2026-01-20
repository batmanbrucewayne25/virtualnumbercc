import { AuthService } from '../services/auth.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Please provide both email and password'
    });
  }

  const result = await AuthService.login(email, password);

  res.json({
    success: true,
    data: result
  });
});

/**
 * @desc    Register new user
 * @route   POST /api/auth/register
 */
export const register = asyncHandler(async (req, res) => {
  const { first_name, last_name, email, phone, password } = req.body;

  // Validate required fields
  if (!first_name || !last_name || !email || !phone || !password) {
    return res.status(400).json({
      success: false,
      message: 'Please provide all required fields: first_name, last_name, email, phone, password'
    });
  }

  // Validate password strength
  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 6 characters long'
    });
  }

  const result = await AuthService.register({
    first_name,
    last_name,
    email,
    phone,
    password
  });

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: result
  });
});

/**
 * @desc    Verify JWT token
 * @route   POST /api/auth/verify
 */
export const verifyToken = asyncHandler(async (req, res) => {
  // If middleware passed, token is valid
  res.json({
    success: true,
    message: 'Token is valid',
    user: req.user
  });
});

/**
 * @desc    Refresh JWT token
 * @route   POST /api/auth/refresh
 */
export const refreshToken = asyncHandler(async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({
      success: false,
      message: 'Token is required'
    });
  }

  const result = await AuthService.refreshToken(token);

  res.json({
    success: true,
    data: result
  });
});

/**
 * @desc    Change password for authenticated user
 * @route   POST /api/auth/change-password
 */
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const { userId, role } = req.user;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Current password and new password are required'
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'New password must be at least 6 characters long'
    });
  }

  if (currentPassword === newPassword) {
    return res.status(400).json({
      success: false,
      message: 'New password must be different from current password'
    });
  }

  const result = await AuthService.changePassword(userId, currentPassword, newPassword, role);
  
  if (result.success) {
    res.json({
      success: true,
      message: result.message
    });
  } else {
    res.status(400).json({
      success: false,
      message: result.message
    });
  }
});