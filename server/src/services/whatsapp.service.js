import axios from 'axios';
import { getHasuraClient } from '../config/hasura.client.js';

/**
 * Get first active admin's WhatsApp config or return defaults
 */
const getWhatsAppConfig = async () => {
  try {
    const client = getHasuraClient();
    
    // Try to get first active admin's WhatsApp config
    const query = `
      query GetAdminWhatsAppConfig {
        mst_whatsapp_config(
          where: { 
            admin_id: { _is_null: false },
            is_active: { _eq: true }
          }
          limit: 1
          order_by: { created_at: desc }
        ) {
          api_key
          api_url
          phone_number_id
          business_account_id
        }
      }
    `;
    
    const result = await client.client.request(query);
    
    if (result.mst_whatsapp_config && result.mst_whatsapp_config.length > 0) {
      const config = result.mst_whatsapp_config[0];
      return config;
    }
  } catch (error) {
    console.warn('Error fetching WhatsApp config from database:', error);
    if (error.response) {
      console.warn('GraphQL error details:', JSON.stringify(error.response, null, 2));
    } else if (error.errors) {
      console.warn('GraphQL errors:', JSON.stringify(error.errors, null, 2));
    }
  }
  
  // Return defaults
  return {
    api_key: 'EAF2SJcngo8cBOz4JOCCgR2kd5TLX0D1w8ippQ5YNAnmpo2KciESJpoNbYQf5An0HfoKZABmw67keWe3sCk5E5Oeva0Er6WTMKzFCpOeDd29byGMFZCHjVQ8PmAFa7lbRuDAKoaZBuxNDBhCtzOV2SjUdqTjSyzl8bUZALZAZCVnpEXJhRhZBrtzyKKopZCWl4ZCE7oxaqy5ez2kZCicltr',
    api_url: 'https://graph.facebook.com/v18.0',
    phone_number_id: '917662874757468',
  };
};

/**
 * Format phone number for WhatsApp (remove + and ensure country code)
 */
const formatPhoneNumber = (phone) => {
  if (!phone) return null;
  const cleaned = phone.replace(/\D/g, ''); // Remove all non-digits
  if (cleaned.startsWith('91')) {
    return cleaned;
  }
  return `91${cleaned}`;
};

/**
 * Send WhatsApp message using template
 */
export const sendWhatsAppTemplateMessage = async (phone, templateName, languageCode = 'en', components = []) => {
  try {
    if (!phone) {
      return {
        success: false,
        message: 'Phone number is required',
      };
    }

    // Get WhatsApp config from admin settings or use defaults
    const whatsappConfig = await getWhatsAppConfig();

    // Format phone number
    const formattedPhone = formatPhoneNumber(phone);
    if (!formattedPhone) {
      return {
        success: false,
        message: 'Invalid phone number format',
      };
    }

    // Use WhatsApp Cloud API
    const apiUrl = `${whatsappConfig.api_url}/${whatsappConfig.phone_number_id}/messages`;
    const accessToken = whatsappConfig.api_key;

    const payload = {
      messaging_product: 'whatsapp',
      to: formattedPhone,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: languageCode,
        },
        components: components,
      },
    };

    const response = await axios.post(apiUrl, payload, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('WhatsApp message sent:', response.data);

    return {
      success: true,
      message: 'WhatsApp message sent successfully',
      data: response.data,
    };
  } catch (error) {
    // WhatsApp API error structure: error.response.data.error
    const errorData = error.response?.data?.error || error.response?.data;
    const errorCode = errorData?.code;
    const errorType = errorData?.type;
    const errorDetails = errorData?.error_data?.details || errorData?.message || error.message || 'Failed to send WhatsApp message';
    
    // Check if it's a template not found error (code 132001 with OAuthException type)
    // Error structure from WhatsApp API:
    // {
    //   type: 'OAuthException',
    //   code: 132001,
    //   error_data: {
    //     messaging_product: 'whatsapp',
    //     details: 'template name (reseller_approval) does not exist in en'
    //   }
    // }
    const isTemplateNotFound = 
      (errorType === 'OAuthException' && errorCode === 132001) ||
      (errorCode === 132001) ||
      (typeof errorDetails === 'string' && errorDetails.includes('template name') && errorDetails.includes('does not exist'));
    
    if (isTemplateNotFound) {
      // Don't log as error - this is expected if template is not created
      // Return silently without logging to prevent error spam in logs
      return {
        success: false,
        message: `WhatsApp template "${templateName}" not found. Please create it in Meta Business Manager.`,
        templateNotFound: true,
      };
    }
    
    // Only log as error if it's not a template not found issue
    console.error('Error sending WhatsApp message:', error.response?.data || error.message);
    return {
      success: false,
      message: errorDetails,
    };
  }
};

/**
 * Send a free-form text message via WhatsApp Cloud API.
 *
 * IMPORTANT: WhatsApp only allows free-form (non-template) messages within the
 * 24-hour customer-service window — i.e. the recipient must have messaged your
 * business number first within the last 24 hours.  For business-initiated
 * messages outside that window a pre-approved template is required.
 *
 * This function is used as a *fallback* when the template is not yet configured,
 * so that the reseller still receives the notification in most real-world cases
 * (they just signed up and likely interacted with the number during OTP flows).
 */
