import express from 'express';
import {
  generateAadhaarOTP,
  submitAadhaarOTP,
  verifyPAN,
  verifyGST,
  verifyGSTSpecial
} from '../controllers/kyc.controller.js';

const router = express.Router();

/**
 * @route   POST /api/kyc/aadhaar/generate-otp
 * @desc    Generate Aadhaar OTP
 * @access  Public
 */
router.post('/aadhaar/generate-otp', generateAadhaarOTP);

/**
 * @route   POST /api/kyc/aadhaar/submit-otp
 * @desc    Submit Aadhaar OTP
 * @access  Public
 */
router.post('/aadhaar/submit-otp', submitAadhaarOTP);

/**
 * @route   POST /api/kyc/pan/verify
 * @desc    Verify PAN
 * @access  Public
 */
router.post('/pan/verify', verifyPAN);

/**
 * @route   POST /api/kyc/gst/verify
 * @desc    Verify GST (Normal)
 * @access  Public
 */
router.post('/gst/verify', verifyGST);

/**
 * @route   POST /api/kyc/gst/verify-sp
 * @desc    Verify GST (Special)
 * @access  Public
 */
router.post('/gst/verify-sp', verifyGSTSpecial);

export default router;

