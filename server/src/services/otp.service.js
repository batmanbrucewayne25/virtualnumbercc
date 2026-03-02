import { getHasuraClient } from "../config/hasura.client.js";
import {
  getAdminSmtpConfig,
  getFirstAdminSmtpConfig,
} from "./smtpConfig.service.js";
import nodemailer from "nodemailer";
import axios from "axios";

// SMTP configuration from environment variables
const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587");
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
const SMTP_FROM_EMAIL = process.env.SMTP_FROM_EMAIL || SMTP_USER;
const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || "Virtual Number";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

/**
 * Validate SMTP configuration
 */
const validateSmtpConfig = (smtpConfig = null) => {
  const host = smtpConfig?.host || SMTP_HOST;
  const port = smtpConfig?.port || SMTP_PORT;
  const username = smtpConfig?.username || SMTP_USER;
  const password = smtpConfig?.password || SMTP_PASSWORD;

  const errors = [];

  if (!username) {
    errors.push("SMTP username is missing");
  }

  if (!password) {
    errors.push("SMTP password is missing");
  }

  if (!host) {
    errors.push("SMTP host is missing");
  }

  if (!port || isNaN(port) || port < 1 || port > 65535) {
    errors.push(`SMTP port is invalid: ${port}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    config: { host, port, username, password },
  };
};

/**
 * Create email transporter with comprehensive error handling
 */
const createTransporter = (smtpConfig = null) => {
  try {
    const validation = validateSmtpConfig(smtpConfig);

    if (!validation.isValid) {
      console.error(
        "[SMTP] Configuration validation failed:",
        validation.errors
      );
      return {
        transporter: null,
        error: `SMTP configuration invalid: ${validation.errors.join(", ")}`,
      };
    }

    const { host, port, username, password } = validation.config;
    const isGmail = host.includes("gmail.com");

    let transporter;

    if (isGmail) {
      // Gmail requires App Password, not regular password
      transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: username,
          pass: password,
        },
        // Add connection timeout and retry options
        connectionTimeout: 10000, // 10 seconds
        greetingTimeout: 10000,
        socketTimeout: 10000,
      });
    } else {
      transporter = nodemailer.createTransport({
        host: host,
        port: parseInt(port),
        secure: port === 465, // true for SSL, false for TLS
        auth: {
          user: username,
          pass: password,
        },
        // Add connection timeout and retry options
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
        // For non-Gmail providers, might need additional options
        tls: {
          rejectUnauthorized: false, // Set to true in production with valid certificates
        },
      });
    }

    console.log(`[SMTP] Transporter created successfully for ${host}:${port}`);

    return {
      transporter,
      error: null,
    };
  } catch (error) {
    console.error("[SMTP] Error creating transporter:", error.message);
    return {
      transporter: null,
      error: `Failed to create SMTP transporter: ${error.message}`,
    };
  }
};

/**
 * Verify SMTP connection
 */
const verifyTransporter = async (transporter) => {
  try {
    await transporter.verify();
    console.log("[SMTP] Connection verified successfully");
    return { success: true, message: "SMTP connection verified" };
  } catch (error) {
    console.error("[SMTP] Connection verification failed:", error.message);

    // Provide helpful error messages based on common issues
    let userMessage = "SMTP connection failed";
    if (error.code === "EAUTH") {
      userMessage =
        "SMTP authentication failed. Please check your username and password. For Gmail, ensure you are using an App Password.";
    } else if (error.code === "ETIMEDOUT" || error.code === "ECONNREFUSED") {
      userMessage = `SMTP server connection failed. Please check host (${
        error.hostname || "unknown"
      }) and port settings.`;
    } else if (error.code === "EENVELOPE") {
      userMessage = "Invalid email address format.";
    } else {
      userMessage = `SMTP error: ${error.message}`;
    }

    return {
      success: false,
      message: userMessage,
      error: error.message,
      code: error.code,
    };
  }
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
        config.template_name = "botbeeotp";
      }
      return config;
    }
  } catch (error) {
    console.warn("Error fetching WhatsApp config from database:", error);
    // Log the error details for debugging
    if (error.response) {
      console.warn(
        "GraphQL error details:",
        JSON.stringify(error.response, null, 2)
      );
    } else if (error.errors) {
      console.warn("GraphQL errors:", JSON.stringify(error.errors, null, 2));
    }
  }

  // Return defaults
  return {
    api_key:
      "EAF2SJcngo8cBOz4JOCCgR2kd5TLX0D1w8ippQ5YNAnmpo2KciESJpoNbYQf5An0HfoKZABmw67keWe3sCk5E5Oeva0Er6WTMKzFCpOeDd29byGMFZCHjVQ8PmAFa7lbRuDAKoaZBuxNDBhCtzOV2SjUdqTjSyzl8bUZALZAZCVnpEXJhRhZBrtzyKKopZCWl4ZCE7oxaqy5ez2kZCicltr",
    api_url: "https://graph.facebook.com/v18.0",
    phone_number_id: "917662874757468",
    template_name: "botbeeotp",
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
   * Get user ID (reseller or customer) from email or phone
   * Returns { id, user_type } or null if not found
   */
  static async getUserId(email, phone, userType = "reseller") {
    try {
      const client = getHasuraClient();

      // First, try to find reseller
      if (email) {
        const resellerQuery = `
          query GetResellerByEmail($email: String!) {
            mst_reseller(where: { email: { _eq: $email } }, limit: 1) {
              id
            }
          }
        `;
        const resellerResult = await client.client.request(resellerQuery, {
          email,
        });
        if (
          resellerResult.mst_reseller &&
          resellerResult.mst_reseller.length > 0
        ) {
          return {
            id: resellerResult.mst_reseller[0].id,
            user_type: "reseller",
          };
        }
      } else if (phone) {
        const resellerQuery = `
          query GetResellerByPhone($phone: String!) {
            mst_reseller(where: { phone: { _eq: $phone } }, limit: 1) {
              id
            }
          }
        `;
        const resellerResult = await client.client.request(resellerQuery, {
          phone,
        });
        if (
          resellerResult.mst_reseller &&
          resellerResult.mst_reseller.length > 0
        ) {
          return {
            id: resellerResult.mst_reseller[0].id,
            user_type: "reseller",
          };
        }
      }

      // If not found and userType is customer, try to find customer
      if (userType === "customer" || userType === "reseller") {
        if (email) {
          const customerQuery = `
            query GetCustomerByEmail($email: String!) {
              mst_customer(where: { email: { _eq: $email } }, limit: 1) {
                id
              }
            }
          `;
          const customerResult = await client.client.request(customerQuery, {
            email,
          });
          if (
            customerResult.mst_customer &&
            customerResult.mst_customer.length > 0
          ) {
            return {
              id: customerResult.mst_customer[0].id,
              user_type: "customer",
            };
          }
        } else if (phone) {
          const customerQuery = `
            query GetCustomerByPhone($phone: String!) {
              mst_customer(where: { phone: { _eq: $phone } }, limit: 1) {
                id
              }
            }
          `;
          const customerResult = await client.client.request(customerQuery, {
            phone,
          });
          if (
            customerResult.mst_customer &&
            customerResult.mst_customer.length > 0
          ) {
            return {
              id: customerResult.mst_customer[0].id,
              user_type: "customer",
            };
          }
        }
      }

      return null;
    } catch (error) {
      console.error("Error getting user ID:", error);
      return null;
    }
  }

  /**
   * Get reseller ID from email or phone (backward compatibility)
   * @deprecated Use getUserId instead
   */
  static async getResellerId(email, phone) {
    const result = await this.getUserId(email, phone, "reseller");
    return result ? result.id : null;
  }

  /**
   * Store OTP in database with expiration (5 minutes)
   */
  static async storeOTP(email, phone, otp, type, userType = "reseller") {
    try {
      const client = getHasuraClient();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
      const contactInfo = email || phone;

      // Get user_id (reseller or customer ID) from email or phone
      // user_id is now nullable, so we can store OTP even if user doesn't exist yet (during signup)
      const userInfo = await this.getUserId(email, phone, userType);

      const userId = userInfo?.id || null;
      const actualUserType = userInfo?.user_type || userType;

      // Build mutation - conditionally include user_id only if it exists
      // This supports both cases: when user exists and when user doesn't exist yet (signup flow)
      const mutation = userId
        ? `
          mutation StoreOTP(
            $user_id: uuid!
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
        `
        : `
          mutation StoreOTP(
            $user_type: String!
            $otp_type: String!
            $otp_code: String!
            $contact_info: String!
            $expires_at: timestamp!
          ) {
            insert_mst_otp_verification_one(object: {
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

      // Build variables
      const variables = {
        user_type: actualUserType,
        otp_type: type, // 'email' or 'phone'
        otp_code: otp,
        contact_info: contactInfo,
        expires_at: expiresAt.toISOString(),
      };

      // Only include user_id if it exists
      if (userId) {
        variables.user_id = userId;
      }

      const result = await client.client.request(mutation, variables);

      if (userId) {
        console.log(
          `[OTP] OTP stored successfully for ${actualUserType} ${userId}`
        );
      } else {
        console.log(
          `[OTP] OTP stored successfully for ${contactInfo} (user not yet created - signup flow)`
        );
      }

      return {
        success: true,
        data: result.insert_mst_otp_verification_one,
      };
    } catch (error) {
      console.error("Error storing OTP:", error);

      // Provide more detailed error information
      let errorMessage = "Failed to store OTP";
      if (error.response?.errors) {
        const graphqlErrors = error.response.errors;
        errorMessage = graphqlErrors.map((e) => e.message).join(", ");
        console.error(
          "GraphQL errors:",
          JSON.stringify(graphqlErrors, null, 2)
        );
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        message: errorMessage,
        error: error,
      };
    }
  }

  /**
   * Verify OTP
   */
  static async verifyOTP(email, phone, otp, type, userType = "reseller") {
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

      if (
        result.mst_otp_verification &&
        result.mst_otp_verification.length > 0
      ) {
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
          message: "OTP verified successfully",
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

      if (
        failedResult.mst_otp_verification &&
        failedResult.mst_otp_verification.length > 0
      ) {
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
        message: "Invalid or expired OTP",
      };
    } catch (error) {
      console.error("Error verifying OTP:", error);
      return {
        success: false,
        message: error.message || "Failed to verify OTP",
      };
    }
  }

  /**
   * Send email OTP with comprehensive error handling
   * @param {string} email - Email address
   * @param {string} [userType='reseller'] - 'customer' for clienthub onboarding, 'reseller' for reseller signup
   */
  static async sendEmailOTP(email, userType = "reseller") {
    try {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        return {
          success: false,
          message: "Invalid email address format",
        };
      }

      const otp = this.generateOTP();
      console.log(`[OTP] Generating OTP for email: ${email} (user_type: ${userType})`);

      // Store OTP
      const storeResult = await this.storeOTP(email, null, otp, "email", userType);
      if (!storeResult.success) {
        console.error("[OTP] Failed to store OTP:", storeResult.message);
        return storeResult;
      }

      console.log("[OTP] OTP stored successfully");

      // Get SMTP config (from database or env)
      // Try to get first active admin's SMTP config, otherwise will use env variables
      let smtpConfig = null;
      try {
        smtpConfig = await getFirstAdminSmtpConfig();
        if (smtpConfig) {
          console.log("[SMTP] Using database SMTP configuration");
        } else {
          console.log(
            "[SMTP] No database SMTP config found, using environment variables"
          );
        }
      } catch (error) {
        console.warn(
          "[SMTP] Error fetching database SMTP config, using environment variables:",
          error.message
        );
      }

      // Create transporter
      const transporterResult = createTransporter(smtpConfig);

      if (!transporterResult.transporter) {
        const errorMsg =
          transporterResult.error || "Email service not configured";
        console.error("[SMTP]", errorMsg);

        // Provide helpful guidance
        let userMessage = "Email service not configured. ";
        if (errorMsg.includes("username") || errorMsg.includes("password")) {
          userMessage +=
            "Please configure SMTP_USER and SMTP_PASSWORD in your .env file or set up SMTP configuration in the admin panel.";
        } else {
          userMessage += "Please contact administrator.";
        }

        return {
          success: false,
          message: userMessage,
          error: errorMsg,
        };
      }

      // Verify connection (optional but recommended)
      const verification = await verifyTransporter(
        transporterResult.transporter
      );
      if (!verification.success) {
        console.error(
          "[SMTP] Connection verification failed:",
          verification.message
        );
        return {
          success: false,
          message: verification.message,
          error: verification.error,
        };
      }

      // Prepare email content
      const fromName =
        smtpConfig?.from_name || SMTP_FROM_NAME || "Virtual Number";
      const fromEmail =
        smtpConfig?.from_email ||
        SMTP_FROM_EMAIL ||
        smtpConfig?.username ||
        SMTP_USER;

      if (!fromEmail) {
        return {
          success: false,
          message:
            "SMTP sender email not configured. Please set SMTP_FROM_EMAIL or SMTP_USER in environment variables.",
        };
      }

      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject: "Email Verification OTP",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333; margin-bottom: 20px;">Email Verification</h2>
            <p style="color: #666; font-size: 16px;">Your OTP for email verification is:</p>
            <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; border-radius: 8px;">
              ${otp}
            </div>
            <p style="color: #666; font-size: 14px;">This OTP will expire in 5 minutes.</p>
            <p style="color: #999; font-size: 12px; margin-top: 30px;">If you didn't request this OTP, please ignore this email.</p>
          </div>
        `,
        text: `Your OTP for email verification is: ${otp}. This OTP will expire in 5 minutes.`,
      };

      console.log(`[SMTP] Sending email to ${email} from ${fromEmail}`);

      const info = await transporterResult.transporter.sendMail(mailOptions);

      console.log("[SMTP] Email sent successfully:", {
        messageId: info.messageId,
        response: info.response,
        accepted: info.accepted,
        rejected: info.rejected,
      });

      return {
        success: true,
        message: "OTP sent to email successfully",
        messageId: info.messageId,
      };
    } catch (error) {
      console.error("[SMTP] Error sending email OTP:", {
        message: error.message,
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode,
        stack: error.stack,
      });

      // Provide user-friendly error messages
      let userMessage = "Failed to send email OTP";

      if (error.code === "EAUTH") {
        userMessage =
          "SMTP authentication failed. Please check your email credentials. For Gmail, ensure you are using an App Password.";
      } else if (error.code === "ETIMEDOUT" || error.code === "ECONNREFUSED") {
        userMessage =
          "SMTP server connection failed. Please check your SMTP host and port settings.";
      } else if (error.code === "EENVELOPE") {
        userMessage = "Invalid email address format.";
      } else if (error.responseCode === 550) {
        userMessage = "Email address not found or invalid.";
      } else if (error.responseCode === 553) {
        userMessage = "Email address format is invalid.";
      } else if (error.message) {
        userMessage = `Email sending failed: ${error.message}`;
      }

      return {
        success: false,
        message: userMessage,
        error: error.message,
        code: error.code,
      };
    }
  }

  /**
   * Send WhatsApp OTP
   * @param {string} phone - Phone number
   * @param {string} [userType='reseller'] - 'customer' for clienthub onboarding, 'reseller' for reseller signup
   */
  static async sendWhatsAppOTP(phone, userType = "reseller") {
    try {
      const otp = this.generateOTP();

      // Store OTP
      const storeResult = await this.storeOTP(null, phone, otp, "phone", userType);
      if (!storeResult.success) {
        return storeResult;
      }

      // Get WhatsApp config from admin settings or use defaults
      const whatsappConfig = await getWhatsAppConfig();

      // Format phone number (remove + and ensure country code)
      const formattedPhone = phone.startsWith("+")
        ? phone.substring(1)
        : phone.startsWith("91")
        ? phone
        : `91${phone}`;

      // Use WhatsApp Cloud API
      const apiUrl = `${whatsappConfig.api_url}/${whatsappConfig.phone_number_id}/messages`;
      const accessToken = whatsappConfig.api_key;

      // Build template payload
      // The template 'botbeeotp' appears to have a URL button that requires a parameter
      // WhatsApp button parameters have a max length of 15 characters
      const components = [
        {
          type: "body",
          parameters: [
            {
              type: "text",
              text: otp,
            },
          ],
        },
        // Add button component if template has buttons
        // For URL buttons, the parameter must be max 15 characters
        // This is typically a short code or ID, not the full URL
        // The full URL is configured in the template in Meta Business Manager
        {
          type: "button",
          sub_type: "url",
          index: 0,
          parameters: [
            {
              type: "text",
              text: "verify", // Short parameter (max 15 chars) - update this to match your template's expected parameter
            },
          ],
        },
      ];

      const payload = {
        messaging_product: "whatsapp",
        to: formattedPhone,
        type: "template",
        template: {
          name: whatsappConfig.template_name || "botbeeotp",
          language: {
            code: "en",
          },
          components: components,
        },
      };

      const response = await axios.post(apiUrl, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      console.log("WhatsApp OTP sent:", response.data);

      return {
        success: true,
        message: "OTP sent to WhatsApp successfully",
        data: response.data,
      };
    } catch (error) {
      console.error(
        "Error sending WhatsApp OTP:",
        error.response?.data || error.message
      );
      return {
        success: false,
        message:
          error.response?.data?.error?.message ||
          error.message ||
          "Failed to send WhatsApp OTP",
      };
    }
  }
}
