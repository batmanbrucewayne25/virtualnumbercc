import { asyncHandler } from '../utils/asyncHandler.js';
import { sendResellerApprovalEmail } from '../../services/emailService.js';
import { sendResellerApprovalWhatsApp } from '../services/whatsapp.service.js';
import {
  sendAdminAccountDeactivatedEmail,
  sendAdminKycRejectedEmail,
} from '../services/transactionalEmail.service.js';

/**
 * @desc    Send reseller approval notifications (email and WhatsApp)
 * @route   POST /api/notifications/reseller-approval
 * @access  Private (Admin only)
 */
export const sendResellerApprovalNotifications = asyncHandler(async (req, res) => {
  const { email, phone, resellerName, companyName, walletBalance, validityDate } = req.body;

  if (!email && !phone) {
    return res.status(400).json({
      success: false,
      message: 'Email or phone number is required',
    });
  }

  if (!resellerName) {
    return res.status(400).json({
      success: false,
      message: 'Reseller name is required',
    });
  }

  const results = {
    email: null,
    whatsapp: null,
  };

  // Send email notification
  if (email) {
    try {
      const emailResult = await sendResellerApprovalEmail(
        email,
        resellerName,
        walletBalance || null,
        validityDate || null
      );
      results.email = emailResult;
    } catch (error) {
      console.error('Error sending approval email:', error);
      results.email = {
        success: false,
        message: error.message || 'Failed to send email',
      };
    }
  }

  // Send WhatsApp notification (two-layer: template → free-form text fallback)
  if (phone) {
    try {
      const whatsappResult = await sendResellerApprovalWhatsApp(
        phone,
        resellerName,
        companyName || null,
        walletBalance || null,
        validityDate || null,
      );
      results.whatsapp = whatsappResult;
    } catch (error) {
      console.error('Error sending approval WhatsApp:', error);
      results.whatsapp = {
        success: false,
        message: error.message || 'Failed to send WhatsApp message',
      };
    }
  }

  // Consider it successful if email succeeded and WhatsApp either succeeded or template is not configured
  const whatsappSuccess = !phone || results.whatsapp?.success || results.whatsapp?.templateNotConfigured;
  const allSuccess = (!email || results.email?.success) && whatsappSuccess;

  res.status(allSuccess ? 200 : 207).json({
    success: allSuccess,
    message: allSuccess
      ? 'Notifications sent successfully'
      : 'Some notifications failed to send',
    results,
  });
});

/**
 * @desc    Send reseller KYC rejection email (ADMIN_KYC_REJECTED template; admin SMTP)
 * @route   POST /api/notifications/reseller-rejection
 * @access  Private (Admin / Super Admin)
 */
export const sendResellerRejectionNotifications = asyncHandler(async (req, res) => {
  const { email, resellerName, rejectionReason } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Email is required',
    });
  }

  if (
    !rejectionReason ||
    typeof rejectionReason !== 'string' ||
    rejectionReason.trim() === ''
  ) {
    return res.status(400).json({
      success: false,
      message: 'Rejection reason is required',
    });
  }

  const results = { email: null };

  try {
    const emailResult = await sendAdminKycRejectedEmail(
      email,
      resellerName || email,
      rejectionReason.trim(),
    );
    results.email = emailResult;
  } catch (error) {
    console.error('Error sending rejection email:', error);
    results.email = {
      success: false,
      message: error.message || 'Failed to send email',
    };
  }

  const success = results.email?.success === true;
  res.status(success ? 200 : 207).json({
    success,
    message: success ? 'Rejection notification sent' : 'Failed to send rejection notification',
    results,
  });
});

/**
 * @desc    Send account deactivated email when admin deactivates a reseller (status toggle)
 * @route   POST /api/notifications/reseller-account-deactivated
 * @access  Private (Admin only)
 */
export const sendResellerAccountDeactivatedNotification = asyncHandler(
  async (req, res) => {
    const { email, resellerName } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    const displayName =
      typeof resellerName === 'string' && resellerName.trim()
        ? resellerName.trim()
        : email;

    const results = { email: null };

    try {
      const emailResult = await sendAdminAccountDeactivatedEmail(
        email,
        displayName,
      );
      results.email = emailResult;
    } catch (error) {
      console.error('Error sending reseller account deactivated email:', error);
      results.email = {
        success: false,
        message: error.message || 'Failed to send email',
      };
    }

    const success = results.email?.success === true;
    res.status(success ? 200 : 207).json({
      success,
      message: success
        ? 'Account deactivated notification sent'
        : 'Failed to send account deactivated notification',
      results,
    });
  },
);

