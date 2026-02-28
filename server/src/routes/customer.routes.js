import express from 'express';
import { approveCustomer, rejectCustomer } from '../controllers/customer.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @route   POST /api/customer/approve
 * @desc    Approve customer with payment processing
 * @access  Protected (Reseller)
 */
router.post('/approve', authMiddleware, approveCustomer);

/**
 * @route   POST /api/customer/reject
 * @desc    Reject customer and send rejection email (reseller SMTP)
 * @access  Protected (Admin or Reseller)
 */
router.post('/reject', authMiddleware, rejectCustomer);

export default router;

