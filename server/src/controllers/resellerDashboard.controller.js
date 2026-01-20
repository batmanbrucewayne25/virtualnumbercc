import { ResellerDashboardService } from '../services/resellerDashboard.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * @desc    Get reseller dashboard statistics
 * @route   GET /api/reseller-dashboard/stats
 */
export const getResellerDashboardStats = asyncHandler(async (req, res) => {
  const resellerId = req.user?.userId;

  if (!resellerId) {
    return res.status(401).json({
      success: false,
      message: 'Unable to determine reseller ID. Please log in again.'
    });
  }

  if (req.user?.role !== 'reseller') {
    return res.status(403).json({
      success: false,
      message: 'Only resellers can access this dashboard.'
    });
  }

  const stats = await ResellerDashboardService.getResellerDashboardStats(resellerId);

  res.json({
    success: true,
    data: stats
  });
});

/**
 * @desc    Get reseller dashboard chart data
 * @route   GET /api/reseller-dashboard/charts
 */
export const getResellerDashboardCharts = asyncHandler(async (req, res) => {
  const resellerId = req.user?.userId;

  if (!resellerId) {
    return res.status(401).json({
      success: false,
      message: 'Unable to determine reseller ID. Please log in again.'
    });
  }

  if (req.user?.role !== 'reseller') {
    return res.status(403).json({
      success: false,
      message: 'Only resellers can access this dashboard.'
    });
  }

  const chartData = await ResellerDashboardService.getResellerDashboardCharts(resellerId);

  res.json({
    success: true,
    data: chartData
  });
});

/**
 * @desc    Get expiring numbers list
 * @route   GET /api/reseller-dashboard/expiring-numbers
 */
export const getExpiringNumbers = asyncHandler(async (req, res) => {
  const resellerId = req.user?.userId;

  if (!resellerId) {
    return res.status(401).json({
      success: false,
      message: 'Unable to determine reseller ID. Please log in again.'
    });
  }

  if (req.user?.role !== 'reseller') {
    return res.status(403).json({
      success: false,
      message: 'Only resellers can access this dashboard.'
    });
  }

  const numbers = await ResellerDashboardService.getExpiringNumbers(resellerId);

  res.json({
    success: true,
    data: numbers
  });
});

