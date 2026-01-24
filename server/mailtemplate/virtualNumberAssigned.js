/**
 * Default Virtual Number Assigned Email Template
 */

export const getVirtualNumberAssignedTemplate = (recipientName, virtualNumber, resellerName) => {
  return {
    subject: 'Virtual Number Assigned - Your Account is Active',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Virtual Number Assigned</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #2c3e50; margin-top: 0;">Virtual Number Assigned</h2>
        </div>
        
        <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; border: 1px solid #dee2e6;">
          <p>Hello ${recipientName},</p>
          
          <p>Congratulations! Your account has been approved and your virtual number has been successfully generated.</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745; text-align: center;">
            <p style="margin: 10px 0; font-size: 24px; font-weight: bold; color: #28a745;">${virtualNumber}</p>
          </div>
          
          <p>Your virtual number is now active and ready to use. You can start using it for your business communications.</p>
          
          <p><strong>Reseller:</strong> ${resellerName}</p>
          
          <p style="color: #6c757d; font-size: 13px; margin-top: 30px;">
            If you have any questions or need assistance, please contact your reseller: ${resellerName}
          </p>
        </div>
        
        <div style="margin-top: 20px; text-align: center; color: #6c757d; font-size: 12px;">
          <p>© ${new Date().getFullYear()} Virtual Number. All rights reserved.</p>
        </div>
      </body>
      </html>
    `,
    text: `
      Virtual Number Assigned
      
      Hello ${recipientName},
      
      Congratulations! Your account has been approved and your virtual number has been successfully generated.
      
      Your Virtual Number: ${virtualNumber}
      
      Your virtual number is now active and ready to use. You can start using it for your business communications.
      
      Reseller: ${resellerName}
      
      If you have any questions or need assistance, please contact your reseller: ${resellerName}
      
      © ${new Date().getFullYear()} Virtual Number. All rights reserved.
    `,
  };
};

