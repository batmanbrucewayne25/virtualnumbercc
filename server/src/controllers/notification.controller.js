import { asyncHandler } from '../utils/asyncHandler.js';
import {
  sendResellerApprovalEmail,
  sendResellerRejectionEmail,
} from '../../services/emailService.js';
import { sendResellerApprovalWhatsApp } from '../services/whatsapp.service.js';

/**
 * @desc    Send reseller approval notifications (email and WhatsApp)
 * @route   POST /api/notifications/reseller-approval
 * @access  Private (Admin only)
 */
export const sendResellerApprovalNotifications = asyncHandler(async (req, res) => {
  const { email, phone, resellerName, walletBalance, validityDate } = req.body;

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

  // Send WhatsApp notification
  if (phone) {
    try {
      const whatsappResult = await sendResellerApprovalWhatsApp(
        phone,
        resellerName,
        walletBalance || null,
        validityDate || null
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
 * @desc    Send reseller rejection notification (email with reason)
 * @route   POST /api/notifications/reseller-rejection
 * @access  Private (Admin only)
 */
export const sendResellerRejectionNotifications = asyncHandler(async (req, res) => {
  const { email, resellerName, rejectionReason } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Email is required',
    });
  }

  if (!rejectionReason || typeof rejectionReason !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Rejection reason is required',
    });
  }

  const results = { email: null };

  try {
    const emailResult = await sendResellerRejectionEmail(
      email,
      resellerName || email,
      rejectionReason
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

