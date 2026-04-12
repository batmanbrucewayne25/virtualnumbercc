import { getHasuraClient } from "../config/hasura.client.js";
import {
  getFirstAdminSmtpConfig,
  getResellerSmtpConfig,
} from "./smtpConfig.service.js";
import { resolveWhatsAppConfigForOtp } from "./whatsappConfig.service.js";
import { resolveTransactionalEmail } from "./emailTemplateResolver.js";
import { TEMPLATE_TYPE } from "../../mailtemplate/emailTemplateRegistry.js";
import {
  fetchResellerBrandingForOtp,
  PLATFORM_NAME,
  PLATFORM_SUPPORT_EMAIL,
  PLATFORM_SUPPORT_NUMBER,
} from "./transactionalEmail.service.js";
import nodemailer from "nodemailer";
import axios from "axios";
import { assertOtpRateLimit } from "../utils/otpRateLimit.js";

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
      // Always use the caller-supplied userType so verify lookup matches correctly.
      // getUserId may resolve a different type (e.g. reseller when caller says customer).
      const actualUserType = userType;

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
      const now = new Date().toISOString();

      // Look up the most recent unverified, non-expired OTP for this contact
      // NOTE: We do NOT filter by user_type here because storeOTP may have resolved
      // a different user_type (e.g. stored as "reseller" when caller says "customer").
      // We match by contact_info + otp_code + otp_type only, then accept any user_type.
      const query = `
        query VerifyOTP($contact_info: String!, $otp_code: String!, $otp_type: String!, $now: timestamp!) {
          mst_otp_verification(
            where: {
              contact_info: { _eq: $contact_info }
              otp_code: { _eq: $otp_code }
              otp_type: { _eq: $otp_type }
              is_verified: { _eq: false }
              expires_at: { _gte: $now }
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
        now,
      });

      if (
        result.mst_otp_verification &&
        result.mst_otp_verification.length > 0
      ) {
        const otpRecord = result.mst_otp_verification[0];

        // Mark OTP as verified and set verified_at timestamp
        const updateMutation = `
          mutation MarkOTPVerified($id: uuid!, $verified_at: timestamp!) {
            update_mst_otp_verification_by_pk(
              pk_columns: { id: $id }
              _set: {
                is_verified: true
                verified_at: $verified_at
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
          verified_at: now,
        });

        return {
          success: true,
          message: "OTP verified successfully",
        };
      }

      // If OTP not found, increment attempts for the most recent unverified OTP
      const failedQuery = `
        query GetFailedOTP($contact_info: String!, $otp_type: String!, $now: timestamp!) {
          mst_otp_verification(
            where: {
              contact_info: { _eq: $contact_info }
              otp_type: { _eq: $otp_type }
              is_verified: { _eq: false }
              expires_at: { _gte: $now }
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
        now,
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
   * Deliver email OTP (SMTP send only; OTP must already be stored).
   */
  static async _deliverEmailOtp(email, otp, userType = "reseller", resellerId = null) {
    try {
      let smtpConfig = null;
      try {
        if (userType === "customer" && resellerId) {
          smtpConfig = await getResellerSmtpConfig(resellerId);
          if (smtpConfig) {
            console.log("[SMTP] Using reseller SMTP for customer OTP");
          }
        }
        if (!smtpConfig) {
          smtpConfig = await getFirstAdminSmtpConfig();
          if (smtpConfig) {
            console.log("[SMTP] Using admin database SMTP configuration");
          } else {
            console.log(
              "[SMTP] No database SMTP config found, using environment variables"
            );
          }
        }
      } catch (error) {
        console.warn(
          "[SMTP] Error fetching SMTP config, using environment variables:",
          error.message
        );
      }

      const transporterResult = createTransporter(smtpConfig);

      if (!transporterResult.transporter) {
        const errorMsg =
          transporterResult.error || "Email service not configured";
        console.error("[SMTP]", errorMsg);

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

      const OTP_EXPIRY_MINUTES = 5;
      const templateType =
        userType === "customer"
          ? TEMPLATE_TYPE.CUSTOMER_EMAIL_VERIFICATION_OTP
          : TEMPLATE_TYPE.ADMIN_EMAIL_VERIFICATION_OTP;
      const templateContext =
        userType === "customer" && resellerId
          ? { resellerId }
          : {};

      let templateVars = {
        otp,
        expiry_time: String(OTP_EXPIRY_MINUTES),
        user: email.split("@")[0] || email,
      };

      if (userType === "customer" && resellerId) {
        const branding = await fetchResellerBrandingForOtp(resellerId);
        templateVars.brand_name = branding?.brand_name || "Team";
        templateVars.support_number = branding?.support_number || "";
        templateVars.support_email = branding?.support_email || "";
      } else {
        templateVars.platform_name = PLATFORM_NAME;
        templateVars.support_number = PLATFORM_SUPPORT_NUMBER;
        templateVars.support_email = PLATFORM_SUPPORT_EMAIL;
      }

      let resolvedContent = await resolveTransactionalEmail(
        templateType,
        templateVars,
        templateContext,
      );

      if (!resolvedContent?.subject || !resolvedContent?.html) {
        resolvedContent = {
          subject: "Email Verification OTP",
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;"><h2>Email Verification</h2><p>Your OTP is:</p><p style="font-size:28px;font-weight:bold;">${otp}</p><p>This OTP expires in ${OTP_EXPIRY_MINUTES} minutes.</p></div>`,
          text: `Your OTP is ${otp}. Expires in ${OTP_EXPIRY_MINUTES} minutes.`,
        };
      }

      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject: resolvedContent.subject,
        html: resolvedContent.html,
        text: resolvedContent.text,
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
   * Deliver WhatsApp OTP template (OTP must already be stored).
   */
  static async _deliverWhatsAppOtp(phone, otp, userType = "reseller", resellerId = null) {
    try {
      const whatsappConfig = await resolveWhatsAppConfigForOtp(
        userType,
        resellerId
      );
      if (!whatsappConfig?.api_key || !whatsappConfig?.phone_number_id) {
        return {
          success: false,
          message:
            "WhatsApp is not configured for this flow. Configure reseller or admin WhatsApp, or set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID.",
        };
      }

      const formattedPhone = phone.startsWith("+")
        ? phone.substring(1)
        : phone.startsWith("91")
        ? phone
        : `91${phone}`;

      const apiUrl = `${whatsappConfig.api_url}/${whatsappConfig.phone_number_id}/messages`;
      const accessToken = whatsappConfig.api_key;

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
        {
          type: "button",
          sub_type: "url",
          index: 0,
          parameters: [
            {
              type: "text",
              text: otp,
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
      const errorData = error.response?.data?.error || error.response?.data;
      console.error(
        "Error sending WhatsApp OTP:",
        JSON.stringify(errorData || error.message, null, 2)
      );
      return {
        success: false,
        message:
          errorData?.message ||
          error.message ||
          "Failed to send WhatsApp OTP",
        errorCode: errorData?.code,
        errorDetails: errorData?.error_data?.details,
      };
    }
  }

  /**
   * Send email OTP with comprehensive error handling
   * @param {string} email - Email address
   * @param {string} [userType='reseller'] - 'customer' for clienthub onboarding, 'reseller' for reseller signup
   * @param {string|null} [resellerId] - When userType is customer, use this reseller's SMTP first; then admin/env (lenient fallback)
   */
  static async sendEmailOTP(email, userType = "reseller", resellerId = null) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return {
        success: false,
        message: "Invalid email address format",
      };
    }

    const rl = assertOtpRateLimit(`email:${email}:${userType}`);
    if (!rl.ok) {
      return { success: false, message: rl.message };
    }

    const otp = this.generateOTP();
    console.log(`[OTP] Generating OTP for email: ${email} (user_type: ${userType})`);

    const storeResult = await this.storeOTP(email, null, otp, "email", userType);
    if (!storeResult.success) {
      console.error("[OTP] Failed to store OTP:", storeResult.message);
      return storeResult;
    }

    console.log("[OTP] OTP stored successfully");
    return await this._deliverEmailOtp(email, otp, userType, resellerId);
  }

  /**
   * Same OTP on email and WhatsApp (verify via /verify-email or /verify-phone with the same code).
   * Rate-limited separately from single-channel sends.
   */
  static async sendDualChannelOtp(
    email,
    phone,
    userType = "reseller",
    resellerId = null,
  ) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return { success: false, message: "Invalid email address format" };
    }
    const phoneStr = phone != null ? String(phone).trim() : "";
    if (!phoneStr || phoneStr.replace(/\D/g, "").length < 10) {
      return { success: false, message: "Invalid phone number" };
    }

    const rl = assertOtpRateLimit(`dual:${email}:${phoneStr}:${userType}`);
    if (!rl.ok) {
      return { success: false, message: rl.message };
    }

    const otp = this.generateOTP();
    const s1 = await this.storeOTP(email, null, otp, "email", userType);
    if (!s1.success) {
      return s1;
    }
    const s2 = await this.storeOTP(null, phoneStr, otp, "phone", userType);
    if (!s2.success) {
      return s2;
    }

    const emailRes = await this._deliverEmailOtp(email, otp, userType, resellerId);
    const waRes = await this._deliverWhatsAppOtp(phoneStr, otp, userType, resellerId);

    const ok = emailRes.success && waRes.success;
    let message = "OTP sent to your email and WhatsApp";
    if (!ok) {
      if (!emailRes.success && !waRes.success) {
        message = "Failed to send OTP on both channels";
      } else if (!emailRes.success) {
        message =
          "OTP sent to WhatsApp; email delivery failed. You can verify using WhatsApp, or request a new OTP.";
      } else {
        message =
          "OTP sent to email; WhatsApp delivery failed. You can verify using email, or request a new OTP.";
      }
    }

    return {
      success: ok,
      message,
      email: emailRes,
      whatsapp: waRes,
    };
  }

  /**
   * Send WhatsApp OTP
   * @param {string} phone - Phone number
   * @param {string} [userType='reseller'] - 'customer' for clienthub onboarding, 'reseller' for reseller signup
   * @param {string|null} [resellerId] - When userType is customer, use reseller WhatsApp config first (see whatsappConfig.service)
   */
  static async sendWhatsAppOTP(phone, userType = "reseller", resellerId = null) {
    const phoneStr = phone != null ? String(phone).trim() : "";
    if (!phoneStr || phoneStr.replace(/\D/g, "").length < 10) {
      return { success: false, message: "Invalid phone number" };
    }

    const rl = assertOtpRateLimit(`phone:${phoneStr}:${userType}`);
    if (!rl.ok) {
      return { success: false, message: rl.message };
    }

    const otp = this.generateOTP();

    const storeResult = await this.storeOTP(null, phoneStr, otp, "phone", userType);
    if (!storeResult.success) {
      return storeResult;
    }

    return await this._deliverWhatsAppOtp(phoneStr, otp, userType, resellerId);
  }
}