export const sendWhatsAppTextMessage = async (phone, messageText) => {
  try {
    if (!phone || !messageText) {
      return { success: false, message: 'Phone and message text are required' };
    }

    const whatsappConfig = await getWhatsAppConfig();
    const formattedPhone = formatPhoneNumber(phone);
    if (!formattedPhone) {
      return { success: false, message: 'Invalid phone number format' };
    }

    const apiUrl = `${whatsappConfig.api_url}/${whatsappConfig.phone_number_id}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      to: formattedPhone,
      type: 'text',
      text: { body: messageText },
    };

    const response = await axios.post(apiUrl, payload, {
      headers: {
        Authorization: `Bearer ${whatsappConfig.api_key}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('[WhatsApp] Text message sent to', formattedPhone, response.data);
    return { success: true, message: 'WhatsApp text message sent successfully', data: response.data };
  } catch (error) {
    const errorData = error.response?.data?.error || error.response?.data;
    const errorDetails = errorData?.error_data?.details || errorData?.message || error.message || 'Failed to send WhatsApp text message';
    console.error('[WhatsApp] Error sending text message:', errorDetails);
    return { success: false, message: errorDetails };
  }
};

/**
 * Build the approval message body.
 * Extracted so both the template-path and the text-fallback path use identical copy.
 */
const _buildApprovalMessageText = (resellerName, companyName, walletBalance, validityDate) => {
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
  const displayName = companyName || resellerName;

  let msg = `🎉 *Congratulations ${resellerName}!*\n\n`;
  msg += `Your reseller company *${displayName}* has been *successfully approved* on our platform.\n\n`;
  msg += `You can now:\n`;
  msg += `✅ Login to your dashboard\n`;
  msg += `✅ Manage customers and virtual numbers\n`;
  msg += `✅ Access all reseller features\n\n`;

  if (walletBalance && Number(walletBalance) > 0) {
    msg += `💰 *Initial Wallet Balance:* ₹${Number(walletBalance).toLocaleString('en-IN')}\n\n`;
  }

  if (validityDate) {
    const expiryDate = new Date(validityDate).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    msg += `📅 *Account Valid Until:* ${expiryDate}\n\n`;
  }

  msg += `🔗 *Login here:* ${FRONTEND_URL}/sign-in\n\n`;
  msg += `Thank you for choosing Virtual Number! We look forward to growing together. 🚀`;
  return msg;
};

/**
 * Send reseller approval WhatsApp notification.
 *
 * Strategy (two-layer, non-blocking):
 *  1. Try the pre-approved WhatsApp template "reseller_approval" — works for all
 *     business-initiated messages regardless of the 24-hour window.
 *  2. If the template is not yet configured in Meta Business Manager, fall back to
 *     a free-form text message — works within the 24-hour customer-service window
 *     (which is almost always open right after signup / OTP flows).
 *
 * Neither failure blocks the approval itself.
 *
 * @param {string}  phone         - Reseller's WhatsApp number (raw, with or without country code)
 * @param {string}  resellerName  - Reseller's full name (used in greeting)
 * @param {string}  [companyName] - Reseller's business / company name (featured in message)
 * @param {number}  [walletBalance]
 * @param {string}  [validityDate]
 */
export const sendResellerApprovalWhatsApp = async (
  phone,
  resellerName,
  companyName = null,
  walletBalance = null,
  validityDate = null,
) => {
  if (!phone) {
    return { success: false, message: 'Phone number is required' };
  }

  const TEMPLATE_NAME = 'reseller_approval';
  const messageText = _buildApprovalMessageText(resellerName, companyName, walletBalance, validityDate);

  // ── Layer 1: WhatsApp template (works outside 24-hour window) ─────────────
  const templateComponents = [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: resellerName },
        { type: 'text', text: companyName || resellerName },
        { type: 'text', text: walletBalance ? `₹${Number(walletBalance).toLocaleString('en-IN')}` : '₹0' },
        { type: 'text', text: validityDate ? new Date(validityDate).toLocaleDateString('en-IN') : 'N/A' },
      ],
    },
  ];

  try {
    const templateResult = await sendWhatsAppTemplateMessage(phone, TEMPLATE_NAME, 'en', templateComponents);

    if (templateResult.success) {
      console.log(`[WhatsApp] Approval template sent to ${phone} for reseller "${companyName || resellerName}"`);
      return templateResult;
    }

    if (!templateResult.templateNotFound) {
      // Template exists but send failed for another reason — log and fall through to text fallback
      console.warn(`[WhatsApp] Template send failed (non-template error): ${templateResult.message}`);
    }
  } catch (templateError) {
    console.warn('[WhatsApp] Template send threw unexpectedly:', templateError.message);
  }

  // ── Layer 2: Free-form text fallback (works within 24-hour window) ────────
  console.log(`[WhatsApp] Template "${TEMPLATE_NAME}" not configured — falling back to text message for ${phone}`);

  try {
    const textResult = await sendWhatsAppTextMessage(phone, messageText);
    if (textResult.success) {
      return {
        ...textResult,
        fallback: true,
        note: `Template "${TEMPLATE_NAME}" not found; free-form text message sent instead. Create the template in Meta Business Manager for guaranteed delivery outside the 24-hour window.`,
      };
    }

    // Both paths failed — return a soft success so approval is never blocked
    console.warn(`[WhatsApp] Both template and text fallback failed for ${phone}. Approval proceeds regardless.`);
    return {
      success: true,
      templateNotConfigured: true,
      message: 'WhatsApp notification could not be delivered (template not configured, text fallback also failed). Approval was not affected.',
      note: `Create a WhatsApp template named "${TEMPLATE_NAME}" in Meta Business Manager with body variables: {{1}} name, {{2}} company, {{3}} wallet balance, {{4}} validity date.`,
    };
  } catch (textError) {
    console.warn('[WhatsApp] Text fallback threw:', textError.message);
    return {
      success: true,
      templateNotConfigured: true,
      message: 'WhatsApp notification skipped (delivery error). Approval was not affected.',
    };
  }
};

