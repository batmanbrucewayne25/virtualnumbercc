import { getHasuraClient } from '../config/hasura.client.js';
import { getAdminSmtpConfig } from './smtpConfig.service.js';
import nodemailer from 'nodemailer';
import axios from 'axios';

// SMTP configuration from environment variables
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
const SMTP_FROM_EMAIL = process.env.SMTP_FROM_EMAIL || SMTP_USER;
const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || 'Virtual Number';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * Create email transporter
 */
const createTransporter = (smtpConfig = null) => {
  const host = smtpConfig?.host || SMTP_HOST;
  const port = smtpConfig?.port || SMTP_PORT;
  const username = smtpConfig?.username || SMTP_USER;
  const password = smtpConfig?.password || SMTP_PASSWORD;
  
  if (!username || !password) {
    console.warn('SMTP credentials not configured. Email sending will be disabled.');
    return null;
  }

  const isGmail = host.includes('gmail.com');
  
  if (isGmail) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user: username, pass: password },
    });
  }
  
  return nodemailer.createTransport({
    host: host,
    port: port,
    secure: port === 465,
    auth: { user: username, pass: password },
  });
};

/**
 * Get first active admin's SMTP config or return null (will use env variables)
 */
const getFirstAdminSmtpConfig = async () => {
  try {
    const client = getHasuraClient();
    
    // Try to get first active admin's SMTP config
    const query = `
      query GetFirstAdminSmtpConfig {
        mst_smtp_config(
          where: { 
            admin_id: { _is_null: false },
            is_active: { _eq: true }
          }
          limit: 1
          order_by: { created_at: desc }
        ) {
          id
          admin_id
          host
          port
          username
          password
          from_email
          from_name
          is_active
        }
      }
    `;
    
    const result = await client.client.request(query);
    
    if (result.mst_smtp_config && result.mst_smtp_config.length > 0) {
      return result.mst_smtp_config[0];
    }
  } catch (error) {
    console.warn('Error fetching SMTP config from database:', error);
  }
  
  return null; // Will fall back to env variables
};

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
      // Add template_name if not present (use default)
      if (!config.template_name) {
        config.template_name = 'botbeeotp';
      }
      return config;
    }
  } catch (error) {
    console.warn('Error fetching WhatsApp config from database:', error);
    // Log the error details for debugging
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
    template_name: 'botbeeotp',
  };
};

/**
 * OTP Service
 * Handles OTP generation, storage, and verification
 */
export class OTPService {
  /**
   * Generate a random 6-digit OTP
   */
  static generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Get reseller ID from email or phone
   */
  static async getResellerId(email, phone) {
    try {
      const client = getHasuraClient();
      let query;
      let variables;

      if (email) {
        query = `
          query GetResellerByEmail($email: String!) {
            mst_reseller(where: { email: { _eq: $email } }, limit: 1) {
              id
            }
          }
        `;
        variables = { email };
      } else if (phone) {
        query = `
          query GetResellerByPhone($phone: String!) {
            mst_reseller(where: { phone: { _eq: $phone } }, limit: 1) {
              id
            }
          }
        `;
        variables = { phone };
      } else {
        return null;
      }

      const result = await client.client.request(query, variables);
      if (result.mst_reseller && result.mst_reseller.length > 0) {
        return result.mst_reseller[0].id;
      }
      return null;
    } catch (error) {
      console.error('Error getting reseller ID:', error);
      return null;
    }
  }

