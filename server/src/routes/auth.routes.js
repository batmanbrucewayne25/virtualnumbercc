import express from 'express';
import {
  login,
  register,
  verifyToken,
  refreshToken
} from '../controllers/auth.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', login);

/**
 * @route   POST /api/auth/register
 * @desc    Register new user
 * @access  Public
 */
router.post('/register', register);

/**
 * @route   POST /api/auth/verify
 * @desc    Verify JWT token
 * @access  Private
 */
router.post('/verify', authMiddleware, verifyToken);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh JWT token
 * @access  Public
 */
router.post('/refresh', refreshToken);

export default router;
