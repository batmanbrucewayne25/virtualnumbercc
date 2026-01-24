import { VirtualNumbersService } from '../services/virtualNumbers.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * @desc    Get available virtual numbers
 * @route   GET /virtualnumbers/available
 * @access  Private (API Key)
 */
export const getAvailableNumbers = asyncHandler(async (req, res) => {
  const result = await VirtualNumbersService.getAvailableNumbers();

  if (result.success) {
    const message = result.data.length > 0 
      ? 'Available numbers fetched successfully'
      : 'No available numbers found';

    res.status(200).json({
      status: 200,
      message: message,
      data: result.data
    });
  } else {
    res.status(result.status || 500).json({
      status: result.status || 500,
      message: result.message || 'Failed to fetch available numbers'
    });
  }
});

/**
 * @desc    Activate a virtual number
 * @route   POST /virtualnumbers/activate
 * @access  Private (API Key)
 */
export const activateNumber = asyncHandler(async (req, res) => {
  const { number } = req.body;
  const resellerId = req.resellerId; // From API key middleware

  if (!number) {
    return res.status(400).json({
      status: 400,
      message: 'number is required'
    });
  }

  if (!resellerId) {
    return res.status(400).json({
      status: 400,
      message: 'Reseller ID not found. Please check your API key configuration.'
    });
  }

  const result = await VirtualNumbersService.activateNumber(number, resellerId);

  if (result.success) {
    res.status(200).json({
      status: 200,
      message: `Number activated successfully. Amount deducted: ${result.data.amount_deducted}`,
      data: result.data
    });
  } else {
    res.status(result.status || 500).json({
      status: result.status || 500,
      message: result.message || 'Failed to activate number'
    });
  }
});

/**
 * @desc    Configure call forwarding
 * @route   POST /virtualnumbers/call-forward
 * @access  Private (API Key)
 */
export const configureCallForwarding = asyncHandler(async (req, res) => {
  const { number, forward_type, forward_value } = req.body;
  const resellerId = req.resellerId;

  if (!number || !forward_type || !forward_value) {
    return res.status(400).json({
      status: 400,
      message: 'number, forward_type, and forward_value are required'
    });
  }

  if (!resellerId) {
    return res.status(400).json({
      status: 400,
      message: 'Reseller ID not found. Please check your API key configuration.'
    });
  }

  const result = await VirtualNumbersService.configureCallForwarding(
    number,
    forward_type,
    forward_value,
    resellerId
  );

  if (result.success) {
    res.status(200).json({
      status: 200,
      message: 'Call forwarding configured successfully',
      data: result.data
    });
  } else {
    res.status(result.status || 500).json({
      status: result.status || 500,
      message: result.message || 'Failed to configure call forwarding'
    });
  }
});

/**
 * @desc    Update call forwarding
 * @route   PUT /virtualnumbers/call-forward
 * @access  Private (API Key)
 */
export const updateCallForwarding = asyncHandler(async (req, res) => {
  const { number, forward_type, forward_value } = req.body;
  const resellerId = req.resellerId;

  if (!number || !forward_type || !forward_value) {
    return res.status(400).json({
      status: 400,
      message: 'number, forward_type, and forward_value are required'
    });
  }

  if (!resellerId) {
    return res.status(400).json({
      status: 400,
      message: 'Reseller ID not found. Please check your API key configuration.'
    });
  }

  const result = await VirtualNumbersService.configureCallForwarding(
    number,
    forward_type,
    forward_value,
    resellerId
  );

  if (result.success) {
    res.status(200).json({
      status: 200,
      message: 'Call forwarding updated successfully',
      data: result.data
    });
  } else {
    res.status(result.status || 500).json({
      status: result.status || 500,
      message: result.message || 'Failed to update call forwarding'
    });
  }
});

/**
 * @desc    Get number details
 * @route   GET /virtualnumbers/details/:number
 * @access  Private (API Key)
 */
export const getNumberDetails = asyncHandler(async (req, res) => {
  const { number } = req.params;
  const resellerId = req.resellerId;

  if (!number) {
    return res.status(400).json({
      status: 400,
      message: 'number parameter is required'
    });
  }

  // Decode URL-encoded number
  const decodedNumber = decodeURIComponent(number);

  if (!resellerId) {
    return res.status(400).json({
      status: 400,
      message: 'Reseller ID not found. Please check your API key configuration.'
    });
  }

  const result = await VirtualNumbersService.getNumberDetails(decodedNumber, resellerId);

  if (result.success) {
    res.status(200).json({
      status: 200,
      message: 'Number details fetched successfully',
      data: result.data
    });
  } else {
    res.status(result.status || 500).json({
      status: result.status || 500,
      message: result.message || 'Failed to fetch number details'
    });
  }
});

/**
 * @desc    Suspend a number
 * @route   POST /virtualnumbers/suspend
 * @access  Private (API Key)
 */
export const suspendNumber = asyncHandler(async (req, res) => {
  const { number } = req.body;
  const resellerId = req.resellerId;

  if (!number) {
    return res.status(400).json({
      status: 400,
      message: 'number is required'
    });
  }

  if (!resellerId) {
    return res.status(400).json({
      status: 400,
      message: 'Reseller ID not found. Please check your API key configuration.'
    });
  }

  const result = await VirtualNumbersService.suspendNumber(number, resellerId);

  if (result.success) {
    res.status(200).json({
      status: 200,
      message: 'Number suspended successfully',
      data: result.data
    });
  } else {
    res.status(result.status || 500).json({
      status: result.status || 500,
      message: result.message || 'Failed to suspend number'
    });
  }
});

/**
 * @desc    Reactivate a number
 * @route   POST /virtualnumbers/reactivate
 * @access  Private (API Key)
 */
export const reactivateNumber = asyncHandler(async (req, res) => {
  const { number } = req.body;
  const resellerId = req.resellerId;

  if (!number) {
    return res.status(400).json({
      status: 400,
      message: 'number is required'
    });
  }

  if (!resellerId) {
    return res.status(400).json({
      status: 400,
      message: 'Reseller ID not found. Please check your API key configuration.'
    });
  }

  const result = await VirtualNumbersService.reactivateNumber(number, resellerId);

  if (result.success) {
    res.status(200).json({
      status: 200,
      message: `Number reactivated successfully. Amount deducted: ${result.data.amount_deducted}`,
      data: result.data
    });
  } else {
    res.status(result.status || 500).json({
      status: result.status || 500,
      message: result.message || 'Failed to reactivate number'
    });
  }
});