  /**
   * Store OTP in database with expiration (5 minutes)
   */
  static async storeOTP(email, phone, otp, type, userType = 'reseller') {
    try {
      const client = getHasuraClient();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
      const contactInfo = email || phone;

      // Get user_id (reseller ID) from email or phone
      const userId = await this.getResellerId(email, phone);

      const mutation = `
        mutation StoreOTP(
          $user_id: uuid
          $user_type: String!
          $otp_type: String!
          $otp_code: String!
          $contact_info: String!
          $expires_at: timestamp!
        ) {
          insert_mst_otp_verification_one(object: {
            user_id: $user_id
            user_type: $user_type
            otp_type: $otp_type
            otp_code: $otp_code
            contact_info: $contact_info
            expires_at: $expires_at
            is_verified: false
            attempts: 0
          }) {
            id
            user_id
            user_type
            otp_type
            otp_code
            contact_info
            expires_at
            created_at
          }
        }
      `;

      const result = await client.client.request(mutation, {
        user_id: userId,
        user_type: userType,
        otp_type: type, // 'email' or 'phone'
        otp_code: otp,
        contact_info: contactInfo,
        expires_at: expiresAt.toISOString(),
      });

      return {
        success: true,
        data: result.insert_mst_otp_verification_one,
      };
    } catch (error) {
      console.error('Error storing OTP:', error);
      return {
        success: false,
        message: error.message || 'Failed to store OTP',
      };
    }
  }

  /**
   * Verify OTP
   */
  static async verifyOTP(email, phone, otp, type, userType = 'reseller') {
    try {
      const client = getHasuraClient();
      const contactInfo = email || phone;

      // First, try to find unverified OTP
      const query = `
        query VerifyOTP($contact_info: String!, $otp_code: String!, $otp_type: String!, $user_type: String!) {
          mst_otp_verification(
            where: {
              contact_info: { _eq: $contact_info }
              otp_code: { _eq: $otp_code }
              otp_type: { _eq: $otp_type }
              user_type: { _eq: $user_type }
              is_verified: { _eq: false }
              expires_at: { _gte: "now()" }
            }
            order_by: { created_at: desc }
            limit: 1
          ) {
            id
            user_id
            user_type
            otp_type
            otp_code
            contact_info
            expires_at
            attempts
            created_at
          }
        }
      `;

      const result = await client.client.request(query, {
        contact_info: contactInfo,
        otp_code: otp,
        otp_type: type,
        user_type: userType,
      });

      if (result.mst_otp_verification && result.mst_otp_verification.length > 0) {
        const otpRecord = result.mst_otp_verification[0];
        
        // Mark OTP as verified and set verified_at timestamp
        const updateMutation = `
          mutation MarkOTPVerified($id: uuid!) {
            update_mst_otp_verification_by_pk(
              pk_columns: { id: $id }
              _set: {
                is_verified: true
                verified_at: "now()"
              }
            ) {
              id
              is_verified
              verified_at
            }
          }
        `;

        await client.client.request(updateMutation, {
          id: otpRecord.id,
        });

        return {
          success: true,
          message: 'OTP verified successfully',
        };
      }

      // If OTP not found, increment attempts for the most recent unverified OTP
      const failedQuery = `
        query GetFailedOTP($contact_info: String!, $otp_type: String!, $user_type: String!) {
          mst_otp_verification(
            where: {
              contact_info: { _eq: $contact_info }
              otp_type: { _eq: $otp_type }
              user_type: { _eq: $user_type }
              is_verified: { _eq: false }
              expires_at: { _gte: "now()" }
            }
            order_by: { created_at: desc }
            limit: 1
          ) {
            id
            attempts
          }
        }
      `;

      const failedResult = await client.client.request(failedQuery, {
        contact_info: contactInfo,
        otp_type: type,
        user_type: userType,
      });

      if (failedResult.mst_otp_verification && failedResult.mst_otp_verification.length > 0) {
        const failedRecord = failedResult.mst_otp_verification[0];
        const newAttempts = (failedRecord.attempts || 0) + 1;

        const incrementMutation = `
          mutation IncrementOTPAttempts($id: uuid!, $attempts: Int!) {
            update_mst_otp_verification_by_pk(
              pk_columns: { id: $id }
              _set: { attempts: $attempts }
            ) {
              id
              attempts
            }
          }
        `;

        await client.client.request(incrementMutation, {
          id: failedRecord.id,
          attempts: newAttempts,
        });
      }

      return {
        success: false,
        message: 'Invalid or expired OTP',
      };
    } catch (error) {
      console.error('Error verifying OTP:', error);
      return {
        success: false,
        message: error.message || 'Failed to verify OTP',
      };
    }
  }

