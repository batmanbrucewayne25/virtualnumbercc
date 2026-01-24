/**
 * Default Password Reset Email Template
 */

export const getPasswordResetTemplate = (resetLink) => {
  return {
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
};

