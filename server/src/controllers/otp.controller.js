import { OTPService } from '../services/otp.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * @desc    Send email OTP
 * @route   POST /api/otp/send-email
 * @access  Public
 */
export const sendEmailOTP = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Email is required',
    });
  }

  const result = await OTPService.sendEmailOTP(email);

  if (result.success) {
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } else {
    res.status(400).json({
      success: false,
      message: result.message,
    });
  }
});

/**
 * @desc    Verify email OTP
 * @route   POST /api/otp/verify-email
 * @access  Public
 */
export const verifyEmailOTP = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({
      success: false,
      message: 'Email and OTP are required',
    });
  }

  const result = await OTPService.verifyOTP(email, null, otp, 'email');

  if (result.success) {
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } else {
    res.status(400).json({
      success: false,
      message: result.message,
    });
  }
});

/**
 * @desc    Send WhatsApp OTP
 * @route   POST /api/otp/send-phone
 * @access  Public
 */
export const sendPhoneOTP = asyncHandler(async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({
      success: false,
      message: 'Phone number is required',
    });
  }

  const result = await OTPService.sendWhatsAppOTP(phone);

  if (result.success) {
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } else {
    res.status(400).json({
      success: false,
      message: result.message,
    });
  }
});

/**
 * @desc    Verify phone OTP
 * @route   POST /api/otp/verify-phone
 * @access  Public
 */
export const verifyPhoneOTP = asyncHandler(async (req, res) => {
  const { phone, otp } = req.body;

  if (!phone || !otp) {
    return res.status(400).json({
      success: false,
      message: 'Phone number and OTP are required',
    });
  }

  const result = await OTPService.verifyOTP(null, phone, otp, 'phone');

  if (result.success) {
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } else {
    res.status(400).json({
      success: false,
      message: result.message,
    });
  }
});

