import nodemailer from "nodemailer";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { getHasuraClient } from "../config/hasura.client.js";
import { getResellerSmtpConfig } from "./smtpConfig.service.js";
import { getFirstAdminSmtpConfig } from "./smtpConfig.service.js";
import { resolveTransactionalEmail } from "./emailTemplateResolver.js";
import { TEMPLATE_TYPE } from "../../mailtemplate/emailTemplateRegistry.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../.env") });

const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
const SMTP_FROM_EMAIL = process.env.SMTP_FROM_EMAIL || SMTP_USER;
const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || "Virtual Number";

export const PLATFORM_NAME =
  process.env.PLATFORM_NAME || "Virtual Number India";
export const PLATFORM_SUPPORT_NUMBER =
  process.env.PLATFORM_SUPPORT_NUMBER || "";
export const PLATFORM_SUPPORT_EMAIL =
  process.env.PLATFORM_SUPPORT_EMAIL || "";

function resellerDisplayName(r) {
  if (!r) return "Team";
  return (
    r.brand_name ||
    r.business_name ||
    `${r.first_name || ""} ${r.last_name || ""}`.trim() ||
    r.email ||
    "Team"
  );
}

function createTransporter(smtpConfig = null) {
  const host = smtpConfig?.host || SMTP_HOST;
  const port = smtpConfig?.port || SMTP_PORT;
  const username = smtpConfig?.username || SMTP_USER;
  const password = smtpConfig?.password || SMTP_PASSWORD;
  if (!username || !password) return null;
  if (host.includes("gmail.com")) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: { user: username, pass: password },
    });
  }
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user: username, pass: password },
  });
}

function senderFromConfig(smtpConfig, brandFallback) {
  const fromEmail =
    smtpConfig?.from_email || SMTP_FROM_EMAIL || smtpConfig?.username || SMTP_USER;
  const fromName =
    smtpConfig?.from_name ||
    (brandFallback ? String(brandFallback).trim() : "") ||
    SMTP_FROM_NAME;
  return { fromEmail, fromName };
}

/**
 * @returns {Promise<{ success: boolean, message?: string }>}
 */
export async function sendTemplatedEmail({
  to,
  smtpConfig,
  templateType,
  variables,
  context = {},
  brandFallback = null,
}) {
  if (!to || !templateType) {
    return { success: false, message: "Missing to or templateType" };
  }
  const content = await resolveTransactionalEmail(
    templateType,
    variables,
    context,
  );
  if (!content?.subject || !content?.html) {
    return { success: false, message: "Template not found" };
  }
  const transporter = createTransporter(smtpConfig);
  if (!transporter) {
    return { success: false, message: "SMTP not configured" };
  }
  const { fromEmail, fromName } = senderFromConfig(smtpConfig, brandFallback);
  if (!fromEmail) {
    return { success: false, message: "From email missing" };
  }
  try {
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject: content.subject,
      html: content.html,
      text: content.text || undefined,
    });
    return { success: true };
  } catch (e) {
    console.error("[transactionalEmail]", templateType, e.message);
    return { success: false, message: e.message };
  }
}

export async function fetchResellerBrandingForOtp(resellerId) {
  if (!resellerId) return null;
  try {
    const client = getHasuraClient();
    const d = await client.client.request(
      `query R($id: uuid!) {
        mst_reseller_by_pk(id: $id) {
          brand_name business_name first_name last_name email
          support_number support_email
        }
      }`,
      { id: resellerId },
    );
    const r = d.mst_reseller_by_pk;
    if (!r) return null;
    return {
      brand_name: resellerDisplayName(r),
      support_number: r.support_number || PLATFORM_SUPPORT_NUMBER,
      support_email: r.support_email || PLATFORM_SUPPORT_EMAIL,
    };
  } catch (e) {
    console.warn("[fetchResellerBrandingForOtp]", e.message);
    return null;
  }
}

