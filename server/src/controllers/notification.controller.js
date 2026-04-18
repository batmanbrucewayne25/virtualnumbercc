import { asyncHandler } from '../utils/asyncHandler.js';
import { sendResellerApprovalEmail } from '../../services/emailService.js';
import { sendResellerApprovalWhatsApp } from '../services/whatsapp.service.js';
import {
  sendAdminAccountDeactivatedEmail,
  sendAdminKycRejectedEmail,
  sendWalletCreditApprovedEmail,
  sendResellerAccountSuspendedEmail,
} from '../services/transactionalEmail.service.js';
import { getHasuraClient } from '../config/hasura.client.js';

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
 * @desc    Send wallet credit approved email to reseller
 * @route   POST /api/notifications/wallet-credit-approved
 * @access  Private (Admin only)
 */
export const sendWalletCreditApprovedNotification = asyncHandler(
  async (req, res) => {
    const { resellerId, amount, dateStr } = req.body || {};

    if (!resellerId) {
      return res.status(400).json({ success: false, message: 'resellerId is required' });
    }
    if (amount == null || isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'A positive amount is required' });
    }

    let email;
    let userName;
    try {
      const client = getHasuraClient();
      const d = await client.client.request(
        `query R($id: uuid!) {
          mst_reseller_by_pk(id: $id) {
            email
            first_name
            last_name
            brand_name
            business_name
          }
        }`,
        { id: resellerId },
      );
      const r = d?.mst_reseller_by_pk;
      if (!r?.email) {
        return res.status(422).json({ success: false, message: 'Reseller email not found' });
      }
      email = r.email;
      userName =
        `${r.first_name || ''} ${r.last_name || ''}`.trim() ||
        r.brand_name ||
        r.business_name ||
        r.email;
    } catch {
      return res.status(500).json({ success: false, message: 'Failed to fetch reseller details' });
    }

    const amountNum = Number(amount);
    const date = dateStr || new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    let result;
    try {
      result = await sendWalletCreditApprovedEmail(email, userName, amountNum, date);
    } catch (err) {
      result = { success: false, message: err.message };
    }

    const ok = result?.success === true;
    return res.status(ok ? 200 : 502).json({
      success: ok,
      message: ok ? 'Wallet credit email sent to reseller' : result?.message || 'Failed to send email',
    });
  },
);

/**
 * @desc    Email reseller when admin suspends the account (Suspend action)
 * @route   POST /api/notifications/reseller-suspended
 * @access  Private (Admin only)
 */
export const sendResellerAccountSuspendedNotification = asyncHandler(
  async (req, res) => {
    const { email, resellerName, suspensionReason } = req.body || {};

    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    if (
      !suspensionReason ||
      typeof suspensionReason !== 'string' ||
      !suspensionReason.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: 'Suspension reason is required',
      });
    }

    const displayName =
      typeof resellerName === 'string' && resellerName.trim()
        ? resellerName.trim()
        : email.trim();

    let emailResult;
    try {
      emailResult = await sendResellerAccountSuspendedEmail(
        email.trim(),
        displayName,
        suspensionReason.trim(),
      );
    } catch (error) {
      console.error('Error sending reseller account suspended email:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to send email',
      });
    }

    const success = emailResult?.success === true;
    return res.status(success ? 200 : 502).json({
      success,
      message: success
        ? 'Suspension notification sent'
        : emailResult?.message || 'Failed to send suspension notification',
    });
  },
);

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

