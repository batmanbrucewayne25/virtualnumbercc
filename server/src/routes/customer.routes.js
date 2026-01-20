import express from 'express';
import { approveCustomer } from '../controllers/customer.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @route   POST /api/customer/approve
 * @desc    Approve customer with payment processing
 * @access  Protected (Reseller)
 */
router.post('/approve', authMiddleware, approveCustomer);

export default router;

