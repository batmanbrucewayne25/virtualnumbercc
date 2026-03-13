import express from 'express';
import {
  sendResellerApprovalNotifications,
  sendResellerRejectionNotifications,
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
 * @desc    Send reseller rejection email with reason
 * @access  Private (Admin only)
 */
router.post('/reseller-rejection', sendResellerRejectionNotifications);

export default router;

