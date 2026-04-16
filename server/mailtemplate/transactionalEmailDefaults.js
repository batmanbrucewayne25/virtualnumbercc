/**
 * Default HTML/text when no mst_smtp_template row exists for the given template_type.
 */
import { TEMPLATE_TYPE } from "./emailTemplateRegistry.js";

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/** Greeting for end-customer emails (enriched customer_display_name or fallback user). */
function customerGreetEsc(v) {
  return esc(v.customer_display_name || v.user);
}

/** Customer name in admin-to-reseller copy (enriched or passed customer_name). */
function adminCustomerLineEsc(v) {
  return esc(v.customer_display_name || v.customer_name || v.user || "");
}

/**
 * @param {object} v - variables (may include brand_logo_url, platform_logo_url from resolver)
 * @param {string} headerTitleEsc - already HTML-escaped brand or platform title for alt / text fallback
 */
function layout(v, headerTitleEsc, innerHtml) {
  const rawUrl = String(v.brand_logo_url || v.platform_logo_url || "").trim();
  const headerBlock = rawUrl
    ? `<div style="margin-bottom:16px"><img src="${esc(rawUrl)}" alt="${headerTitleEsc}" style="max-height:56px;max-width:240px;height:auto;display:block;border:0;" /></div>`
    : `<p style="font-size:14px;font-weight:600;margin:0 0 16px;color:#333;">${headerTitleEsc}</p>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;">
${headerBlock}
${innerHtml}
</body></html>`;
}

function textFromParts(lines) {
  return lines.filter(Boolean).join("\n\n");
}

