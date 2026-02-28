import { CustomerService } from '../services/customer.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

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

  // Get reseller_id from authenticated user
  // The auth middleware sets req.user with userId, email, and role
  const resellerId = req.user?.userId;

  // Verify user is a reseller (not admin)
  if (!resellerId) {
    return res.status(401).json({
      success: false,
      message: 'Unable to determine reseller ID. Please log in again.'
    });
  }

  if (req.user?.role !== 'reseller') {
    return res.status(403).json({
      success: false,
      message: 'Only resellers can approve customers.'
    });
  }

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
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to approve customer'
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