export async function fetchVirtualNumberEmailContext(virtualNumber, resellerId) {
  const client = getHasuraClient();
  const q = `
    query VnEmailCtx($vn: String!, $rid: uuid!) {
      mst_virtual_number(
        where: {
          virtual_number: { _eq: $vn }
          reseller_id: { _eq: $rid }
        }
        limit: 1
      ) {
        virtual_number
        call_forwarding_number
        purchase_date
        expiry_date
        mst_customer {
          email
          profile_name
        }
        mst_reseller {
          brand_name
          business_name
          support_number
          support_email
          first_name
          last_name
          email
          phone
        }
      }
    }
  `;
  try {
    const data = await client.client.request(q, {
      vn: virtualNumber,
      rid: resellerId,
    });
    return data.mst_virtual_number?.[0] || null;
  } catch (e) {
    console.warn("[fetchVirtualNumberEmailContext]", e.message);
    return null;
  }
}

/** Call forward / suspend notifications (best-effort). */
export async function notifyCallForwardUpdated(
  virtualNumber,
  forwardValue,
  resellerId,
) {
  const row = await fetchVirtualNumberEmailContext(virtualNumber, resellerId);
  const cust = row?.mst_customer;
  const res = row?.mst_reseller;
  if (!cust?.email) return { success: false, message: "No customer email" };
  const brand = resellerDisplayName(res);
  const smtp = await getResellerSmtpConfig(resellerId);
  const out = await sendTemplatedEmail({
    to: cust.email,
    smtpConfig: smtp,
    templateType: TEMPLATE_TYPE.CALL_FORWARD_UPDATED,
    variables: {
      user: cust.profile_name || cust.email,
      forward_number: forwardValue,
      brand_name: brand,
    },
    context: { resellerId },
    brandFallback: brand,
  });
  if (res?.email) {
    try {
      await sendTemplatedEmail({
        to: res.email,
        smtpConfig: smtp,
        templateType: TEMPLATE_TYPE.CALL_FORWARD_UPDATED_ADMIN,
        variables: {
          user: brand,
          customer_name: cust.profile_name || cust.email,
          virtual_number: virtualNumber,
          forward_number: forwardValue,
          brand_name: brand,
        },
        context: { resellerId },
        brandFallback: brand,
      });
    } catch (e) {
      console.warn("[notifyCallForwardUpdated] admin email skipped:", e.message);
    }
  }
  return out;
}

export async function notifyNumberSuspended(virtualNumber, resellerId) {
  const row = await fetchVirtualNumberEmailContext(virtualNumber, resellerId);
  const cust = row?.mst_customer;
  const res = row?.mst_reseller;
  if (!cust?.email) return { success: false, message: "No customer email" };
  const brand = resellerDisplayName(res);
  const smtp = await getResellerSmtpConfig(resellerId);
  const out = await sendTemplatedEmail({
    to: cust.email,
    smtpConfig: smtp,
    templateType: TEMPLATE_TYPE.NUMBER_SUSPENDED,
    variables: {
      user: cust.profile_name || cust.email,
      virtual_number: virtualNumber,
      support_number: res?.support_number || PLATFORM_SUPPORT_NUMBER,
      brand_name: brand,
    },
    context: { resellerId },
    brandFallback: brand,
  });
  if (res?.email) {
    try {
      await sendTemplatedEmail({
        to: res.email,
        smtpConfig: smtp,
        templateType: TEMPLATE_TYPE.NUMBER_SUSPENDED_ADMIN,
        variables: {
          user: brand,
          customer_name: cust.profile_name || cust.email,
          virtual_number: virtualNumber,
          brand_name: brand,
        },
        context: { resellerId },
        brandFallback: brand,
      });
    } catch (e) {
      console.warn("[notifyNumberSuspended] admin email skipped:", e.message);
    }
  }
  return out;
}

export async function sendPaymentSuccessCustomerEmail({
  customerEmail,
  customerName,
  amountRupees,
  transactionRef,
  resellerId,
}) {
  const smtp = await getResellerSmtpConfig(resellerId);
  const client = getHasuraClient();
  let brand = "Team";
  let support_number = PLATFORM_SUPPORT_NUMBER;
  let support_email = PLATFORM_SUPPORT_EMAIL;
  try {
    const q = `query R($id: uuid!) {
      mst_reseller_by_pk(id: $id) {
        brand_name business_name first_name last_name email
        support_number support_email
      }
    }`;
    const d = await client.client.request(q, { id: resellerId });
    const r = d.mst_reseller_by_pk;
    if (r) {
      brand = resellerDisplayName(r);
      support_number = r.support_number || support_number;
      support_email = r.support_email || support_email;
    }
  } catch (_) {}
  return sendTemplatedEmail({
    to: customerEmail,
    smtpConfig: smtp,
    templateType: TEMPLATE_TYPE.PAYMENT_SUCCESS_CUSTOMER,
    variables: {
      user: customerName || customerEmail,
      amount: String(amountRupees),
      transaction_id: String(transactionRef || ""),
      brand_name: brand,
    },
    context: { resellerId },
    brandFallback: brand,
  });
}

