/**
 * Default Admin Onboarding Email Template
 * This is used as a fallback when no template is found in the database
 */

export const getAdminOnboardingTemplate = (firstName, lastName, email, password, roleName, loginUrl) => {
  const roleInfo = roleName ? `<p><strong>Role:</strong> ${roleName}</p>` : '<p><strong>Role:</strong> No role assigned</p>';
  
  return {
    subject: 'Welcome to Virtual Number - Your Admin Account Credentials',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Admin Account Created</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #2c3e50; margin-top: 0;">Welcome to Virtual Number!</h2>
        </div>
        
        <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; border: 1px solid #dee2e6;">
          <p>Hello ${firstName} ${lastName},</p>
          
          <p>Your admin account has been successfully created. Below are your login credentials:</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #007bff;">
            <p style="margin: 10px 0;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 10px 0;"><strong>Password:</strong> <code style="background-color: #e9ecef; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${password}</code></p>
            ${roleInfo}
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}" 
               style="display: inline-block; background-color: #007bff; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Login to Your Account
            </a>
          </div>
          
          <p style="color: #dc3545; font-size: 13px; margin-top: 30px;">
            <strong>Important Security Notice:</strong> Please change your password after your first login for security purposes. You can do this from Settings → Reset Password.
          </p>
          
          <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
          
          <p style="color: #6c757d; font-size: 12px; margin-bottom: 0;">
            If you have any questions or need assistance, please contact our support team.
          </p>
        </div>
        
        <div style="margin-top: 20px; text-align: center; color: #6c757d; font-size: 12px;">
          <p>© ${new Date().getFullYear()} Virtual Number. All rights reserved.</p>
        </div>
      </body>
      </html>
    `,
    text: `
      Welcome to Virtual Number!
      
      Hello ${firstName} ${lastName},
      
      Your admin account has been successfully created. Below are your login credentials:
      
      Email: ${email}
      Password: ${password}
      ${roleName ? `Role: ${roleName}` : 'Role: No role assigned'}
      
      Login URL: ${loginUrl}
      
      Important Security Notice: Please change your password after your first login for security purposes. You can do this from Settings → Reset Password.
      
      If you have any questions or need assistance, please contact our support team.
      
      © ${new Date().getFullYear()} Virtual Number. All rights reserved.
    `,
  };
};

