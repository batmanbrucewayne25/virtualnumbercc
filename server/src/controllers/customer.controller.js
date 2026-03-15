import { CustomerService } from '../services/customer.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * @desc    Send renewal payment email for a virtual number (online payment link)
 * @route   POST /api/customer/send-renewal-payment-email
 * @access  Protected (Admin or Reseller)
 */
export const sendRenewalPaymentEmail = asyncHandler(async (req, res) => {
  const { virtual_number_id, subscription_plan_id } = req.body;

  if (!virtual_number_id) {
    return res.status(400).json({
      success: false,
      message: 'Please provide virtual_number_id'
    });
  }

  if (!subscription_plan_id) {
    return res.status(400).json({
      success: false,
      message: 'Please select a subscription plan for renewal'
    });
  }

  const role = req.user?.role;
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Please log in again.'
    });
  }

  const isReseller = role === 'reseller';
  const isAdmin = role === 'admin' || role === 'super_admin';
  if (!isReseller && !isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Only resellers or admins can send renewal payment links.'
    });
  }

  const resellerId = isReseller ? userId : null;

  try {
    const result = await CustomerService.sendRenewalPaymentEmail(
      virtual_number_id,
      subscription_plan_id,
      resellerId
    );

    return res.json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    console.error('Error sending renewal payment email:', error);
    const msg = error.message || 'Failed to send renewal payment email';
    const isWalletError =
      msg.startsWith('Insufficient wallet balance') ||
      msg.includes('wallet not found') ||
      msg.includes('price_per_number');
    return res.status(isWalletError ? 400 : 500).json({
      success: false,
      message: msg
    });
  }
});

/**
 * @desc    Approve customer with payment processing
 * @route   POST /api/customer/approve
 */
export const approveCustomer = asyncHandler(async (req, res) => {
  const {
    customer_id,
    payment_method,
    subscription_plan_id,
    payment_reference_number,
    payment_amount,
    payment_date,
  } = req.body;

  // Validate required fields
  if (!customer_id || !payment_method) {
    return res.status(400).json({
      success: false,
      message: 'Please provide customer_id and payment_method'
    });
  }

  // Validate payment method specific fields
  if (payment_method === 'offline') {
    if (!payment_reference_number || !payment_amount || !payment_date) {
      return res.status(400).json({
        success: false,
        message: 'For offline payment, please provide payment_reference_number, payment_amount, and payment_date'
      });
    }
  } else if (payment_method === 'online') {
    if (!subscription_plan_id) {
      return res.status(400).json({
        success: false,
        message: 'For online payment, please provide subscription_plan_id'
      });
    }
  } else {
    return res.status(400).json({
      success: false,
      message: 'Invalid payment_method. Must be "offline" or "online"'
    });
  }

  // Require authenticated user (reseller or admin)
  const userId = req.user?.userId;
  const role = req.user?.role;
  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Please log in again.'
    });
  }

  const isReseller = role === 'reseller';
  const isAdmin = role === 'admin' || role === 'super_admin';
  if (!isReseller && !isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Only resellers or admins can approve customers.'
    });
  }

  // Reseller: use their ID; Admin: service will use customer's reseller_id from loaded customer
  const resellerId = isReseller ? userId : null;

  try {
    const result = await CustomerService.approveCustomer({
      customer_id,
      payment_method,
      subscription_plan_id,
      payment_reference_number,
      payment_amount,
      payment_date,
      reseller_id: resellerId,
    });

    res.json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    console.error('Error approving customer:', error);
    const msg = error.message || 'Failed to approve customer';
    const isWalletError =
      msg.startsWith('Insufficient wallet balance') || msg === 'Wallet not found';
    res.status(isWalletError ? 400 : 500).json({
      success: false,
      message: msg
    });
  }
});

/**
 * @desc    Renew virtual number via offline payment (extend expiry, debit wallet, create transaction)
 * @route   POST /api/customer/renew-virtual-number-offline
 * @access  Protected (Admin or Reseller)
 */
