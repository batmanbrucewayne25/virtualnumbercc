import express from 'express';
import {
  sendResellerApprovalNotifications,
  sendResellerRejectionNotifications,
  sendResellerAccountDeactivatedNotification,
} from '../controllers/notification.controller.js';

const router = express.Router();

/**
 * @route   POST /api/notifications/reseller-approval
 * @desc    Send reseller approval notifications (email and WhatsApp)
 * @access  Private (Admin only)
 */
router.post('/reseller-approval', sendResellerApprovalNotifications);

/**
 * @route   POST /api/notifications/reseller-rejection
 * @desc    Send Admin KYC Rejected email to reseller (templated; reason + support contacts)
 * @access  Private (Admin / Super Admin)
 */
router.post('/reseller-rejection', sendResellerRejectionNotifications);

/**
 * @route   POST /api/notifications/reseller-account-deactivated
 * @desc    Email reseller when admin deactivates their account (list toggle)
 * @access  Private (Admin only)
 */
router.post(
  '/reseller-account-deactivated',
  sendResellerAccountDeactivatedNotification,
);

export default router;