const DEFAULTS = {
  [TEMPLATE_TYPE.ADMIN_EMAIL_VERIFICATION_OTP]: (v) => {
    const platform = esc(v.platform_name);
    const user = esc(v.user);
    return {
      subject: "Verify Your Email Address – OTP Code",
      html: layout(v,
        platform,
        `<p>Hello ${user},</p>
<p>Welcome to ${platform}!</p>
<p>To verify your email address, please use the One-Time Password (OTP) below:</p>
<p style="font-size:24px;font-weight:bold;letter-spacing:4px;">🔐 OTP Code: ${esc(v.otp)}</p>
<p>This OTP is valid for the next ${esc(v.expiry_time)} minutes.</p>
<p>For your security, please do not share this code with anyone.</p>
<p>If you did not initiate this request, please contact our support team immediately at ${esc(v.support_number)} or ${esc(v.support_email)}.</p>
<p>Best regards,<br/>${platform}</p>`,
      ),
      text: textFromParts([
        `Hello ${v.user}`,
        `OTP: ${v.otp}`,
        `Valid ${v.expiry_time} minutes.`,
        `Support: ${v.support_number} / ${v.support_email}`,
      ]),
    };
  },

  [TEMPLATE_TYPE.CUSTOMER_EMAIL_VERIFICATION_OTP]: (v) => {
    const brand = esc(v.brand_name);
    const greet = customerGreetEsc(v);
    return {
      subject: "Verify Your Email Address – OTP Code",
      html: layout(v,
        brand,
        `<p>Hello ${greet},</p>
<p>Welcome to ${brand}!</p>
<p>To continue, please verify your email address using the OTP below:</p>
<p style="font-size:24px;font-weight:bold;letter-spacing:4px;">🔐 OTP Code: ${esc(v.otp)}</p>
<p>This OTP is valid for the next ${esc(v.expiry_time)} minutes.</p>
<p>For your security, do not share this code with anyone.</p>
<p>If you did not initiate this request, please contact our support team immediately at ${esc(v.support_number)} or ${esc(v.support_email)}.</p>
<p>Best regards,<br/>${brand}</p>`,
      ),
      text: textFromParts([
        `Hello ${v.customer_display_name || v.user}`,
        `OTP: ${v.otp}`,
        `Support: ${v.support_number} / ${v.support_email}`,
      ]),
    };
  },

  [TEMPLATE_TYPE.ADMIN_KYC_SUBMITTED_SUPER]: (v) => {
    const p = esc(v.platform_name);
    return {
      subject: "New Admin KYC Submission Received",
      html: layout(v,
        p,
        `<p>Hello,</p>
<p>A new admin KYC submission has been received for verification.</p>
<p><strong>Admin Name:</strong> ${esc(v.user)}<br/><strong>Email:</strong> ${esc(v.email)}</p>
<p>Please review the submitted documents and take appropriate action.</p>
<p>Best regards,<br/>${p}</p>`,
      ),
      text: `New admin KYC: ${v.user} / ${v.email}`,
    };
  },

  [TEMPLATE_TYPE.ADMIN_KYC_APPROVED]: (v) => {
    const p = esc(v.platform_name);
    const user = esc(v.user);
    return {
      subject: "Your KYC Verification Has Been Approved",
      html: layout(v,
        p,
        `<p>Hello ${user},</p>
<p>We are pleased to inform you that your KYC verification has been successfully approved.</p>
<p>Your account is now fully verified and active.</p>
<p>Best regards,<br/>${p}</p>`,
      ),
      text: `KYC approved for ${v.user}`,
    };
  },

  [TEMPLATE_TYPE.ADMIN_KYC_REJECTED]: (v) => {
    const p = esc(v.platform_name);
    const user = esc(v.user);
    return {
      subject: "Action Required – KYC Verification Rejected",
      html: layout(v,
        p,
        `<p>Hello ${user},</p>
<p>We regret to inform you that your KYC verification has been rejected.</p>
<p><strong>Reason:</strong> ${esc(v.rejection_reason)}</p>
<p>Please update your details and resubmit your KYC.</p>
<p>If you need assistance, contact us at ${esc(v.support_number)} or ${esc(v.support_email)}.</p>
<p>Best regards,<br/>${p}</p>`,
      ),
      text: `KYC rejected: ${v.rejection_reason}`,
    };
  },

  [TEMPLATE_TYPE.ADMIN_ACCOUNT_DEACTIVATED]: (v) => {
    const p = esc(v.platform_name);
    const user = esc(v.user);
    return {
      subject: "Your Account Has Been Deactivated",
      html: layout(v,
        p,
        `<p>Hello ${user},</p>
<p>Your Reseller account has been deactivated.</p>
<p>For more details or assistance, please contact support at ${esc(v.support_number)} or ${esc(v.support_email)}.</p>
<p>Best regards,<br/>${p}</p>`,
      ),
      text: `Account deactivated: ${v.user}`,
    };
  },

  [TEMPLATE_TYPE.CUSTOMER_KYC_SUBMITTED_ADMIN]: (v) => {
    const b = esc(v.brand_name);
    const user = esc(v.user);
    return {
      subject: "New Customer KYC Submission Received",
      html: layout(v,
        b,
        `<p>Hello ${user},</p>
<p>A customer has submitted their KYC for verification.</p>
<p><strong>Customer Name:</strong> ${adminCustomerLineEsc(v)}<br/><strong>Email:</strong> ${esc(v.customer_email)}</p>
<p>Please review the submitted documents and take appropriate action.</p>
<p>Best regards,<br/>${b}</p>`,
      ),
      text: `New customer KYC: ${v.customer_display_name || v.customer_name}`,
    };
  },

  [TEMPLATE_TYPE.CUSTOMER_KYC_APPROVED]: (v) => {
    const b = esc(v.brand_name);
    const greet = customerGreetEsc(v);
    const rPhone = esc(v.reseller_number ?? v.admin_phone ?? "");
    const rEmail = esc(v.reseller_email ?? v.admin_email ?? "");
    return {
      subject: "Your KYC Has Been Approved",
      html: layout(v,
        b,
        `<p>Hello ${greet},</p>
<p>Your KYC verification has been successfully approved.</p>
<p>You can now proceed to get your virtual number.</p>
<p>To continue, please contact your service provider/Reseller using the details below:</p>
<p>📞 Contact: ${rPhone}<br/>📧 Email: ${rEmail}</p>
<p>Our team will assist you with number allocation and activation.</p>
<p>If you did not initiate this request, please contact support at ${esc(v.support_number)} or ${esc(v.support_email)}.</p>
<p>Best regards,<br/>${b}</p>`,
      ),
      text: `KYC approved. Contact ${v.reseller_number || v.admin_phone} / ${v.reseller_email || v.admin_email}`,
    };
  },

  [TEMPLATE_TYPE.CUSTOMER_KYC_REJECTED]: (v) => {
    const b = esc(v.brand_name);
    const greet = customerGreetEsc(v);
    return {
      subject: "KYC Rejected – Action Required",
      html: layout(v,
        b,
        `<p>Hello ${greet},</p>
<p>Your KYC verification has been rejected.</p>
<p><strong>Reason:</strong> ${esc(v.rejection_reason)}</p>
<p>Please update your information and resubmit.</p>
<p>For help, contact ${esc(v.support_number)} or ${esc(v.support_email)}.</p>
<p>Best regards,<br/>${b}</p>`,
      ),
      text: `KYC rejected: ${v.rejection_reason}`,
    };
  },

  [TEMPLATE_TYPE.PAYMENT_LINK_GENERATED]: (v) => {
    const b = esc(v.brand_name);
    const greet = customerGreetEsc(v);
    return {
      subject: "Complete Your Virtual Number Activation",
      html: layout(v,
        b,
        `<p>Hello ${greet},</p>
<p>Your virtual number request is almost complete.</p>
<p>To activate your number, please proceed with the payment using the secure link below:</p>
<p><a href="${esc(v.payment_link)}">${esc(v.payment_link)}</a></p>
<p>Once the payment is successful, your virtual number will be activated instantly.</p>
<p>If you did not initiate this request, please contact our support team at ${esc(v.support_number)} or ${esc(v.support_email)}.</p>
<p>Best regards,<br/>${b}</p>`,
      ),
      text: `Pay here: ${v.payment_link}`,
    };
  },

  [TEMPLATE_TYPE.PAYMENT_SUCCESS_CUSTOMER]: (v) => {
    const b = esc(v.brand_name);
    const greet = customerGreetEsc(v);
    return {
      subject: "Payment Successful",
      html: layout(v,
        b,
        `<p>Hello ${greet},</p>
<p>Your payment has been successfully completed.</p>
<p><strong>Amount:</strong> ₹${esc(v.amount)}<br/><strong>Transaction ID:</strong> ${esc(v.transaction_id)}</p>
<p>Your virtual number will be activated shortly. Our team will notify you once it is ready.</p>
<p>Thank you for your payment.</p>
<p>Best regards,<br/>${b}</p>`,
      ),
      text: `Payment OK ₹${v.amount} txn ${v.transaction_id}`,
    };
  },

  [TEMPLATE_TYPE.PAYMENT_SUCCESS_ADMIN]: (v) => {
    const b = esc(v.brand_name);
    const user = esc(v.user);
    return {
      subject: "Customer Payment Received",
      html: layout(v,
        b,
        `<p>Hello ${user},</p>
<p>A payment has been successfully received.</p>
<p><strong>Customer:</strong> ${adminCustomerLineEsc(v)}<br/><strong>Amount:</strong> ₹${esc(v.amount)}</p>
<p>Best regards,<br/>${b}</p>`,
      ),
      text: `Payment from ${v.customer_display_name || v.customer_name}: ₹${v.amount}`,
    };
  },

  [TEMPLATE_TYPE.PAYMENT_FAILED]: (v) => {
    const b = esc(v.brand_name);
    const greet = customerGreetEsc(v);
    return {
      subject: "Payment Failed – Try Again",
      html: layout(v,
        b,
        `<p>Hello ${greet},</p>
<p>Your payment attempt was unsuccessful.</p>
<p>Please try again using the payment link.</p>
<p>If the issue persists, please contact ${esc(v.support_number)} or ${esc(v.support_email)}.</p>
<p>Best regards,<br/>${b}</p>`,
      ),
      text: `Payment failed. Contact ${v.support_number}`,
    };
  },

  [TEMPLATE_TYPE.NUMBER_ACTIVATED_CUSTOMER]: (v) => {
    const b = esc(v.brand_name);
    const greet = customerGreetEsc(v);
    return {
      subject: "Your Virtual Number is Activated",
      html: layout(v,
        b,
        `<p>Hello ${greet},</p>
<p>Your virtual number has been successfully activated.</p>
<p><strong>Virtual Number:</strong> ${esc(v.virtual_number)}<br/>
<strong>Call Forward Number:</strong> ${esc(v.forward_number)}<br/>
<strong>Start Date:</strong> ${esc(v.start_date)}<br/>
<strong>End Date:</strong> ${esc(v.end_date)}</p>
<p>Thank you for choosing ${b}.</p>
<p>Best regards,<br/>${b}</p>`,
      ),
      text: `VN ${v.virtual_number} active`,
    };
  },

  [TEMPLATE_TYPE.CALL_FORWARD_UPDATED]: (v) => {
    const b = esc(v.brand_name);
    const greet = customerGreetEsc(v);
    return {
      subject: "Call Forward Updated Successfully",
      html: layout(v,
        b,
        `<p>Hello ${greet},</p>
<p>Your call forwarding number has been updated.</p>
<p><strong>New Forward Number:</strong> ${esc(v.forward_number)}</p>
<p>This change will take effect shortly.</p>
<p>Best regards,<br/>${b}</p>`,
      ),
      text: `Forward updated to ${v.forward_number}`,
    };
  },

  [TEMPLATE_TYPE.NUMBER_SUSPENDED]: (v) => {
    const b = esc(v.brand_name);
    const greet = customerGreetEsc(v);
    return {
      subject: "Your Virtual Number Has Been Suspended",
      html: layout(v,
        b,
        `<p>Hello ${greet},</p>
<p>Your virtual number has been suspended.</p>
<p><strong>Virtual Number:</strong> ${esc(v.virtual_number)}</p>
<p>For more details, please contact ${esc(v.support_number)}.</p>
<p>Best regards,<br/>${b}</p>`,
      ),
      text: `Suspended: ${v.virtual_number}`,
    };
  },

  [TEMPLATE_TYPE.EXPIRY_REMINDER_30D]: (v) => {
    const b = esc(v.brand_name);
    const greet = customerGreetEsc(v);
    return {
      subject: "Your Number Will Expire Soon",
      html: layout(v,
        b,
        `<p>Hello ${greet},</p>
<p>Your virtual number will expire in 30 days.</p>
<p>Please renew to avoid service interruption.</p>
<p><strong>Virtual Number:</strong> ${esc(v.virtual_number)}</p>
<p>Immediate action is recommended to avoid service disruption.</p>
<p>Best regards,<br/>${b}</p>`,
      ),
      text: `Renew in 30d: ${v.virtual_number}`,
    };
  },

  [TEMPLATE_TYPE.EXPIRY_REMINDER_7D]: (v) => {
    const b = esc(v.brand_name);
    const greet = customerGreetEsc(v);
    return {
      subject: "Urgent: Your Number is Expiring Soon",
      html: layout(v,
        b,
        `<p>Hello ${greet},</p>
<p>Your virtual number will expire in 7 days.</p>
<p>Renew now to continue uninterrupted service.</p>
<p><strong>Virtual Number:</strong> ${esc(v.virtual_number)}</p>
<p>Best regards,<br/>${b}</p>`,
      ),
      text: `Renew in 7d: ${v.virtual_number}`,
    };
  },

  [TEMPLATE_TYPE.EXPIRY_REMINDER_15D]: (v) => {
    const b = esc(v.brand_name);
    const greet = customerGreetEsc(v);
    return {
      subject: "Your Number Will Expire in 15 Days",
      html: layout(v,
        b,
        `<p>Hello ${greet},</p>
<p>Your virtual number will expire in 15 days.</p>
<p>Please plan renewal to avoid interruption.</p>
<p><strong>Virtual Number:</strong> ${esc(v.virtual_number)}</p>
<p>Best regards,<br/>${b}</p>`,
      ),
      text: `Renew in 15d: ${v.virtual_number}`,
    };
  },

  [TEMPLATE_TYPE.PAYMENT_LINK_RESENT]: (v) => {
    const b = esc(v.brand_name);
    const greet = customerGreetEsc(v);
    return {
      subject: "Payment Link (Resent)",
      html: layout(v,
        b,
        `<p>Hello ${greet},</p>
<p>Here is your payment link again:</p>
<p><a href="${esc(v.payment_link)}">${esc(v.payment_link)}</a></p>
<p>If you did not request this, contact ${esc(v.support_email)}.</p>
<p>Best regards,<br/>${b}</p>`,
      ),
      text: `Pay here: ${v.payment_link}`,
    };
  },

  [TEMPLATE_TYPE.PAYMENT_FAILED_ADMIN]: (v) => {
    const b = esc(v.brand_name);
    const user = esc(v.user);
    return {
      subject: "Customer Payment Failed",
      html: layout(v,
        b,
        `<p>Hello ${user},</p>
<p>A customer payment attempt failed.</p>
<p><strong>Customer:</strong> ${adminCustomerLineEsc(v)}<br/>
<strong>Amount:</strong> ₹${esc(v.amount)}<br/>
<strong>Reason:</strong> ${esc(v.failure_reason)}</p>
<p>Best regards,<br/>${b}</p>`,
      ),
      text: `Payment failed: ${v.customer_display_name || v.customer_name} ₹${v.amount}`,
    };
  },

  [TEMPLATE_TYPE.RENEWAL_PAYMENT_SUCCESS_CUSTOMER]: (v) => {
    const b = esc(v.brand_name);
    const greet = customerGreetEsc(v);
    return {
      subject: "Renewal Payment Successful",
      html: layout(v,
        b,
        `<p>Hello ${greet},</p>
<p>Your renewal payment was successful.</p>
<p><strong>Amount:</strong> ₹${esc(v.amount)}<br/>
<strong>Transaction:</strong> ${esc(v.transaction_id)}<br/>
<strong>Virtual Number:</strong> ${esc(v.virtual_number)}</p>
<p>Best regards,<br/>${b}</p>`,
      ),
      text: `Renewal OK ₹${v.amount} ${v.virtual_number}`,
    };
  },

  [TEMPLATE_TYPE.RENEWAL_PAYMENT_SUCCESS_ADMIN]: (v) => {
    const b = esc(v.brand_name);
    const user = esc(v.user);
    return {
      subject: "Customer Renewal Payment Received",
      html: layout(v,
        b,
        `<p>Hello ${user},</p>
<p>Renewal payment received.</p>
<p><strong>Customer:</strong> ${adminCustomerLineEsc(v)}<br/>
<strong>Amount:</strong> ₹${esc(v.amount)}<br/>
<strong>Virtual Number:</strong> ${esc(v.virtual_number)}</p>
<p>Best regards,<br/>${b}</p>`,
      ),
      text: `Renewal from ${v.customer_display_name || v.customer_name}: ₹${v.amount}`,
    };
  },

  [TEMPLATE_TYPE.RENEWAL_PAYMENT_FAILED_CUSTOMER]: (v) => {
    const b = esc(v.brand_name);
    const greet = customerGreetEsc(v);
    return {
      subject: "Renewal Payment Failed",
      html: layout(v,
        b,
        `<p>Hello ${greet},</p>
<p>Your renewal payment could not be completed.</p>
<p><strong>Virtual Number:</strong> ${esc(v.virtual_number)}</p>
<p>Please try again or contact ${esc(v.support_number)} / ${esc(v.support_email)}.</p>
<p>Best regards,<br/>${b}</p>`,
      ),
      text: `Renewal payment failed: ${v.virtual_number}`,
    };
  },

  [TEMPLATE_TYPE.RENEWAL_PAYMENT_FAILED_ADMIN]: (v) => {
    const b = esc(v.brand_name);
    const user = esc(v.user);
    return {
      subject: "Customer Renewal Payment Failed",
      html: layout(v,
        b,
        `<p>Hello ${user},</p>
<p>A renewal payment failed.</p>
<p><strong>Customer:</strong> ${adminCustomerLineEsc(v)}<br/>
<strong>Amount:</strong> ₹${esc(v.amount)}<br/>
<strong>Reason:</strong> ${esc(v.failure_reason)}</p>
<p>Best regards,<br/>${b}</p>`,
      ),
      text: `Renewal failed: ${v.customer_display_name || v.customer_name}`,
    };
  },

  [TEMPLATE_TYPE.OFFLINE_PAYMENT_APPROVED_CUSTOMER]: (v) => {
    const b = esc(v.brand_name);
    const greet = customerGreetEsc(v);
    return {
      subject: "Offline Payment Approved",
      html: layout(v,
        b,
        `<p>Hello ${greet},</p>
<p>Your offline payment has been approved and your virtual number is being activated.</p>
<p><strong>Virtual Number:</strong> ${esc(v.virtual_number)}</p>
<p>Best regards,<br/>${b}</p>`,
      ),
      text: `Offline payment approved: ${v.virtual_number}`,
    };
  },

  [TEMPLATE_TYPE.OFFLINE_PAYMENT_APPROVED_ADMIN]: (v) => {
    const b = esc(v.brand_name);
    const user = esc(v.user);
    return {
      subject: "Offline Payment Approved (Record)",
      html: layout(v,
        b,
        `<p>Hello ${user},</p>
<p>An offline customer payment was approved.</p>
<p><strong>Customer:</strong> ${adminCustomerLineEsc(v)}<br/>
<strong>Virtual Number:</strong> ${esc(v.virtual_number)}<br/>
<strong>Amount:</strong> ₹${esc(v.amount)}</p>
<p>Best regards,<br/>${b}</p>`,
      ),
      text: `Offline approved: ${v.customer_display_name || v.customer_name} ${v.virtual_number}`,
    };
  },

  [TEMPLATE_TYPE.NUMBER_ACTIVATED_ADMIN]: (v) => {
    const b = esc(v.brand_name);
    const user = esc(v.user);
    return {
      subject: "Customer Virtual Number Activated",
      html: layout(v,
        b,
        `<p>Hello ${user},</p>
<p>A virtual number was activated for a customer.</p>
<p><strong>Customer:</strong> ${adminCustomerLineEsc(v)}<br/>
<strong>Virtual Number:</strong> ${esc(v.virtual_number)}<br/>
<strong>Forward:</strong> ${esc(v.forward_number)}<br/>
<strong>Start:</strong> ${esc(v.start_date)}<br/>
<strong>End:</strong> ${esc(v.end_date)}</p>
<p>Best regards,<br/>${b}</p>`,
      ),
      text: `VN activated ${v.virtual_number} for ${v.customer_display_name || v.customer_name}`,
    };
  },

  [TEMPLATE_TYPE.CALL_FORWARD_UPDATED_ADMIN]: (v) => {
    const b = esc(v.brand_name);
    const user = esc(v.user);
    return {
      subject: "Customer Call Forward Updated",
      html: layout(v,
        b,
        `<p>Hello ${user},</p>
<p>Call forwarding was updated for a customer number.</p>
<p><strong>Customer:</strong> ${adminCustomerLineEsc(v)}<br/>
<strong>Virtual Number:</strong> ${esc(v.virtual_number)}<br/>
<strong>New Forward:</strong> ${esc(v.forward_number)}</p>
<p>Best regards,<br/>${b}</p>`,
      ),
      text: `CF updated ${v.virtual_number} → ${v.forward_number}`,
    };
  },

  [TEMPLATE_TYPE.NUMBER_SUSPENDED_ADMIN]: (v) => {
    const b = esc(v.brand_name);
    const user = esc(v.user);
    return {
      subject: "Customer Number Suspended",
      html: layout(v,
        b,
        `<p>Hello ${user},</p>
<p>A customer virtual number was suspended.</p>
<p><strong>Customer:</strong> ${adminCustomerLineEsc(v)}<br/>
<strong>Virtual Number:</strong> ${esc(v.virtual_number)}</p>
<p>Best regards,<br/>${b}</p>`,
      ),
      text: `Suspended ${v.virtual_number}`,
    };
  },

  [TEMPLATE_TYPE.TELECOM_SUSPENSION_SUPER]: (v) => {
    const p = esc(v.platform_name);
    return {
      subject: "Telecom Suspension Alert",
      html: layout(v,
        p,
        `<p>Hello,</p>
<p>A virtual number suspension was flagged as telecom-related.</p>
<p><strong>Virtual Number:</strong> ${esc(v.virtual_number)}<br/>
<strong>Reseller:</strong> ${esc(v.reseller_name)}</p>
<p>Best regards,<br/>${p}</p>`,
      ),
      text: `Telecom suspension: ${v.virtual_number}`,
    };
  },

  [TEMPLATE_TYPE.WALLET_DEBIT_ACTIVATION]: (v) => {
    const b = esc(v.brand_name);
    const user = esc(v.user);
    return {
      subject: "Wallet Debited (Activation)",
      html: layout(v,
        b,
        `<p>Hello ${user},</p>
<p>Your wallet was debited for a customer activation.</p>
<p><strong>Amount:</strong> ₹${esc(v.amount)}<br/>
<strong>Balance after:</strong> ₹${esc(v.balance_after)}</p>
<p>Best regards,<br/>${b}</p>`,
      ),
      text: `Wallet debit activation ₹${v.amount}`,
    };
  },

  [TEMPLATE_TYPE.WALLET_DEBIT_RENEWAL]: (v) => {
    const b = esc(v.brand_name);
    const user = esc(v.user);
    return {
      subject: "Wallet Debited (Renewal)",
      html: layout(v,
        b,
        `<p>Hello ${user},</p>
<p>Your wallet was debited for a customer renewal.</p>
<p><strong>Amount:</strong> ₹${esc(v.amount)}<br/>
<strong>Balance after:</strong> ₹${esc(v.balance_after)}</p>
<p>Best regards,<br/>${b}</p>`,
      ),
      text: `Wallet debit renewal ₹${v.amount}`,
    };
  },

  [TEMPLATE_TYPE.WALLET_TOPUP_REQUEST_SUPER]: (v) => {
    const p = esc(v.platform_name);
    return {
      subject: "Wallet Top-Up Request",
      html: layout(v,
        p,
        `<p>Hello,</p>
<p>A reseller has requested a wallet top-up.</p>
<p><strong>Reseller:</strong> ${esc(v.reseller_name)}<br/>
<strong>Amount:</strong> ₹${esc(v.amount)}</p>
<p>Best regards,<br/>${p}</p>`,
      ),
      text: `Top-up request: ${v.reseller_name} ₹${v.amount}`,
    };
  },

  [TEMPLATE_TYPE.WALLET_TOPUP_APPROVED]: (v) => {
    const p = esc(v.platform_name);
    const user = esc(v.user);
    return {
      subject: "Wallet Top-Up Approved",
      html: layout(v,
        p,
        `<p>Hello ${user},</p>
<p>Your wallet top-up request was approved.</p>
<p><strong>Amount:</strong> ₹${esc(v.amount)}</p>
<p>Best regards,<br/>${p}</p>`,
      ),
      text: `Top-up approved ₹${v.amount}`,
    };
  },

  [TEMPLATE_TYPE.WALLET_TOPUP_REJECTED]: (v) => {
    const p = esc(v.platform_name);
    const user = esc(v.user);
    return {
      subject: "Wallet Top-Up Rejected",
      html: layout(v,
        p,
        `<p>Hello ${user},</p>
<p>Your wallet top-up request was rejected.</p>
<p><strong>Reason:</strong> ${esc(v.reason)}</p>
<p>Best regards,<br/>${p}</p>`,
      ),
      text: `Top-up rejected: ${v.reason}`,
    };
  },

  [TEMPLATE_TYPE.LOW_WALLET_BALANCE]: (v) => {
    const p = esc(v.platform_name);
    const user = esc(v.user);
    const bal =
      v.balance != null && v.balance !== ""
        ? `<p><strong>Current balance:</strong> ₹${esc(v.balance)}</p>`
        : "";
    const thr =
      v.threshold != null && v.threshold !== ""
        ? `<p><strong>Alert threshold:</strong> ₹${esc(v.threshold)}</p>`
        : "";
    return {
      subject: "Low Wallet Balance Alert",
      html: layout(v,
        p,
        `<p>Hello ${user},</p>
<p>Your wallet balance is low.</p>
${bal}${thr}
<p>This may affect new activations and renewals.</p>
<p>Please recharge to continue using services without interruption.</p>
<p>Best regards,<br/>${p}</p>`,
      ),
      text: `Low wallet balance: ${v.user}`,
    };
  },

  [TEMPLATE_TYPE.WALLET_CREDIT_APPROVED]: (v) => {
    const p = esc(v.platform_name);
    const user = esc(v.user);
    return {
      subject: "Wallet Credit Successful",
      html: layout(v,
        p,
        `<p>Hello ${user},</p>
<p>Your wallet has been successfully credited.</p>
<p><strong>Amount:</strong> ₹${esc(v.amount)}<br/><strong>Expiry Date:</strong> ${esc(v.date)}</p>
<p>Best regards,<br/>${p}</p>`,
      ),
      text: `Wallet credited ₹${v.amount}`,
    };
  },

  [TEMPLATE_TYPE.NEW_LOGIN_DETECTED]: (v) => {
    const b = esc(v.brand_name);
    const user = esc(v.user);
    return {
      subject: "New Login Detected",
      html: layout(v,
        b,
        `<p>Hello ${user},</p>
<p>A new login was detected on your account.</p>
<p><strong>IP Address:</strong> ${esc(v.ip_address)}<br/><strong>Location:</strong> ${esc(v.location)}</p>
<p>If this was not you, contact support immediately at ${esc(v.support_number)}.</p>
<p>Best regards,<br/>${b}</p>`,
      ),
      text: `New login from ${v.ip_address}`,
    };
  },

  [TEMPLATE_TYPE.MAINTENANCE_ENABLED_ADMIN]: (v) => {
    const p = esc(v.platform_name);
    const user = esc(v.user);
    return {
      subject: "Scheduled Maintenance Notification",
      html: layout(v,
        p,
        `<p>Hello ${user},</p>
<p>The system is currently under maintenance.</p>
<p>Some services may be temporarily unavailable.</p>
<p>We will notify you once the system is fully operational.</p>
<p>Best regards,<br/>${p}</p>`,
      ),
      text: `Maintenance mode: ${p}`,
    };
  },

  [TEMPLATE_TYPE.MAINTENANCE_DISABLED_ADMIN]: (v) => {
    const p = esc(v.platform_name);
    const user = esc(v.user);
    return {
      subject: "Maintenance Completed",
      html: layout(v,
        p,
        `<p>Hello ${user},</p>
<p>Maintenance mode has been disabled and services should be available as usual.</p>
<p>Best regards,<br/>${p}</p>`,
      ),
      text: `Maintenance disabled: ${p}`,
    };
  },
};

/**
 * @param {string} templateType
 * @returns {((vars: object) => { subject: string, html: string, text: string })|null}
 */
export function getDefaultTransactionalTemplate(templateType) {
  return DEFAULTS[templateType] || null;
}