export async function sendPaymentSuccessAdminEmail({
  resellerEmail,
  resellerDisplay,
  customerName,
  amountRupees,
  resellerId,
}) {
  const smtp = await getResellerSmtpConfig(resellerId);
  const brand = resellerDisplay || "Team";
  return sendTemplatedEmail({
    to: resellerEmail,
    smtpConfig: smtp,
    templateType: TEMPLATE_TYPE.PAYMENT_SUCCESS_ADMIN,
    variables: {
      user: resellerDisplay || resellerEmail,
      customer_name: customerName,
      amount: String(amountRupees),
      brand_name: brand,
    },
    context: { resellerId },
    brandFallback: brand,
  });
}

export async function sendPaymentFailedCustomerEmail({
  customerEmail,
  customerName,
  resellerId,
}) {
  const smtp = await getResellerSmtpConfig(resellerId);
  const client = getHasuraClient();
  let brand = "Team";
  let support_number = PLATFORM_SUPPORT_NUMBER;
  let support_email = PLATFORM_SUPPORT_EMAIL;
  try {
    const q = `query R($id: uuid!) {
      mst_reseller_by_pk(id: $id) {
        brand_name business_name first_name last_name email
        support_number support_email
      }
    }`;
    const d = await client.client.request(q, { id: resellerId });
    const r = d.mst_reseller_by_pk;
    if (r) {
      brand = resellerDisplayName(r);
      support_number = r.support_number || support_number;
      support_email = r.support_email || support_email;
    }
  } catch (_) {}
  return sendTemplatedEmail({
    to: customerEmail,
    smtpConfig: smtp,
    templateType: TEMPLATE_TYPE.PAYMENT_FAILED,
    variables: {
      user: customerName || customerEmail,
      support_number,
      support_email,
      brand_name: brand,
    },
    context: { resellerId },
    brandFallback: brand,
  });
}

export async function sendCustomerKycApprovedEmail({
  customerEmail,
  customerName,
  reseller,
  resellerId,
  smtpConfig,
}) {
  const brand = resellerDisplayName(reseller);
  const admin_phone = reseller?.phone || reseller?.support_number || "";
  const admin_email = reseller?.email || "";
  return sendTemplatedEmail({
    to: customerEmail,
    smtpConfig,
    templateType: TEMPLATE_TYPE.CUSTOMER_KYC_APPROVED,
    variables: {
      user: customerName || customerEmail,
      admin_phone,
      admin_email,
      support_number: reseller?.support_number || PLATFORM_SUPPORT_NUMBER,
      support_email: reseller?.support_email || PLATFORM_SUPPORT_EMAIL,
      brand_name: brand,
    },
    context: { resellerId },
    brandFallback: brand,
  });
}

export async function sendNewLoginAlertEmail({
  toEmail,
  userName,
  userType,
  ipAddress,
  location,
  resellerId,
}) {
  const smtp =
    userType === "admin"
      ? await getFirstAdminSmtpConfig()
      : resellerId
        ? await getResellerSmtpConfig(resellerId)
        : await getFirstAdminSmtpConfig();
  const brand =
    userType === "admin" ? PLATFORM_NAME : userName || PLATFORM_NAME;
  const support =
    userType === "admin"
      ? PLATFORM_SUPPORT_NUMBER
      : PLATFORM_SUPPORT_NUMBER;
  return sendTemplatedEmail({
    to: toEmail,
    smtpConfig: smtp,
    templateType: TEMPLATE_TYPE.NEW_LOGIN_DETECTED,
    variables: {
      user: userName || toEmail,
      ip_address: ipAddress || "Unknown",
      location: location || "Unknown",
      support_number: support,
      brand_name: brand,
    },
    context: userType === "admin" ? {} : { resellerId },
    brandFallback: brand,
  });
}

