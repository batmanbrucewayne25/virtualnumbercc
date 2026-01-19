import nodemailer from 'nodemailer';

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
 */
const createTransporter = () => {
  // Check if SMTP is configured
  if (!SMTP_USER || !SMTP_PASSWORD) {
    console.warn('SMTP credentials not configured. Email sending will be disabled.');
    return null;
  }

  return nodemailer.createTransporter({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE, // true for 465, false for other ports
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASSWORD,
    },
    // For Gmail, you may need to use an App Password instead of your regular password
    // See: https://support.google.com/accounts/answer/185833
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

    const mailOptions = {
      from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
      to: email,
      subject: 'Password Reset Request',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #2c3e50; margin-top: 0;">Password Reset Request</h2>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; border: 1px solid #dee2e6;">
            <p>Hello,</p>
            
            <p>We received a request to reset your password for your Virtual Number account. Click the button below to reset your password:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" 
                 style="display: inline-block; background-color: #007bff; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Reset Password
              </a>
            </div>
            
            <p style="color: #6c757d; font-size: 14px;">Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background-color: #f8f9fa; padding: 10px; border-radius: 4px; font-size: 12px; color: #495057;">
              ${resetLink}
            </p>
            
            <p style="color: #dc3545; font-size: 13px; margin-top: 30px;">
              <strong>Important:</strong> This link will expire in 1 hour. If you didn't request this password reset, please ignore this email.
            </p>
            
            <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
            
            <p style="color: #6c757d; font-size: 12px; margin-bottom: 0;">
              If you're having trouble clicking the button, copy and paste the URL above into your web browser.
            </p>
          </div>
          
          <div style="margin-top: 20px; text-align: center; color: #6c757d; font-size: 12px;">
            <p>© ${new Date().getFullYear()} Virtual Number. All rights reserved.</p>
          </div>
        </body>
        </html>
      `,
      text: `
        Password Reset Request
        
        Hello,
        
        We received a request to reset your password for your Virtual Number account.
        
        Click this link to reset your password:
        ${resetLink}
        
        This link will expire in 1 hour. If you didn't request this password reset, please ignore this email.
        
        © ${new Date().getFullYear()} Virtual Number. All rights reserved.
      `,
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

