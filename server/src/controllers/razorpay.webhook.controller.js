import { asyncHandler } from '../utils/asyncHandler.js';
import * as WebhookService from '../services/razorpay.webhook.service.js';

/**
 * @desc    Handle Razorpay webhook events from reseller accounts
 * @route   POST /api/razorpay/webhook/:resellerId
 * @access  Public (verified via signature)
 */
export const handleWebhook = asyncHandler(async (req, res) => {
  const { resellerId } = req.params;

  // Validate reseller ID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!resellerId || !uuidRegex.test(resellerId)) {
    console.error('Invalid reseller ID in webhook URL:', resellerId);
    return res.status(400).json({
      success: false,
      message: 'Invalid reseller ID'
    });
  }

  // Get raw body for signature verification
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  const signature = req.headers['x-razorpay-signature'];

  // Get reseller's Razorpay config for webhook secret
  const config = await WebhookService.getResellerRazorpayConfig(resellerId);
  
  if (!config) {
    console.error('Razorpay config not found for reseller:', resellerId);
    // Still process the webhook but log the warning
    console.warn('Processing webhook without reseller config verification');
  }

  // Verify webhook signature (if webhook secret is configured)
  if (config?.webhook_secret) {
    const isValid = WebhookService.verifyWebhookSignature(
      rawBody,
      signature,
      config.webhook_secret
    );

    if (!isValid) {
      console.error('Webhook signature verification failed for reseller:', resellerId);
      return res.status(401).json({
        success: false,
        message: 'Invalid webhook signature'
      });
    }
  }

  // Parse the webhook payload
  let payload;
  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (error) {
    console.error('Failed to parse webhook payload:', error);
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON payload'
    });
  }

  const event = payload.event;
  
  console.log(`Received Razorpay webhook event: ${event} for reseller: ${resellerId}`);
  console.log('Webhook payload:', JSON.stringify(payload, null, 2));

  let result;

  try {
    switch (event) {
      case 'payment.authorized':
        result = await WebhookService.processPaymentAuthorized(resellerId, payload);
        break;

      case 'payment.captured':
        result = await WebhookService.processPaymentCaptured(resellerId, payload);
        break;

      case 'payment.failed':
        result = await WebhookService.processPaymentFailed(resellerId, payload);
        break;

      case 'refund.created':
      case 'refund.processed':
        result = await WebhookService.processRefundCreated(resellerId, payload);
        break;

      case 'order.paid':
        result = await WebhookService.processOrderPaid(resellerId, payload);
        break;

      case 'subscription.charged':
        result = await WebhookService.processSubscriptionCharged(resellerId, payload);
        break;

      case 'subscription.completed':
      case 'subscription.halted':
      case 'subscription.cancelled':
        // Log subscription status changes but don't create new transactions
        console.log(`Subscription event ${event} received for reseller ${resellerId}`);
        result = { success: true, message: `Subscription event ${event} logged` };
        break;

      default:
        // Log unknown events but acknowledge receipt
        console.log(`Unknown webhook event ${event} received for reseller ${resellerId}`);
        result = { success: true, message: `Event ${event} acknowledged` };
    }

    if (result.success) {
      console.log(`Webhook processed successfully: ${event} for reseller ${resellerId}`);
      return res.status(200).json({
        success: true,
        message: `Webhook processed: ${event}`,
        data: result.data
      });
    } else {
      console.error(`Webhook processing failed: ${result.message}`);
      // Still return 200 to prevent Razorpay retries for business logic errors
      return res.status(200).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
    // Return 200 to prevent Razorpay retries
    return res.status(200).json({
      success: false,
      message: 'Webhook received but processing failed'
    });
  }
});

/**
 * @desc    Get all transactions for super admin dashboard
 * @route   GET /api/razorpay/transactions
 * @access  Private (Super Admin only)
 */
export const getAllTransactions = asyncHandler(async (req, res) => {
  const { limit, offset, status, reseller_id, start_date, end_date } = req.query;

  // Helper to clean query params - filter out undefined, empty strings, and literal "undefined"
  const cleanParam = (val) => (val && val !== '' && val !== 'undefined') ? val : undefined;

  try {
    const result = await WebhookService.getAllTransactions({
      limit: limit ? parseInt(limit) : 100,
      offset: offset ? parseInt(offset) : 0,
      status: cleanParam(status),
      resellerId: cleanParam(reseller_id),
      startDate: cleanParam(start_date),
      endDate: cleanParam(end_date)
    });

    if (result.success) {
      return res.json({
        success: true,
        data: result.data
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch transactions'
    });
  }
});

/**
 * @desc    Get transaction statistics for super admin dashboard
 * @route   GET /api/razorpay/transactions/stats
 * @access  Private (Super Admin only)
 */
export const getTransactionStats = asyncHandler(async (req, res) => {
  try {
    const result = await WebhookService.getTransactionStats();

    if (result.success) {
      return res.json({
        success: true,
        data: result.data
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch transaction statistics'
    });
  }
});

/**
 * @desc    Get webhook URL for a reseller
 * @route   GET /api/razorpay/webhook-url/:resellerId
 * @access  Private (Reseller or Super Admin)
 */
export const getWebhookUrl = asyncHandler(async (req, res) => {
  const { resellerId } = req.params;

  // Validate reseller ID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!resellerId || !uuidRegex.test(resellerId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid reseller ID'
    });
  }

  const baseUrl = process.env.API_BASE_URL || `${req.protocol}://${req.get('host')}`;
  const webhookUrl = WebhookService.generateWebhookUrl(resellerId, baseUrl);

  return res.json({
    success: true,
    data: {
      webhook_url: webhookUrl,
      reseller_id: resellerId,
      instructions: [
        '1. Log in to your Razorpay Dashboard',
        '2. Go to Settings → Webhooks',
        '3. Click "Add New Webhook"',
        '4. Paste the webhook URL above',
        '5. Select events: payment.captured, payment.failed, payment.authorized, refund.created',
        '6. Copy the webhook secret and save it in your configuration',
        '7. Click "Create Webhook"'
      ]
    }
  });
});