/** Exported for cron / jobs (30 / 15 / 7-day reminders). WhatsApp: 30d and 7d per spec. */
export async function sendExpiryReminderEmail({
  customerEmail,
  customerName,
  virtualNumber,
  resellerId,
  days,
  customerPhone = null,
}) {
  const smtp = await getResellerSmtpConfig(resellerId);
  const client = getHasuraClient();
  let brand = "Team";
  try {
    const d = await client.client.request(
      `query R($id: uuid!) { mst_reseller_by_pk(id: $id) { brand_name business_name first_name last_name email } }`,
      { id: resellerId },
    );
    const r = d.mst_reseller_by_pk;
    if (r) brand = resellerDisplayName(r);
  } catch (_) {}
  const dNum = Number(days) || 30;
  const type =
    dNum <= 7
      ? TEMPLATE_TYPE.EXPIRY_REMINDER_7D
      : dNum <= 15
        ? TEMPLATE_TYPE.EXPIRY_REMINDER_15D
        : TEMPLATE_TYPE.EXPIRY_REMINDER_30D;
  const emailResult = await sendTemplatedEmail({
    to: customerEmail,
    smtpConfig: smtp,
    templateType: type,
    variables: {
      user: customerName || customerEmail,
      virtual_number: virtualNumber,
      brand_name: brand,
    },
    context: { resellerId },
    brandFallback: brand,
  });
  const sendWa = [30, 7].includes(Math.round(dNum));
  if (customerPhone && sendWa) {
    try {
      const { notifyCustomerExpiryReminderWhatsApp } = await import(
        "./transactionalWhatsApp.service.js"
      );
      await notifyCustomerExpiryReminderWhatsApp({
        phone: customerPhone,
        virtualNumber,
        brandName: brand,
        resellerId,
        days: dNum,
      });
    } catch (e) {
      console.warn("[sendExpiryReminderEmail] WhatsApp skipped:", e.message);
    }
  }
  return emailResult;
}

/** Platform → reseller / admin (wallet low). Uses first admin SMTP. */
export async function sendLowWalletBalanceEmail(
  toEmail,
  userName,
  balance = "",
  threshold = "",
) {
  const smtp = await getFirstAdminSmtpConfig();
  return sendTemplatedEmail({
    to: toEmail,
    smtpConfig: smtp,
    templateType: TEMPLATE_TYPE.LOW_WALLET_BALANCE,
    variables: {
      user: userName || toEmail,
      platform_name: PLATFORM_NAME,
      balance: balance !== "" && balance != null ? String(balance) : "",
      threshold:
        threshold !== "" && threshold != null ? String(threshold) : "",
    },
    context: {},
    brandFallback: PLATFORM_NAME,
  });
}

export async function sendWalletCreditApprovedEmail(toEmail, userName, amount, dateStr) {
  const smtp = await getFirstAdminSmtpConfig();
  return sendTemplatedEmail({
    to: toEmail,
    smtpConfig: smtp,
    templateType: TEMPLATE_TYPE.WALLET_CREDIT_APPROVED,
    variables: {
      user: userName || toEmail,
      amount: String(amount),
      date: dateStr || "",
      platform_name: PLATFORM_NAME,
    },
    context: {},
    brandFallback: PLATFORM_NAME,
  });
}

export async function sendMaintenanceEnabledAdminEmail(toEmail, userName) {
  const smtp = await getFirstAdminSmtpConfig();
  return sendTemplatedEmail({
    to: toEmail,
    smtpConfig: smtp,
    templateType: TEMPLATE_TYPE.MAINTENANCE_ENABLED_ADMIN,
    variables: {
      user: userName || toEmail,
      platform_name: PLATFORM_NAME,
    },
    context: {},
    brandFallback: PLATFORM_NAME,
  });
}

