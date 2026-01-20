import express from 'express';
import {
  getResellerDashboardStats,
  getResellerDashboardCharts,
  getExpiringNumbers
} from '../controllers/resellerDashboard.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @route   GET /api/reseller-dashboard/stats
 * @desc    Get reseller dashboard statistics
 * @access  Protected (Reseller)
 */
router.get('/stats', authMiddleware, getResellerDashboardStats);

/**
 * @route   GET /api/reseller-dashboard/charts
 * @desc    Get reseller dashboard chart data
 * @access  Protected (Reseller)
 */
router.get('/charts', authMiddleware, getResellerDashboardCharts);

/**
 * @route   GET /api/reseller-dashboard/expiring-numbers
 * @desc    Get expiring numbers list
 * @access  Protected (Reseller)
 */
router.get('/expiring-numbers', authMiddleware, getExpiringNumbers);

export default router;

