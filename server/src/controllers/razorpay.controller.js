import { asyncHandler } from '../utils/asyncHandler.js';
import * as RazorpayService from '../services/razorpay.service.js';

/**
 * @desc    Create Razorpay plan
 * @route   POST /api/razorpay/plan
 * @access  Private
 */
export const createPlan = asyncHandler(async (req, res) => {
  let { reseller_id, plan_name, amount, currency, duration_days, description } = req.body;

  // FAANG-grade security: Ensure resellers can only create plans for themselves,
  // and automatically inject their ID if missing from the request body.
  if (req.user && req.user.role === 'reseller') {
    reseller_id = req.user.userId;
  }

  // Validate required fields
  if (!reseller_id || !plan_name || !amount || !duration_days) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: reseller_id, plan_name, amount, duration_days'
    });
  }

  // Validate amount
  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Amount must be a positive number'
    });
  }

  // Validate duration_days
  const durationDaysNum = parseInt(duration_days);
  if (isNaN(durationDaysNum) || durationDaysNum <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Duration days must be a positive number'
    });
  }

  try {
    const result = await RazorpayService.createRazorpayPlan(reseller_id, {
      plan_name,
      amount: amountNum,
      currency: currency || 'INR',
      duration_days: durationDaysNum,
      description: description || null
    });

    res.status(201).json({
      success: true,
      message: 'Razorpay plan created successfully',
      data: {
        plan_id: result.plan_id,
        plan: result.plan
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to create Razorpay plan'
    });
  }
});

/**
 * @desc    Create Razorpay subscription
 * @route   POST /api/razorpay/subscription
 * @access  Private
 */
export const createSubscription = asyncHandler(async (req, res) => {
  let { reseller_id, plan_id, total_count, customer, notes } = req.body;

  // FAANG-grade security: Ensure resellers can only create subscriptions for themselves,
  // and automatically inject their ID if missing from the request body.
  if (req.user && req.user.role === 'reseller') {
    reseller_id = req.user.userId;
  }

  // Validate required fields
  if (!reseller_id || !plan_id) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: reseller_id, plan_id'
    });
  }

  try {
    const result = await RazorpayService.createRazorpaySubscription(reseller_id, {
      plan_id,
      total_count: total_count || 1,
      customer: customer || null,
      notes: notes || null
    });

    res.status(201).json({
      success: true,
      message: 'Razorpay subscription created successfully',
      data: {
        subscription_id: result.subscription_id,
        subscription: result.subscription
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to create Razorpay subscription'
    });
  }
});

/**
 * @desc    Create Razorpay plan and subscription
 * @route   POST /api/razorpay/plan-and-subscription
 * @access  Private
 */
export const createPlanAndSubscription = asyncHandler(async (req, res) => {
  let { 
    reseller_id, 
    plan_name, 
    amount, 
    currency, 
    duration_days, 
    description,
    total_count,
    customer,
    notes
  } = req.body;

  // FAANG-grade security: Ensure resellers can only create combined plans/subscriptions for themselves,
  // and automatically inject their ID if missing from the request body.
  if (req.user && req.user.role === 'reseller') {
    reseller_id = req.user.userId;
  }

  // Validate required fields
  if (!reseller_id || !plan_name || !amount || !duration_days) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: reseller_id, plan_name, amount, duration_days'
    });
  }

  // Validate amount
  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Amount must be a positive number'
    });
  }

  // Validate duration_days
  const durationDaysNum = parseInt(duration_days);
  if (isNaN(durationDaysNum) || durationDaysNum <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Duration days must be a positive number'
    });
  }

  console.log(`[createPlanAndSubscription] Received request for reseller_id=${reseller_id}`);
  console.log(`[createPlanAndSubscription] Payload:`, { plan_name, amountNum, durationDaysNum });

  try {
    console.log(`[createPlanAndSubscription] Calling RazorpayService.createRazorpayPlanAndSubscription...`);
    const result = await RazorpayService.createRazorpayPlanAndSubscription(
      reseller_id,
      {
        plan_name,
        amount: amountNum,
        currency: currency || 'INR',
        duration_days: durationDaysNum,
        description: description || null
      },
      {
        total_count: total_count || 1,
        customer: customer || null,
        notes: notes || null
      }
    );

    res.status(201).json({
      success: true,
      message: 'Razorpay plan and subscription created successfully',
      data: {
        plan_id: result.plan_id,
        subscription_id: result.subscription_id,
        plan: result.plan,
        subscription: result.subscription
      }
    });
  } catch (error) {
    console.error(`[createPlanAndSubscription] Controller Error caught:`, error);
    console.error(`[createPlanAndSubscription] Controller Error message:`, error.message);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to create Razorpay plan and subscription'
    });
  }
});