export async function sendMaintenanceDisabledAdminEmail(toEmail, userName) {
  const smtp = await getFirstAdminSmtpConfig();
  return sendTemplatedEmail({
    to: toEmail,
    smtpConfig: smtp,
    templateType: TEMPLATE_TYPE.MAINTENANCE_DISABLED_ADMIN,
    variables: {
      user: userName || toEmail,
      platform_name: PLATFORM_NAME,
    },
    context: {},
    brandFallback: PLATFORM_NAME,
  });
}

export async function fetchActiveSuperAdminEmails() {
  try {
    const client = getHasuraClient();
    const d = await client.client.request(`query {
      mst_super_admin(where: { status: { _eq: true } }) { email }
    }`);
    const rows = d.mst_super_admin || [];
    return rows.map((r) => r.email).filter(Boolean);
  } catch (e) {
    console.warn("[fetchActiveSuperAdminEmails]", e.message);
    return [];
  }
}

export async function notifyTelecomSuspensionSuper({
  virtualNumber,
  resellerId,
  resellerName: resellerNameOpt = null,
}) {
  let resellerName = resellerNameOpt || "";
  if (!resellerName && resellerId) {
    try {
      const client = getHasuraClient();
      const d = await client.client.request(
        `query R($id: uuid!) {
          mst_reseller_by_pk(id: $id) {
            brand_name business_name first_name last_name email
          }
        }`,
        { id: resellerId },
      );
      const r = d.mst_reseller_by_pk;
      if (r) resellerName = resellerDisplayName(r);
    } catch (_) {}
  }
  const emails = await fetchActiveSuperAdminEmails();
  if (!emails.length) return { success: false, message: "No super admin emails" };
  const smtp = await getFirstAdminSmtpConfig();
  for (const to of emails) {
    await sendTemplatedEmail({
      to,
      smtpConfig: smtp,
      templateType: TEMPLATE_TYPE.TELECOM_SUSPENSION_SUPER,
      variables: {
        user: "Team",
        virtual_number: virtualNumber,
        reseller_name: resellerName || "",
        platform_name: PLATFORM_NAME,
      },
      context: {},
      brandFallback: PLATFORM_NAME,
    });
  }
  return { success: true };
}

export async function sendPaymentFailedAdminEmail({
  resellerEmail,
  resellerDisplay,
  customerName,
  amountRupees,
  failureReason,
  resellerId,
}) {
  if (!resellerEmail) return { success: false, message: "No reseller email" };
  const smtp = await getResellerSmtpConfig(resellerId);
  const brand = resellerDisplay || "Team";
  return sendTemplatedEmail({
    to: resellerEmail,
    smtpConfig: smtp,
    templateType: TEMPLATE_TYPE.PAYMENT_FAILED_ADMIN,
    variables: {
      user: resellerDisplay || resellerEmail,
      customer_name: customerName || "",
      amount: String(amountRupees ?? ""),
      failure_reason: failureReason || "Unknown",
      brand_name: brand,
    },
    context: { resellerId },
    brandFallback: brand,
  });
}

export async function sendNumberActivatedAdminEmail({
  resellerEmail,
  resellerDisplay,
  customerName,
  virtualNumber,
  forwardNumber,
  startDate,
  endDate,
  resellerId,
}) {
  if (!resellerEmail) return { success: false, message: "No reseller email" };
  const smtp = await getResellerSmtpConfig(resellerId);
  const brand = resellerDisplay || "Team";
  return sendTemplatedEmail({
    to: resellerEmail,
    smtpConfig: smtp,
    templateType: TEMPLATE_TYPE.NUMBER_ACTIVATED_ADMIN,
    variables: {
      user: resellerDisplay || resellerEmail,
      customer_name: customerName || "",
      virtual_number: virtualNumber,
      forward_number: forwardNumber || "",
      start_date: startDate || "",
      end_date: endDate || "",
      brand_name: brand,
    },
    context: { resellerId },
    brandFallback: brand,
  });
}