export const renewVirtualNumberOffline = asyncHandler(async (req, res) => {
  const {
    virtual_number_id,
    subscription_plan_id,
    payment_amount,
    payment_reference_number,
    payment_date,
  } = req.body;

  if (!virtual_number_id) {
    return res.status(400).json({
      success: false,
      message: 'Please provide virtual_number_id',
    });
  }

  if (!subscription_plan_id) {
    return res.status(400).json({
      success: false,
      message: 'Please select a subscription plan for renewal',
    });
  }

  if (!payment_reference_number || !payment_amount || !payment_date) {
    return res.status(400).json({
      success: false,
      message: 'For offline renewal, please provide payment_reference_number, payment_amount, and payment_date',
    });
  }

  const amount = parseFloat(payment_amount);
  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Payment amount must be a valid positive number',
    });
  }

  const role = req.user?.role;
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Please log in again.',
    });
  }

  const isReseller = role === 'reseller';
  const isAdmin = role === 'admin' || role === 'super_admin';
  if (!isReseller && !isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Only resellers or admins can renew virtual numbers.',
    });
  }

  const resellerId = isReseller ? userId : null;

  try {
    const result = await CustomerService.renewVirtualNumberOffline(
      {
        virtual_number_id,
        subscription_plan_id,
        payment_amount,
        payment_reference_number,
        payment_date,
      },
      resellerId
    );

    return res.json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    console.error('Error renewing virtual number offline:', error);
    const msg = error.message || 'Failed to renew virtual number';
    const isWalletError =
      msg.startsWith('Insufficient wallet balance') ||
      msg.includes('wallet not found') ||
      msg.includes('price_per_number');
    return res.status(isWalletError ? 400 : 500).json({
      success: false,
      message: msg,
    });
  }
});

/**
 * @desc    Enable 24-hour grace period for a virtual number (admin only)
 * @route   POST /api/customer/enable-grace-period
 * @access  Protected (Admin only)
 */
export const enableGracePeriod = asyncHandler(async (req, res) => {
  const { virtual_number_id } = req.body;

  if (!virtual_number_id) {
    return res.status(400).json({
      success: false,
      message: 'Please provide virtual_number_id',
    });
  }

  const role = req.user?.role;
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Please log in again.',
    });
  }

  const isAdmin = role === 'admin' || role === 'super_admin';
  if (!isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Only admins can enable grace periods.',
    });
  }

  try {
    const result = await CustomerService.enableGracePeriod(virtual_number_id);
    return res.json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    console.error('Error enabling grace period:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to enable grace period.',
    });
  }
});

/**
 * @desc    Reject customer (update status and send rejection email via reseller SMTP)
 * @route   POST /api/customer/reject
 * @access  Protected (Admin or Reseller - reseller only for own customers)
 */
export const rejectCustomer = asyncHandler(async (req, res) => {
  const { customer_id, rejection_reason } = req.body;

  if (!customer_id) {
    return res.status(400).json({
      success: false,
      message: 'Please provide customer_id'
    });
  }

  const role = req.user?.role;
  const userId = req.user?.userId;
  if (!userId || !role) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized. Please log in again.'
    });
  }
  const isAdmin = role === 'admin' || role === 'super_admin';
  const isReseller = role === 'reseller';

  if (!isAdmin && !isReseller) {
    return res.status(403).json({
      success: false,
      message: 'Only admins or resellers can reject customers.'
    });
  }

  try {
    const customer = await CustomerService.getCustomerById(customer_id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }
    if (isReseller && customer.reseller_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only reject customers that belong to your account.'
      });
    }

    const result = await CustomerService.rejectCustomer(
      customer_id,
      rejection_reason || 'No reason provided.'
    );

    return res.json({
      success: true,
      message: result.message,
      data: {
        emailSent: result.emailSent,
        emailWarning: result.emailWarning || undefined
      }
    });
  } catch (error) {
    console.error('Error rejecting customer:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to reject customer'
    });
  }
});
