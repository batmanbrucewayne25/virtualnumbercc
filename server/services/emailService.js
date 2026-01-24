import nodemailer from 'nodemailer';
import { getSmtpTemplateByType, replaceTemplateVariables } from '../src/services/smtpTemplate.service.js';
import { getAdminSmtpConfig } from '../src/services/smtpConfig.service.js';
import { getAdminOnboardingTemplate } from '../mailtemplate/adminOnboarding.js';
import { getPasswordResetTemplate } from '../mailtemplate/passwordReset.js';
import { getVirtualNumberAssignedTemplate } from '../mailtemplate/virtualNumberAssigned.js';
import { getRazorpayLinkTemplate } from '../mailtemplate/razorpayLink.js';

// SMTP configuration from environment variables
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_SECURE = process.env.SMTP_SECURE === 'true'; // true for 465, false for other ports
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
const SMTP_FROM_EMAIL = process.env.SMTP_FROM_EMAIL || SMTP_USER;
const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || 'Virtual Number';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * Create email transporter
 * @param {object} smtpConfig - Optional SMTP config from database. If not provided, uses env variables
 */
const createTransporter = (smtpConfig = null) => {
  // Use database config if provided, otherwise use env variables
  const host = smtpConfig?.host || SMTP_HOST;
  const port = smtpConfig?.port || SMTP_PORT;
  const username = smtpConfig?.username || SMTP_USER;
  const password = smtpConfig?.password || SMTP_PASSWORD;
  const fromEmail = smtpConfig?.from_email || SMTP_FROM_EMAIL || username;
  const fromName = smtpConfig?.from_name || SMTP_FROM_NAME || 'Virtual Number';
  
  // Check if SMTP is configured
  if (!username || !password) {
    console.warn('SMTP credentials not configured. Email sending will be disabled.');
    return null;
  }

  // Gmail-specific configuration
  const isGmail = host.includes('gmail.com');
  
  // For Gmail, use service instead of host/port for better compatibility
  if (isGmail) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: username,
        pass: password, // MUST be an App Password, not regular password
      },
    });
  }
  
  // For other SMTP providers
  return nodemailer.createTransport({
    host: host,
    port: port,
    secure: port === 465, // true for 465, false for other ports
    auth: {
      user: username,
      pass: password,
    },
  });
};

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async (email, resetToken) => {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      console.error('Email transporter not available. SMTP not configured.');
      return {
        success: false,
        message: 'Email service not configured. Please contact administrator.'
      };
    }

    const resetLink = `${FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    // Use default template (can be extended to check database in future)
    const defaultTemplate = getPasswordResetTemplate(resetLink);

    const mailOptions = {
      from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
      to: email,
      subject: defaultTemplate.subject,
      html: defaultTemplate.html,
      text: defaultTemplate.text,
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log('Password reset email sent:', info.messageId);
    
    return {
      success: true,
      messageId: info.messageId
    };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return {
      success: false,
      message: error.message || 'Failed to send email'
    };
  }
};

/**
 * Send admin welcome email with credentials
 * First checks for template in database, then falls back to default template
 * Uses SMTP config from database if available, otherwise uses env variables
 */
export const sendAdminWelcomeEmail = async (email, firstName, lastName, password, roleName = null, adminId = null) => {
  try {
    const loginUrl = `${FRONTEND_URL}/sign-in`;
    
    // Try to get SMTP config from database first
    let smtpConfig = null;
    let fromEmail = SMTP_FROM_EMAIL || SMTP_USER;
    let fromName = SMTP_FROM_NAME || 'Virtual Number';
    
    if (adminId) {
      try {
        console.log('[Email Service] Fetching SMTP config for adminId:', adminId);
        smtpConfig = await getAdminSmtpConfig(adminId);
        if (smtpConfig) {
          console.log('[Email Service] SMTP config found in database:', {
            id: smtpConfig.id,
            admin_id: smtpConfig.admin_id,
            host: smtpConfig.host,
            port: smtpConfig.port,
            username: smtpConfig.username,
            from_email: smtpConfig.from_email,
            from_name: smtpConfig.from_name,
            has_password: !!smtpConfig.password,
            password_length: smtpConfig.password ? smtpConfig.password.length : 0
          });
          fromEmail = smtpConfig.from_email || smtpConfig.username;
          fromName = smtpConfig.from_name || 'Virtual Number';
        } else {
          console.log('[Email Service] No SMTP config found in database for adminId:', adminId);
        }
      } catch (configError) {
        console.error('[Email Service] Error fetching SMTP config from database:', configError);
        console.warn('[Email Service] Using env variables as fallback');
      }
    } else {
      console.log('[Email Service] No adminId provided, using env variables');
    }
    
    // Check SMTP configuration
    // If we have SMTP config from database but password is missing, it's likely a permissions issue
    if (smtpConfig && (!smtpConfig.password || smtpConfig.password.trim() === '')) {
      console.error('[Email Service] SMTP config found in database but password field is missing or empty.');
      console.error('[Email Service] This might be a Hasura permissions issue or the password was not saved.');
      console.error('[Email Service] Falling back to environment variables for SMTP credentials.');
      // Fall back to env variables
      smtpConfig = null;
    }
    
    // Get final credentials (from database if available, otherwise from env)
    const username = smtpConfig?.username || SMTP_USER;
    const password_config = smtpConfig?.password || SMTP_PASSWORD;
    
    console.log('[Email Service] SMTP credentials check:', {
      has_username: !!username,
      has_password: !!password_config,
      using_database_config: !!smtpConfig,
      username_source: smtpConfig?.username ? 'database' : 'env',
      password_source: smtpConfig?.password ? 'database' : 'env',
      smtpConfig_keys: smtpConfig ? Object.keys(smtpConfig) : []
    });
    
    if (!username || !password_config) {
      console.error('[Email Service] SMTP credentials not configured.', {
        username: username ? 'present' : 'missing',
        password: password_config ? 'present' : 'missing',
        smtpConfig_exists: !!smtpConfig,
        adminId: adminId,
        env_SMTP_USER: SMTP_USER ? 'present' : 'missing',
        env_SMTP_PASSWORD: SMTP_PASSWORD ? 'present' : 'missing'
      });
      return {
        success: false,
        message: 'Email service not configured. Please ensure SMTP credentials are set in admin settings or environment variables.'
      };
    }

    // Only pass smtpConfig if it has all required fields (including password)
    const transporterConfig = (smtpConfig && smtpConfig.password) ? smtpConfig : null;
    const transporter = createTransporter(transporterConfig);
    
    if (!transporter) {
      console.error('[Email Service] Email transporter not available. SMTP not configured.');
      return {
        success: false,
        message: 'Email service not configured. Please contact administrator.'
      };
    }

    // Verify SMTP connection before sending (helps catch auth errors early)
    try {
      await transporter.verify();
      console.log('[Email Service] SMTP connection verified successfully');
    } catch (verifyError) {
      console.error('[Email Service] SMTP verification failed:', verifyError.message);
      
      const host = smtpConfig?.host || SMTP_HOST;
      // Provide helpful error message for Gmail
      if (host.includes('gmail.com')) {
        return {
          success: false,
          message: `Gmail authentication failed. Please ensure:\n1. You have enabled 2-Step Verification on your Google account\n2. You are using an App Password (not your regular password)\n3. Generate App Password at: https://myaccount.google.com/apppasswords\n\nError: ${verifyError.message}`
        };
      }
      
      return {
        success: false,
        message: `SMTP authentication failed: ${verifyError.message}. Please check your SMTP credentials.`
      };
    }
    
    // Try to get template from database first
    let template = null;
    if (adminId) {
      try {
        template = await getSmtpTemplateByType('admin_onboarding', adminId);
        if (template) {
          console.log('[Email Service] Using database template for admin onboarding');
        }
      } catch (templateError) {
        console.warn('[Email Service] Error fetching template from database, using default:', templateError.message);
      }
    }
    
    // Prepare variables for template replacement
    // Support both snake_case and camelCase for flexibility
    const templateVariables = {
      // snake_case (for {{variable_name}} syntax)
      first_name: firstName,
      last_name: lastName,
      full_name: `${firstName} ${lastName}`,
      email: email,
      password: password,
      role_name: roleName || 'No role assigned',
      role: roleName || 'No role assigned',
      login_url: loginUrl,
      frontend_url: FRONTEND_URL,
      // camelCase (for ${variableName} syntax)
      firstName: firstName,
      lastName: lastName,
      fullName: `${firstName} ${lastName}`,
      roleName: roleName || 'No role assigned',
      loginUrl: loginUrl,
      frontendUrl: FRONTEND_URL,
    };
    
    let subject, html, text;
    
    if (template && template.subject && template.body) {
      // Use database template
      console.log('[Email Service] Using database template');
      console.log('[Email Service] Template body before replacement:', template.body.substring(0, 200));
      console.log('[Email Service] Template variables:', Object.keys(templateVariables));
      
      subject = replaceTemplateVariables(template.subject, templateVariables);
      html = replaceTemplateVariables(template.body, templateVariables);
      
      console.log('[Email Service] Template body after replacement:', html.substring(0, 200));
      console.log('[Email Service] Checking if replacement worked:', {
        has_original_syntax: html.includes('${firstName}'),
        has_replaced_value: html.includes(firstName)
      });
      
      text = html.replace(/<[^>]*>/g, ''); // Simple HTML to text conversion
    } else {
      // Use default template
      const defaultTemplate = getAdminOnboardingTemplate(firstName, lastName, email, password, roleName, loginUrl);
      subject = defaultTemplate.subject;
      html = defaultTemplate.html;
      text = defaultTemplate.text;
      console.log('[Email Service] Using default template');
    }

    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to: email,
      subject: subject,
      html: html,
      text: text,
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log('Admin welcome email sent:', info.messageId);
    
    return {
      success: true,
      messageId: info.messageId
    };
  } catch (error) {
    console.error('Error sending admin welcome email:', error);
    return {
      success: false,
      message: error.message || 'Failed to send email'
    };
  }
};