export async function sendWalletDebitNotificationEmail({
  resellerEmail,
  resellerDisplay,
  amount,
  balanceAfter,
  resellerId,
  kind,
}) {
  if (!resellerEmail) return { success: false, message: "No reseller email" };
  const smtp = await getResellerSmtpConfig(resellerId);
  const brand = resellerDisplay || "Team";
  const templateType =
    kind === "renewal"
      ? TEMPLATE_TYPE.WALLET_DEBIT_RENEWAL
      : TEMPLATE_TYPE.WALLET_DEBIT_ACTIVATION;
  return sendTemplatedEmail({
    to: resellerEmail,
    smtpConfig: smtp,
    templateType,
    variables: {
      user: resellerDisplay || resellerEmail,
      amount: String(amount ?? ""),
      balance_after: String(balanceAfter ?? ""),
      brand_name: brand,
    },
    context: { resellerId },
    brandFallback: brand,
  });
}

export async function sendRenewalPaymentSuccessCustomerEmail({
  customerEmail,
  customerName,
  amountRupees,
  transactionRef,
  virtualNumber,
  resellerId,
}) {
  const smtp = await getResellerSmtpConfig(resellerId);
  let brand = "Team";
  try {
    const client = getHasuraClient();
    const d = await client.client.request(
      `query R($id: uuid!) { mst_reseller_by_pk(id: $id) { brand_name business_name first_name last_name email } }`,
      { id: resellerId },
    );
    const r = d.mst_reseller_by_pk;
    if (r) brand = resellerDisplayName(r);
  } catch (_) {}
  return sendTemplatedEmail({
    to: customerEmail,
    smtpConfig: smtp,
    templateType: TEMPLATE_TYPE.RENEWAL_PAYMENT_SUCCESS_CUSTOMER,
    variables: {
      user: customerName || customerEmail,
      amount: String(amountRupees),
      transaction_id: String(transactionRef || ""),
      virtual_number: virtualNumber || "",
      brand_name: brand,
    },
    context: { resellerId },
    brandFallback: brand,
  });
}

export async function sendRenewalPaymentSuccessAdminEmail({
  resellerEmail,
  resellerDisplay,
  customerName,
  amountRupees,
  virtualNumber,
  resellerId,
}) {
  if (!resellerEmail) return { success: false, message: "No reseller email" };
  const smtp = await getResellerSmtpConfig(resellerId);
  const brand = resellerDisplay || "Team";
  return sendTemplatedEmail({
    to: resellerEmail,
    smtpConfig: smtp,
    templateType: TEMPLATE_TYPE.RENEWAL_PAYMENT_SUCCESS_ADMIN,
    variables: {
      user: resellerDisplay || resellerEmail,
      customer_name: customerName || "",
      amount: String(amountRupees),
      virtual_number: virtualNumber || "",
      brand_name: brand,
    },
    context: { resellerId },
    brandFallback: brand,
  });
}

export async function sendRenewalPaymentFailedCustomerEmail({
  customerEmail,
  customerName,
  virtualNumber,
  resellerId,
}) {
  const smtp = await getResellerSmtpConfig(resellerId);
  let brand = "Team";
  let support_number = PLATFORM_SUPPORT_NUMBER;
  let support_email = PLATFORM_SUPPORT_EMAIL;
  try {
    const client = getHasuraClient();
    const d = await client.client.request(
      `query R($id: uuid!) { mst_reseller_by_pk(id: $id) { brand_name business_name first_name last_name email support_number support_email } }`,
      { id: resellerId },
    );
    const r = d.mst_reseller_by_pk;
    if (r) {
      brand = resellerDisplayName(r);
      support_number = r.support_number || support_number;
      support_email = r.support_email || support_email;
    }
  } catch (_) {}
  return sendTemplatedEmail({
    to: customerEmail,
    smtpConfig: smtp,
    templateType: TEMPLATE_TYPE.RENEWAL_PAYMENT_FAILED_CUSTOMER,
    variables: {
      user: customerName || customerEmail,
      virtual_number: virtualNumber || "",
      support_number,
      support_email,
      brand_name: brand,
    },
    context: { resellerId },
    brandFallback: brand,
  });
}

export async function sendRenewalPaymentFailedAdminEmail({
  resellerEmail,
  resellerDisplay,
  customerName,
  amountRupees,
  failureReason,
  resellerId,
}) {
  if (!resellerEmail) return { success: false, message: "No reseller email" };
  const smtp = await getResellerSmtpConfig(resellerId);
  const brand = resellerDisplay || "Team";
  return sendTemplatedEmail({
    to: resellerEmail,
    smtpConfig: smtp,
    templateType: TEMPLATE_TYPE.RENEWAL_PAYMENT_FAILED_ADMIN,
    variables: {
      user: resellerDisplay || resellerEmail,
      customer_name: customerName || "",
      amount: String(amountRupees ?? ""),
      failure_reason: failureReason || "Unknown",
      brand_name: brand,
    },
    context: { resellerId },
    brandFallback: brand,
  });
}

