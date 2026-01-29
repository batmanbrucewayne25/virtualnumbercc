import express from 'express';
import { sendResellerApprovalNotifications } from '../controllers/notification.controller.js';

const router = express.Router();

/**
 * @route   POST /api/notifications/reseller-approval
 * @desc    Send reseller approval notifications (email and WhatsApp)
 * @access  Private (Admin only)
 */
router.post('/reseller-approval', sendResellerApprovalNotifications);

export default router;

