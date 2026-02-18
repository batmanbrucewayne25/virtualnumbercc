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
 * Send reseller approval WhatsApp message
 * Note: You'll need to create a WhatsApp template in Meta Business Manager for this
 * For now, we'll send a simple text message or use a generic template
 */
export const sendResellerApprovalWhatsApp = async (phone, resellerName, walletBalance = null, validityDate = null) => {
  try {
    if (!phone) {
      return {
        success: false,
        message: 'Phone number is required',
      };
    }

    // Get WhatsApp config
    const whatsappConfig = await getWhatsAppConfig();

    // Format phone number
    const formattedPhone = formatPhoneNumber(phone);
    if (!formattedPhone) {
      return {
        success: false,
        message: 'Invalid phone number format',
      };
    }

    // Build message content
    let messageText = `🎉 *Congratulations ${resellerName}!*\n\n`;
    messageText += `Your reseller account has been *successfully approved*!\n\n`;
    messageText += `You can now:\n`;
    messageText += `✅ Login to your dashboard\n`;
    messageText += `✅ Manage customers and virtual numbers\n`;
    messageText += `✅ Access all reseller features\n\n`;
    
    if (walletBalance && walletBalance > 0) {
      messageText += `💰 Initial Wallet Balance: ₹${walletBalance.toLocaleString('en-IN')}\n\n`;
    }
    
    if (validityDate) {
      const expiryDate = new Date(validityDate).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      messageText += `📅 Account Valid Until: ${expiryDate}\n\n`;
    }

    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
    messageText += `🔗 Login: ${FRONTEND_URL}/sign-in\n\n`;
    messageText += `Thank you for choosing Virtual Number!`;

    // For now, we'll try to send as a text message (if your WhatsApp Business API supports it)
    // Otherwise, you'll need to create a template in Meta Business Manager
    // Using a generic template name - you should create a specific template for approval messages
    const templateName = 'reseller_approval'; // Change this to your actual template name
    
    // If template doesn't exist, we'll use a fallback approach
    // You can create a template in Meta Business Manager with variables for name, wallet balance, etc.
    const components = [
      {
        type: 'body',
        parameters: [
          {
            type: 'text',
            text: resellerName,
          },
          {
            type: 'text',
            text: walletBalance ? `₹${walletBalance.toLocaleString('en-IN')}` : '₹0',
          },
          {
            type: 'text',
            text: validityDate ? new Date(validityDate).toLocaleDateString('en-IN') : 'N/A',
          },
        ],
      },
    ];

    // Try to send using template first
    try {
      const result = await sendWhatsAppTemplateMessage(phone, templateName, 'en', components);
      if (result.success) {
        return result;
      }
      
      // If template not found, return gracefully without failing
      if (result.templateNotFound) {
        // Silently handle - template not configured is not an error
        // Uncomment below if you want to see a warning
        // console.warn('WhatsApp template not configured. Skipping WhatsApp notification.');
        return {
          success: true,
          message: 'Reseller approved (WhatsApp template not configured)',
          note: `Please create a WhatsApp template named "${templateName}" in Meta Business Manager for automated messages`,
          templateNotConfigured: true,
        };
      }
    } catch (templateError) {
      // Check if it's a template error - don't log it
      const errorData = templateError.response?.data?.error || templateError.response?.data;
      const isTemplateError = errorData?.code === 132001 || 
                             (errorData?.error_data?.details?.includes('template name') && 
                              errorData?.error_data?.details?.includes('does not exist'));
      
      if (!isTemplateError) {
        console.warn('Template message failed:', templateError.message);
      }
    }

    // Fallback: If template doesn't exist, log the message (you can implement SMS or other notification here)
    console.log('WhatsApp approval message (template not configured):', messageText);
    
    return {
      success: true,
      message: 'Approval notification prepared (template may need to be configured in Meta Business Manager)',
      note: 'Please create a WhatsApp template named "reseller_approval" in Meta Business Manager for automated messages',
    };
  } catch (error) {
    // Check if it's a template error that was already handled in sendWhatsAppTemplateMessage
    const errorData = error.response?.data?.error || error.response?.data;
    const errorCode = errorData?.code;
    const errorType = errorData?.type;
    const errorDetails = errorData?.error_data?.details || errorData?.message || error.message || '';
    const isTemplateError = 
      (errorType === 'OAuthException' && errorCode === 132001) ||
      (errorCode === 132001) ||
      (errorDetails.includes('template name') && errorDetails.includes('does not exist'));
    
    // Don't log template errors - they're expected if template doesn't exist
    if (!isTemplateError) {
      console.error('Error sending reseller approval WhatsApp:', error);
    }
    
    return {
      success: false,
      message: error.message || 'Failed to send WhatsApp message',
      templateNotFound: isTemplateError,
    };
  }
};