export async function sendOfflinePaymentApprovedCustomerEmail({
  customerEmail,
  customerName,
  virtualNumber,
  resellerId,
}) {
  const smtp = await getResellerSmtpConfig(resellerId);
  let brand = "Team";
  try {
    const client = getHasuraClient();
    const d = await client.client.request(
      `query R($id: uuid!) { mst_reseller_by_pk(id: $id) { brand_name business_name first_name last_name email } }`,
      { id: resellerId },
    );
    const r = d.mst_reseller_by_pk;
    if (r) brand = resellerDisplayName(r);
  } catch (_) {}
  return sendTemplatedEmail({
    to: customerEmail,
    smtpConfig: smtp,
    templateType: TEMPLATE_TYPE.OFFLINE_PAYMENT_APPROVED_CUSTOMER,
    variables: {
      user: customerName || customerEmail,
      virtual_number: virtualNumber || "",
      brand_name: brand,
    },
    context: { resellerId },
    brandFallback: brand,
  });
}

export async function sendOfflinePaymentApprovedAdminEmail({
  resellerEmail,
  resellerDisplay,
  customerName,
  virtualNumber,
  amount,
  resellerId,
}) {
  if (!resellerEmail) return { success: false, message: "No reseller email" };
  const smtp = await getResellerSmtpConfig(resellerId);
  const brand = resellerDisplay || "Team";
  return sendTemplatedEmail({
    to: resellerEmail,
    smtpConfig: smtp,
    templateType: TEMPLATE_TYPE.OFFLINE_PAYMENT_APPROVED_ADMIN,
    variables: {
      user: resellerDisplay || resellerEmail,
      customer_name: customerName || "",
      virtual_number: virtualNumber || "",
      amount: String(amount ?? ""),
      brand_name: brand,
    },
    context: { resellerId },
    brandFallback: brand,
  });
}

export async function sendWalletTopUpRequestSuperEmail({
  resellerName,
  amount,
}) {
  const emails = await fetchActiveSuperAdminEmails();
  if (!emails.length) return { success: false, message: "No super admin emails" };
  const smtp = await getFirstAdminSmtpConfig();
  for (const to of emails) {
    await sendTemplatedEmail({
      to,
      smtpConfig: smtp,
      templateType: TEMPLATE_TYPE.WALLET_TOPUP_REQUEST_SUPER,
      variables: {
        user: "Team",
        amount: String(amount ?? ""),
        reseller_name: resellerName || "",
        platform_name: PLATFORM_NAME,
      },
      context: {},
      brandFallback: PLATFORM_NAME,
    });
  }
  return { success: true };
}

export async function sendWalletTopUpApprovedEmail(toEmail, userName, amount) {
  const smtp = await getFirstAdminSmtpConfig();
  return sendTemplatedEmail({
    to: toEmail,
    smtpConfig: smtp,
    templateType: TEMPLATE_TYPE.WALLET_TOPUP_APPROVED,
    variables: {
      user: userName || toEmail,
      amount: String(amount ?? ""),
      platform_name: PLATFORM_NAME,
    },
    context: {},
    brandFallback: PLATFORM_NAME,
  });
}

export async function sendWalletTopUpRejectedEmail(
  toEmail,
  userName,
  reason,
) {
  const smtp = await getFirstAdminSmtpConfig();
  return sendTemplatedEmail({
    to: toEmail,
    smtpConfig: smtp,
    templateType: TEMPLATE_TYPE.WALLET_TOPUP_REJECTED,
    variables: {
      user: userName || toEmail,
      reason: reason || "",
      platform_name: PLATFORM_NAME,
    },
    context: {},
    brandFallback: PLATFORM_NAME,
  });
}

/**
 * After wallet debit: optional low-balance email + WhatsApp to reseller.
 */