/**
 * Send virtual number assignment email to customer and admin
 */
export const sendVirtualNumberEmail = async (email, recipientName, virtualNumber, resellerName) => {
  try {
    const transporter = createTransporter(); // Uses env variables
    
    if (!transporter) {
      console.error('Email transporter not available. SMTP not configured.');
      return {
        success: false,
        message: 'Email service not configured. Please contact administrator.'
      };
    }

    // Use default template (can be extended to check database in future)
    const defaultTemplate = getVirtualNumberAssignedTemplate(recipientName, virtualNumber, resellerName);

    const mailOptions = {
      from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
      to: email,
      subject: defaultTemplate.subject,
      html: defaultTemplate.html,
      text: defaultTemplate.text,
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log('Virtual number email sent:', info.messageId);
    
    return {
      success: true,
      messageId: info.messageId
    };
  } catch (error) {
    console.error('Error sending virtual number email:', error);
    return {
      success: false,
      message: error.message || 'Failed to send email'
    };
  }
};

/**
 * Send Razorpay payment link email to customer
 */
export const sendRazorpayLinkEmail = async (email, recipientName, razorpayLink, planName, planAmount, resellerName) => {
  try {
    const transporter = createTransporter(); // Uses env variables
    
    if (!transporter) {
      console.error('Email transporter not available. SMTP not configured.');
      return {
        success: false,
        message: 'Email service not configured. Please contact administrator.'
      };
    }

    // Use default template (can be extended to check database in future)
    const defaultTemplate = getRazorpayLinkTemplate(recipientName, razorpayLink, planName, planAmount, resellerName);

    const mailOptions = {
      from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
      to: email,
      subject: defaultTemplate.subject,
      html: defaultTemplate.html,
      text: defaultTemplate.text,
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log('Razorpay link email sent:', info.messageId);
    
    return {
      success: true,
      messageId: info.messageId
    };
  } catch (error) {
    console.error('Error sending Razorpay link email:', error);
    return {
      success: false,
      message: error.message || 'Failed to send email'
    };
  }
};

/**
 * Verify SMTP configuration
 */
export const verifySMTPConfig = async () => {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      return {
        success: false,
        message: 'SMTP not configured'
      };
    }

    await transporter.verify();
    
    return {
      success: true,
      message: 'SMTP configuration is valid'
    };
  } catch (error) {
    console.error('SMTP verification error:', error);
    return {
      success: false,
      message: error.message || 'SMTP verification failed'
    };
  }
};

