import express from 'express';
import {
  sendEmailOTP,
  verifyEmailOTP,
  sendPhoneOTP,
  verifyPhoneOTP,
} from '../controllers/otp.controller.js';

const router = express.Router();

/**
 * @route   POST /api/otp/send-email
 * @desc    Send email OTP
 * @access  Public
 */
router.post('/send-email', sendEmailOTP);

/**
 * @route   POST /api/otp/verify-email
 * @desc    Verify email OTP
 * @access  Public
 */
router.post('/verify-email', verifyEmailOTP);

/**
 * @route   POST /api/otp/send-phone
 * @desc    Send WhatsApp OTP
 * @access  Public
 */
router.post('/send-phone', sendPhoneOTP);

/**
 * @route   POST /api/otp/verify-phone
 * @desc    Verify phone OTP
 * @access  Public
 */
router.post('/verify-phone', verifyPhoneOTP);

export default router;

