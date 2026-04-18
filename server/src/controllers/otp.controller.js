import { OTPService } from '../services/otp.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const RESELLER_UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** @param {unknown} raw */
function parseResellerId(raw) {
  if (raw == null || raw === '') return null;
  const s = typeof raw === 'string' ? raw.trim() : String(raw).trim();
  if (!s || !RESELLER_UUID_REGEX.test(s)) return null;
  return s;
}

/** @param {unknown} raw */
function parseOptionalNamePart(raw) {
  if (raw == null) return undefined;
  const s = typeof raw === 'string' ? raw.trim() : String(raw).trim();
  return s === '' ? undefined : s;
}

/**
 * @desc    Send email OTP
 * @route   POST /api/otp/send-email
 * @access  Public
 */
export const sendEmailOTP = asyncHandler(async (req, res) => {
  const {
    email,
    user_type: userType,
    reseller_id: resellerIdRaw,
    first_name: firstNameRaw,
    last_name: lastNameRaw,
  } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Email is required',
    });
  }

  const resellerId = parseResellerId(resellerIdRaw);
  const fn = parseOptionalNamePart(firstNameRaw);
  const ln = parseOptionalNamePart(lastNameRaw);
  /** @type {{ first_name?: string; last_name?: string } | undefined} */
  let nameHints;
  if (fn || ln) {
    nameHints = {};
    if (fn) nameHints.first_name = fn;
    if (ln) nameHints.last_name = ln;
  }
  const result = await OTPService.sendEmailOTP(
    email,
    userType,
    resellerId,
    nameHints,
  );

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
  const { email, otp, user_type: userType } = req.body;

  if (!email || !otp) {
    return res.status(400).json({
      success: false,
      message: 'Email and OTP are required',
    });
  }

  const result = await OTPService.verifyOTP(
    email,
    null,
    otp,
    'email',
    userType || 'reseller'
  );

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
  const { phone, user_type: userType, reseller_id: resellerIdRaw } = req.body;

  if (!phone) {
    return res.status(400).json({
      success: false,
      message: 'Phone number is required',
    });
  }

  const resellerId = parseResellerId(resellerIdRaw);
  const result = await OTPService.sendWhatsAppOTP(phone, userType, resellerId);

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
  const { phone, otp, user_type: userType } = req.body;

  if (!phone || !otp) {
    return res.status(400).json({
      success: false,
      message: 'Phone number and OTP are required',
    });
  }

  const result = await OTPService.verifyOTP(
    null,
    phone,
    otp,
    'phone',
    userType || 'reseller'
  );

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
 * @desc    Send same OTP to email and WhatsApp (spec: both mandatory)
 * @route   POST /api/otp/send-dual
 * @access  Public
 */
export const sendDualChannelOTP = asyncHandler(async (req, res) => {
  const {
    email,
    phone,
    user_type: userType,
    reseller_id: resellerIdRaw,
    first_name: firstNameRaw,
    last_name: lastNameRaw,
  } = req.body;

  if (!email || !phone) {
    return res.status(400).json({
      success: false,
      message: 'Email and phone are required',
    });
  }

  const resellerId = parseResellerId(resellerIdRaw);
  const fnDual = parseOptionalNamePart(firstNameRaw);
  const lnDual = parseOptionalNamePart(lastNameRaw);
  /** @type {{ first_name?: string; last_name?: string } | undefined} */
  let nameHintsDual;
  if (fnDual || lnDual) {
    nameHintsDual = {};
    if (fnDual) nameHintsDual.first_name = fnDual;
    if (lnDual) nameHintsDual.last_name = lnDual;
  }
  const result = await OTPService.sendDualChannelOtp(
    email,
    phone,
    userType || 'reseller',
    resellerId,
    nameHintsDual,
  );

  if (result.success) {
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } else {
    res.status(400).json({
      success: false,
      message: result.message,
      details: {
        email: result.email,
        whatsapp: result.whatsapp,
      },
    });
  }
});

