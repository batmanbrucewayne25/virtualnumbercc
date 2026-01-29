import { asyncHandler } from '../utils/asyncHandler.js';
import { sendResellerApprovalEmail } from '../../services/emailService.js';
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

  const allSuccess = (!email || results.email?.success) && (!phone || results.whatsapp?.success);

  res.status(allSuccess ? 200 : 207).json({
    success: allSuccess,
    message: allSuccess
      ? 'Notifications sent successfully'
      : 'Some notifications failed to send',
    results,
  });
});

