/**
 * Customer KYC/Account Rejection Email Template
 */

export const getCustomerRejectionTemplate = (
  recipientName,
  rejectionReason,
  resellerName
) => {
  return {
    subject: "KYC Verification Update - Action Required",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>KYC Verification Update</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #2c3e50; margin-top: 0;">KYC Verification Update</h2>
        </div>
        
        <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; border: 1px solid #dee2e6;">
          <p>Hello ${recipientName},</p>
          
          <p>Thank you for submitting your details. After review, we are unable to approve your application at this time.</p>
          
          <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545;">
            <p style="margin: 0; font-size: 14px;"><strong>Reason:</strong></p>
            <p style="margin: 8px 0 0 0;">${rejectionReason || "Please contact support for more information."}</p>
          </div>
          
          <p>If you believe this is an error or would like to resubmit with corrected information, please contact your reseller.</p>
          
          <p><strong>Reseller:</strong> ${resellerName}</p>
          
          <p style="color: #6c757d; font-size: 13px; margin-top: 30px;">
            For assistance, please contact your reseller: ${resellerName}
          </p>
        </div>
        
        <div style="margin-top: 20px; text-align: center; color: #6c757d; font-size: 12px;">
          <p>© ${new Date().getFullYear()} Virtual Number. All rights reserved.</p>
        </div>
      </body>
      </html>
    `,
    text: `
      KYC Verification Update

      Hello ${recipientName},

      Thank you for submitting your details. After review, we are unable to approve your application at this time.

      Reason: ${rejectionReason || "Please contact support for more information."}

      If you believe this is an error or would like to resubmit with corrected information, please contact your reseller.

      Reseller: ${resellerName}

      For assistance, please contact your reseller: ${resellerName}

      © ${new Date().getFullYear()} Virtual Number. All rights reserved.
    `,
  };
};
