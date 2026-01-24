/**
 * Default Razorpay Payment Link Email Template
 */

export const getRazorpayLinkTemplate = (recipientName, razorpayLink, planName, planAmount, resellerName) => {
  return {
    subject: 'Complete Your Payment - Virtual Number Subscription',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Link</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #2c3e50; margin-top: 0;">Complete Your Payment</h2>
        </div>
        
        <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; border: 1px solid #dee2e6;">
          <p>Hello ${recipientName},</p>
          
          <p>Your account has been approved! To activate your virtual number, please complete the payment using the link below.</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 10px 0;"><strong>Subscription Plan:</strong> ${planName}</p>
            <p style="margin: 10px 0;"><strong>Amount:</strong> ₹${Number(planAmount).toFixed(2)}</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${razorpayLink}" 
               style="display: inline-block; background-color: #007bff; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Pay Now with Razorpay
            </a>
          </div>
          
          <p style="color: #6c757d; font-size: 14px;">Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; background-color: #f8f9fa; padding: 10px; border-radius: 4px; font-size: 12px; color: #495057;">
            ${razorpayLink}
          </p>
          
          <p><strong>Reseller:</strong> ${resellerName}</p>
          
          <p style="color: #dc3545; font-size: 13px; margin-top: 30px;">
            <strong>Note:</strong> Your virtual number will be activated automatically after successful payment.
          </p>
        </div>
        
        <div style="margin-top: 20px; text-align: center; color: #6c757d; font-size: 12px;">
          <p>© ${new Date().getFullYear()} Virtual Number. All rights reserved.</p>
        </div>
      </body>
      </html>
    `,
    text: `
      Complete Your Payment
      
      Hello ${recipientName},
      
      Your account has been approved! To activate your virtual number, please complete the payment using the link below.
      
      Subscription Plan: ${planName}
      Amount: ₹${Number(planAmount).toFixed(2)}
      
      Payment Link: ${razorpayLink}
      
      Reseller: ${resellerName}
      
      Note: Your virtual number will be activated automatically after successful payment.
      
      © ${new Date().getFullYear()} Virtual Number. All rights reserved.
    `,
  };
};