  /**
   * Send email OTP
   */
  static async sendEmailOTP(email) {
    try {
      const otp = this.generateOTP();

      // Store OTP
      const storeResult = await this.storeOTP(email, null, otp, 'email');
      if (!storeResult.success) {
        return storeResult;
      }

      // Get SMTP config (from database or env)
      // Try to get first active admin's SMTP config, otherwise will use env variables
      const smtpConfig = await getFirstAdminSmtpConfig();
      const transporter = createTransporter(smtpConfig);

      if (!transporter) {
        return {
          success: false,
          message: 'Email service not configured. Please contact administrator.',
        };
      }

      // Send email
      const fromName = smtpConfig?.from_name || SMTP_FROM_NAME || 'Virtual Number';
      const fromEmail = smtpConfig?.from_email || SMTP_FROM_EMAIL || smtpConfig?.username || SMTP_USER;
      
      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject: 'Email Verification OTP',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Email Verification</h2>
            <p>Your OTP for email verification is:</p>
            <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
              ${otp}
            </div>
            <p>This OTP will expire in 5 minutes.</p>
            <p style="color: #666; font-size: 12px;">If you didn't request this OTP, please ignore this email.</p>
          </div>
        `,
        text: `Your OTP for email verification is: ${otp}. This OTP will expire in 5 minutes.`,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('Email OTP sent:', info.messageId);

      return {
        success: true,
        message: 'OTP sent to email successfully',
      };
    } catch (error) {
      console.error('Error sending email OTP:', error);
      return {
        success: false,
        message: error.message || 'Failed to send email OTP',
      };
    }
  }

  /**
   * Send WhatsApp OTP
   */
  static async sendWhatsAppOTP(phone) {
    try {
      const otp = this.generateOTP();

      // Store OTP
      const storeResult = await this.storeOTP(null, phone, otp, 'phone');
      if (!storeResult.success) {
        return storeResult;
      }

      // Get WhatsApp config from admin settings or use defaults
      const whatsappConfig = await getWhatsAppConfig();

      // Format phone number (remove + and ensure country code)
      const formattedPhone = phone.startsWith('+') ? phone.substring(1) : phone.startsWith('91') ? phone : `91${phone}`;

      // Use WhatsApp Cloud API
      const apiUrl = `${whatsappConfig.api_url}/${whatsappConfig.phone_number_id}/messages`;
      const accessToken = whatsappConfig.api_key;

      // Build template payload
      // The template 'botbeeotp' appears to have a URL button that requires a parameter
      // WhatsApp button parameters have a max length of 15 characters
      const components = [
        {
          type: 'body',
          parameters: [
            {
              type: 'text',
              text: otp,
            },
          ],
        },
        // Add button component if template has buttons
        // For URL buttons, the parameter must be max 15 characters
        // This is typically a short code or ID, not the full URL
        // The full URL is configured in the template in Meta Business Manager
        {
          type: 'button',
          sub_type: 'url',
          index: 0,
          parameters: [
            {
              type: 'text',
              text: 'verify', // Short parameter (max 15 chars) - update this to match your template's expected parameter
            },
          ],
        },
      ];

      const payload = {
        messaging_product: 'whatsapp',
        to: formattedPhone,
        type: 'template',
        template: {
          name: whatsappConfig.template_name || 'botbeeotp',
          language: {
            code: 'en',
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

      console.log('WhatsApp OTP sent:', response.data);

      return {
        success: true,
        message: 'OTP sent to WhatsApp successfully',
        data: response.data,
      };
    } catch (error) {
      console.error('Error sending WhatsApp OTP:', error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.error?.message || error.message || 'Failed to send WhatsApp OTP',
      };
    }
  }
}

