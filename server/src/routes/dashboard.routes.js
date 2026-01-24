import express from 'express';
import { getDashboardStats, getChartData, getExpiringNumbers } from '../controllers/dashboard.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @route   GET /api/dashboard/stats
 * @desc    Get dashboard statistics
 * @access  Private
 */
router.get('/stats', authMiddleware, getDashboardStats);

/**
 * @route   GET /api/dashboard/charts
 * @desc    Get dashboard chart data
 * @access  Private
 */
router.get('/charts', authMiddleware, getChartData);

/**
 * @route   GET /api/dashboard/expiring-numbers
 * @desc    Get expiring numbers list for Super Admin
 * @access  Protected (Admin)
 */
router.get('/expiring-numbers', authMiddleware, getExpiringNumbers);

export default router;

