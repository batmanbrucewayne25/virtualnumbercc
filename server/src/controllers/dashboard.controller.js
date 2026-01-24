import { DashboardService } from '../services/dashboard.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * @desc    Get dashboard statistics
 * @route   GET /api/dashboard/stats
 */
export const getDashboardStats = asyncHandler(async (req, res) => {
  const stats = await DashboardService.getDashboardStats();

  res.json({
    success: true,
    data: stats
  });
});

/**
 * @desc    Get dashboard chart data
 * @route   GET /api/dashboard/charts
 */
export const getChartData = asyncHandler(async (req, res) => {
  const chartData = await DashboardService.getChartData();

  res.json({
    success: true,
    data: chartData
  });
});

/**
 * @desc    Get expiring numbers list for Super Admin
 * @route   GET /api/dashboard/expiring-numbers
 */
export const getExpiringNumbers = asyncHandler(async (req, res) => {
  const numbers = await DashboardService.getExpiringNumbers();

  res.json({
    success: true,
    data: numbers
  });
});

