import express from 'express';
import {
  approveCustomer,
  rejectCustomer,
  sendRenewalPaymentEmail,
  renewVirtualNumberOffline,
  enableGracePeriod
} from '../controllers/customer.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @route   POST /api/customer/approve
 * @desc    Approve customer with payment processing
 * @access  Protected (Reseller)
 */
router.post('/approve', authMiddleware, approveCustomer);

/**
 * @route   POST /api/customer/send-renewal-payment-email
 * @desc    Send renewal payment link email for a virtual number (online payment)
 * @access  Protected (Admin or Reseller)
 */
router.post('/send-renewal-payment-email', authMiddleware, sendRenewalPaymentEmail);

/**
 * @route   POST /api/customer/renew-virtual-number-offline
 * @desc    Renew virtual number via offline payment (extend expiry, debit wallet, create transaction)
 * @access  Protected (Admin or Reseller)
 */
router.post('/renew-virtual-number-offline', authMiddleware, renewVirtualNumberOffline);

/**
 * @route   POST /api/customer/enable-grace-period
 * @desc    Enable 24-hour grace period for a virtual number (admin only)
 * @access  Protected (Admin only)
 */
router.post('/enable-grace-period', authMiddleware, enableGracePeriod);

/**
 * @route   POST /api/customer/reject
 * @desc    Reject customer and send rejection email (reseller SMTP)
 * @access  Protected (Admin or Reseller)
 */
router.post('/reject', authMiddleware, rejectCustomer);

export default router;

