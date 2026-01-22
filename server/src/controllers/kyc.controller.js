import { KYCService } from '../services/kyc.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * @desc    Generate Aadhaar OTP
 * @route   POST /api/kyc/aadhaar/generate-otp
 * @access  Public
 */
export const generateAadhaarOTP = asyncHandler(async (req, res) => {
  const { id_number } = req.body;

  if (!id_number) {
    return res.status(400).json({
      success: false,
      message: 'Aadhaar number (id_number) is required'
    });
  }

  try {
    const result = await KYCService.generateAadhaarOTP(id_number);
    res.status(200).json(result);
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to generate OTP',
      error: process.env.NODE_ENV === 'production' ? {} : error.error
    });
  }
});

/**
 * @desc    Submit Aadhaar OTP
 * @route   POST /api/kyc/aadhaar/submit-otp
 * @access  Public
 */
export const submitAadhaarOTP = asyncHandler(async (req, res) => {
  const { request_id, otp } = req.body;

  if (!request_id || !otp) {
    return res.status(400).json({
      success: false,
      message: 'request_id and otp are required'
    });
  }

  try {
    const result = await KYCService.submitAadhaarOTP(request_id, otp);
    res.status(200).json(result);
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to verify OTP',
      error: process.env.NODE_ENV === 'production' ? {} : error.error
    });
  }
});

/**
 * @desc    Verify PAN
 * @route   POST /api/kyc/pan/verify
 * @access  Public
 */
export const verifyPAN = asyncHandler(async (req, res) => {
  const { id_number, dob } = req.body;

  if (!id_number) {
    return res.status(400).json({
      success: false,
      message: 'PAN number (id_number) is required'
    });
  }

  try {
    const result = await KYCService.verifyPAN(id_number, dob);
    res.status(200).json(result);
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to verify PAN',
      error: process.env.NODE_ENV === 'production' ? {} : error.error
    });
  }
});

/**
 * @desc    Verify GST (Normal)
 * @route   POST /api/kyc/gst/verify
 * @access  Public
 */
export const verifyGST = asyncHandler(async (req, res) => {
  const { id_number, filing_status_get } = req.body;

  if (!id_number) {
    return res.status(400).json({
      success: false,
      message: 'GST number (id_number) is required'
    });
  }

  try {
    const result = await KYCService.verifyGST(id_number, filing_status_get !== false);
    res.status(200).json(result);
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to verify GST',
      error: process.env.NODE_ENV === 'production' ? {} : error.error
    });
  }
});

/**
 * @desc    Verify GST (Special)
 * @route   POST /api/kyc/gst/verify-sp
 * @access  Public
 */
export const verifyGSTSpecial = asyncHandler(async (req, res) => {
  const { id_number, filing_status_get } = req.body;

  if (!id_number) {
    return res.status(400).json({
      success: false,
      message: 'GST number (id_number) is required'
    });
  }

  try {
    const result = await KYCService.verifyGSTSpecial(id_number, filing_status_get !== false);
    res.status(200).json(result);
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to verify special GST',
      error: process.env.NODE_ENV === 'production' ? {} : error.error
    });
  }
});
