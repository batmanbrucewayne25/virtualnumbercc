/**
 * Reseller Application Rejection Email Template
 * Used when Super Admin rejects a reseller application.
 */

export const getResellerRejectionTemplate = (
  resellerName,
  rejectionReason,
  platformBrandName = "Virtual Number"
) => {
  const reason = rejectionReason || "Please contact support for more information.";
  const brand = platformBrandName?.trim() || "Virtual Number";
  return {
    subject: "Reseller Application Update",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reseller Application Update</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #2c3e50; margin-top: 0;">Reseller Application Update</h2>
        </div>
        
        <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; border: 1px solid #dee2e6;">
          <p>Dear ${resellerName || "Reseller"},</p>
          
          <p>Thank you for your interest in becoming a reseller. After review, we are unable to approve your reseller application at this time.</p>
          
          <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545;">
            <p style="margin: 0; font-size: 14px;"><strong>Reason:</strong></p>
            <p style="margin: 8px 0 0 0;">${reason}</p>
          </div>
          
          <p>If you believe this is an error or have questions, please contact support.</p>
          
          <p style="color: #6c757d; font-size: 13px; margin-top: 30px;">
            Best regards,<br />
            ${brand} Team
          </p>
        </div>
        
        <div style="margin-top: 20px; text-align: center; color: #6c757d; font-size: 12px;">
          <p>© ${new Date().getFullYear()} ${brand}. All rights reserved.</p>
        </div>
      </body>
      </html>
    `,
    text: `
Reseller Application Update

Dear ${resellerName || "Reseller"},

Thank you for your interest in becoming a reseller. After review, we are unable to approve your reseller application at this time.

Reason: ${reason}

If you believe this is an error or have questions, please contact support.

Best regards,
${brand} Team

© ${new Date().getFullYear()} ${brand}. All rights reserved.
    `,
  };
};