export async function maybeNotifyResellerLowWallet({
  resellerId,
  balanceAfter,
  resellerEmail,
  resellerDisplay,
  resellerPhone,
}) {
  const threshold = Number(process.env.LOW_WALLET_BALANCE_THRESHOLD_RUPEES || 0);
  if (!threshold || balanceAfter > threshold) return;
  const name = resellerDisplay || resellerEmail || "Reseller";
  try {
    if (resellerEmail) {
      await sendLowWalletBalanceEmail(
        resellerEmail,
        name,
        String(balanceAfter),
        String(threshold),
      );
    }
  } catch (e) {
    console.warn("[maybeNotifyResellerLowWallet] email", e.message);
  }
  if (resellerPhone) {
    try {
      const { notifyResellerLowWalletWhatsApp } = await import(
        "./transactionalWhatsApp.service.js"
      );
      await notifyResellerLowWalletWhatsApp({
        phone: resellerPhone,
        balance: String(balanceAfter),
        threshold: String(threshold),
        platformName: PLATFORM_NAME,
        resellerId,
      });
    } catch (e) {
      console.warn("[maybeNotifyResellerLowWallet] wa", e.message);
    }
  }
}

export async function sendAdminKycSubmittedSuperEmail(superAdminEmail, adminName, adminEmail) {
  const smtp = await getFirstAdminSmtpConfig();
  return sendTemplatedEmail({
    to: superAdminEmail,
    smtpConfig: smtp,
    templateType: TEMPLATE_TYPE.ADMIN_KYC_SUBMITTED_SUPER,
    variables: {
      user: adminName,
      email: adminEmail,
      platform_name: PLATFORM_NAME,
    },
    context: {},
    brandFallback: PLATFORM_NAME,
  });
}

export async function sendAdminKycApprovedEmail(toEmail, userName) {
  const smtp = await getFirstAdminSmtpConfig();
  return sendTemplatedEmail({
    to: toEmail,
    smtpConfig: smtp,
    templateType: TEMPLATE_TYPE.ADMIN_KYC_APPROVED,
    variables: { user: userName, platform_name: PLATFORM_NAME },
    context: {},
    brandFallback: PLATFORM_NAME,
  });
}

export async function sendAdminKycRejectedEmail(toEmail, userName, reason) {
  const smtp = await getFirstAdminSmtpConfig();
  return sendTemplatedEmail({
    to: toEmail,
    smtpConfig: smtp,
    templateType: TEMPLATE_TYPE.ADMIN_KYC_REJECTED,
    variables: {
      user: userName,
      rejection_reason: reason || "",
      support_number: PLATFORM_SUPPORT_NUMBER,
      support_email: PLATFORM_SUPPORT_EMAIL,
      platform_name: PLATFORM_NAME,
    },
    context: {},
    brandFallback: PLATFORM_NAME,
  });
}

export async function sendAdminAccountDeactivatedEmail(toEmail, userName) {
  const smtp = await getFirstAdminSmtpConfig();
  return sendTemplatedEmail({
    to: toEmail,
    smtpConfig: smtp,
    templateType: TEMPLATE_TYPE.ADMIN_ACCOUNT_DEACTIVATED,
    variables: {
      user: userName,
      support_number: PLATFORM_SUPPORT_NUMBER,
      support_email: PLATFORM_SUPPORT_EMAIL,
      platform_name: PLATFORM_NAME,
    },
    context: {},
    brandFallback: PLATFORM_NAME,
  });
}

export async function sendCustomerKycSubmittedAdminEmail({
  resellerEmail,
  resellerName,
  customerName,
  customerEmail,
  resellerId,
}) {
  const smtp = await getResellerSmtpConfig(resellerId);
  const brand = resellerName || "Team";
  return sendTemplatedEmail({
    to: resellerEmail,
    smtpConfig: smtp,
    templateType: TEMPLATE_TYPE.CUSTOMER_KYC_SUBMITTED_ADMIN,
    variables: {
      user: resellerName || resellerEmail,
      customer_name: customerName,
      customer_email: customerEmail,
      brand_name: brand,
    },
    context: { resellerId },
    brandFallback: brand,
  });
}

export { TEMPLATE_TYPE };
