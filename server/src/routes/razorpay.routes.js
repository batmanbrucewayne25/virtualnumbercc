import express from 'express';
import { createPlan, createSubscription, createPlanAndSubscription } from '../controllers/razorpay.controller.js';
import { 
  handleWebhook, 
  getAllTransactions, 
  getTransactionStats, 
  getWebhookUrl,
  saveResellerConfig,
  getResellerConfig
} from '../controllers/razorpay.webhook.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

// ==========================================
// WEBHOOK ROUTES (Public - verified via signature)
// ==========================================

/**
 * @route   POST /api/razorpay/webhook/:resellerId
 * @desc    Handle Razorpay webhook events from reseller accounts
 * @access  Public (verified via webhook signature)
 * @note    This route receives payment notifications from Razorpay
 *          Resellers configure this URL in their Razorpay dashboard
 */
router.post('/webhook/:resellerId', express.raw({ type: 'application/json' }), handleWebhook);

// ==========================================
// CONFIGURATION ROUTES (Private)
// ==========================================

/**
 * @route   POST /api/razorpay/config
 * @desc    Save reseller Razorpay configuration
 * @access  Private (Reseller only)
 */
router.post('/config', authMiddleware, saveResellerConfig);

/**
 * @route   GET /api/razorpay/config/:resellerId
 * @desc    Get reseller Razorpay configuration
 * @access  Private (Reseller or Super Admin)
 */
router.get('/config/:resellerId', authMiddleware, getResellerConfig);

/**
 * @route   GET /api/razorpay/webhook-url/:resellerId
 * @desc    Get webhook URL for a reseller to configure in Razorpay dashboard
 * @access  Private (Reseller or Super Admin)
 */
router.get('/webhook-url/:resellerId', authMiddleware, getWebhookUrl);

// ==========================================
// TRANSACTION ROUTES (Private - Super Admin)
// ==========================================

/**
 * @route   GET /api/razorpay/transactions
 * @desc    Get all transactions for super admin dashboard
 * @access  Private (Super Admin only)
 */
router.get('/transactions', authMiddleware, getAllTransactions);

/**
 * @route   GET /api/razorpay/transactions/stats
 * @desc    Get transaction statistics for super admin dashboard
 * @access  Private (Super Admin only)
 */
router.get('/transactions/stats', authMiddleware, getTransactionStats);

// ==========================================
// PLAN & SUBSCRIPTION ROUTES (Private)
// ==========================================

/**
 * @route   POST /api/razorpay/plan
 * @desc    Create Razorpay plan
 * @access  Private
 */
router.post('/plan', authMiddleware, createPlan);

/**
 * @route   POST /api/razorpay/subscription
 * @desc    Create Razorpay subscription
 * @access  Private
 */
router.post('/subscription', authMiddleware, createSubscription);

/**
 * @route   POST /api/razorpay/plan-and-subscription
 * @desc    Create Razorpay plan and subscription
 * @access  Private
 */
router.post('/plan-and-subscription', authMiddleware, createPlanAndSubscription);

export default router;
