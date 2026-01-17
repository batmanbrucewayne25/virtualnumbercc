import express from 'express';
import { login, register, verifyToken, refreshToken } from '../services/authService.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @route   POST /api/auth/login
 * @desc    Login user with email and password
 * @access  Public
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        error: 'Email and password are required' 
      });
    }

    const result = await login(email, password);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', async (req, res, next) => {
  try {
    const { first_name, last_name, email, phone, password } = req.body;

    if (!first_name || !last_name || !email || !phone || !password) {
      return res.status(400).json({ 
        success: false,
        error: 'All fields are required' 
      });
    }

    const result = await register({ first_name, last_name, email, phone, password });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/auth/verify
 * @desc    Verify JWT token
 * @access  Private
 */
router.get('/verify', authenticateToken, (req, res) => {
  res.json({ 
    success: true,
    message: 'Token is valid',
    user: req.user
  });
});

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh JWT token
 * @access  Public (with refresh token)
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ 
        success: false,
        error: 'Refresh token is required' 
      });
    }

    const result = await refreshToken(refreshToken);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
