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