/**
 * @desc    Save reseller Razorpay configuration
 * @route   POST /api/razorpay/config
 * @access  Private (Reseller only)
 */
export const saveResellerConfig = asyncHandler(async (req, res) => {
  const { reseller_id, key_id, key_secret, webhook_secret } = req.body;

  // Validate reseller ID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!reseller_id || !uuidRegex.test(reseller_id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid reseller ID'
    });
  }

  const { getHasuraClient } = await import('../config/hasura.client.js');
  const client = getHasuraClient();

  try {
    // Check if config exists
    const checkQuery = `
      query CheckRazorpayConfig($reseller_id: uuid!) {
        mst_razorpay_config(where: { reseller_id: { _eq: $reseller_id } }, limit: 1) {
          id
        }
      }
    `;

    const existingConfig = await client.client.request(checkQuery, { reseller_id });

    let mutation;
    let variables;

    if (existingConfig.mst_razorpay_config && existingConfig.mst_razorpay_config.length > 0) {
      // Update existing config
      mutation = `
        mutation UpdateRazorpayConfig(
          $id: uuid!
          $key_id: String
          $key_secret: String
          $webhook_secret: String
        ) {
          update_mst_razorpay_config_by_pk(
            pk_columns: { id: $id }
            _set: {
              key_id: $key_id
              key_secret: $key_secret
              webhook_secret: $webhook_secret
              is_active: true
            }
          ) {
            id
            reseller_id
            key_id
            is_active
          }
        }
      `;

      variables = {
        id: existingConfig.mst_razorpay_config[0].id,
        key_id: key_id || null,
        key_secret: key_secret || null,
        webhook_secret: webhook_secret || null
      };
    } else {
      // Create new config
      mutation = `
        mutation InsertRazorpayConfig(
          $reseller_id: uuid!
          $key_id: String
          $key_secret: String
          $webhook_secret: String
        ) {
          insert_mst_razorpay_config_one(object: {
            reseller_id: $reseller_id
            key_id: $key_id
            key_secret: $key_secret
            webhook_secret: $webhook_secret
            is_active: true
          }) {
            id
            reseller_id
            key_id
            is_active
          }
        }
      `;

      variables = {
        reseller_id,
        key_id: key_id || null,
        key_secret: key_secret || null,
        webhook_secret: webhook_secret || null
      };
    }

    const result = await client.client.request(mutation, variables);
    const data = result.update_mst_razorpay_config_by_pk || result.insert_mst_razorpay_config_one;

    // Generate webhook URL
    const baseUrl = process.env.API_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const webhookUrl = WebhookService.generateWebhookUrl(reseller_id, baseUrl);

    return res.json({
      success: true,
      message: 'Razorpay configuration saved successfully',
      data: {
        ...data,
        webhook_url: webhookUrl
      }
    });
  } catch (error) {
    console.error('Error saving Razorpay config:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to save Razorpay configuration'
    });
  }
});

/**
 * @desc    Get reseller Razorpay configuration
 * @route   GET /api/razorpay/config/:resellerId
 * @access  Private (Reseller or Super Admin)
 */
export const getResellerConfig = asyncHandler(async (req, res) => {
  const { resellerId } = req.params;

  // Validate reseller ID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!resellerId || !uuidRegex.test(resellerId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid reseller ID'
    });
  }

  try {
    const config = await WebhookService.getResellerRazorpayConfig(resellerId);

    // Generate webhook URL
    const baseUrl = process.env.API_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const webhookUrl = WebhookService.generateWebhookUrl(resellerId, baseUrl);

    return res.json({
      success: true,
      data: {
        ...config,
        webhook_url: webhookUrl,
        // Mask sensitive data
        key_secret: config?.key_secret ? '********' : null
      }
    });
  } catch (error) {
    console.error('Error fetching Razorpay config:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch Razorpay configuration'
    });
  }
});
