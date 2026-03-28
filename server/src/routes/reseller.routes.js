import express from 'express';
import {
  getResellerByDomain,
  getMaintenanceModeStatus,
} from '../controllers/reseller.controller.js';
import {
  upsertAllowedCustomers,
  checkAllowedCustomer,
  getAllowedCustomersCount,
} from '../controllers/resellerAllowedCustomer.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @route   GET /api/reseller/by-domain
 * @desc    Get reseller by custom domain (only approved domains)
 * @access  Public
 */
router.get('/by-domain', getResellerByDomain);

/**
 * @route   GET /api/reseller/maintenance-mode
 * @desc    Global maintenance flag (mst_admin_setting)
 * @access  Public
 */
router.get('/maintenance-mode', getMaintenanceModeStatus);

/**
 * @route   POST /api/reseller/check-allowed-customer
 * @desc    Check if email/phone is in reseller's allowed list (for ClientHub onboarding)
 * @access  Public
 */
router.post('/check-allowed-customer', checkAllowedCustomer);

/**
 * @route   POST /api/reseller/allowed-customers
 * @desc    Replace allowed customers list (emails/phones) for logged-in reseller
 * @access  Private (Reseller only)
 */
router.post('/allowed-customers', authMiddleware, upsertAllowedCustomers);

/**
 * @route   GET /api/reseller/allowed-customers/count
 * @desc    Get count of allowed customers for logged-in reseller
 * @access  Private (Reseller only)
 */
router.get('/allowed-customers/count', authMiddleware, getAllowedCustomersCount);

export default router;
