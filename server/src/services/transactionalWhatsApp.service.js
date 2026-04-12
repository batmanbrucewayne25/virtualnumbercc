/**
 * Best-effort WhatsApp for transactional flows (payment link, VN activation, expiry, low wallet).
 * Uses the same Meta app resolution as OTP (reseller → admin → env).
 * Templates are optional via WHATSAPP_TEMPLATE_* env; otherwise tries plain text (24h window only).
 */
import axios from "axios";
import { resolveWhatsAppConfigForOtp } from "./whatsappConfig.service.js";

function toWaDigits(phone) {
  if (!phone) return null;
  const d = String(phone).replace(/\D/g, "");
  if (d.length < 10) return null;
  return d.startsWith("91") ? d : `91${d}`;
}

async function postWhatsApp(config, toDigits, bodyPayload) {
  const apiUrl = `${config.api_url}/${config.phone_number_id}/messages`;
  const res = await axios.post(
    apiUrl,
    {
      messaging_product: "whatsapp",
      to: toDigits,
      ...bodyPayload,
    },
    {
      headers: {
        Authorization: `Bearer ${config.api_key}`,
        "Content-Type": "application/json",
      },
    },
  );
  return res.data;
}

/**
 * @param {string} rawPhone
 * @param {'customer'|'reseller'} userType
 * @param {string|null} resellerId
 * @param {object} bodyPayload - spread after messaging_product + to (e.g. type, template, or type, text)
 */
export async function sendWhatsAppTransactional(
  rawPhone,
  userType,
  resellerId,
  bodyPayload,
) {
  try {
    const to = toWaDigits(rawPhone);
    if (!to) {
      return { success: false, message: "Invalid phone" };
    }
    const cfg = await resolveWhatsAppConfigForOtp(userType, resellerId);
    if (!cfg?.api_key || !cfg?.phone_number_id) {
      return { success: false, message: "WhatsApp not configured" };
    }
    await postWhatsApp(cfg, to, bodyPayload);
    return { success: true };
  } catch (e) {
    const err = e.response?.data?.error || e.response?.data;
    const msg =
      err?.message || err?.error_data?.details || e.message || "WhatsApp send failed";
    console.warn("[transactionalWhatsApp]", msg);
    return { success: false, message: msg };
  }
}

/**
 * Payment link generated / resent — customer WhatsApp (template optional).
 */
export async function notifyCustomerPaymentLinkWhatsApp({
  phone,
  paymentLink,
  brandName,
  resellerId,
  isResend = false,
}) {
  const tplResend = process.env.WHATSAPP_TEMPLATE_PAYMENT_LINK_RESENT?.trim();
  const tpl =
    (isResend && tplResend) ||
    process.env.WHATSAPP_TEMPLATE_PAYMENT_LINK?.trim() ||
    process.env.WHATSAPP_TEMPLATE_PAYMENT_LINK_SENT?.trim();
  if (tpl) {
    const dual =
      process.env.WHATSAPP_TEMPLATE_PAYMENT_LINK_TWO_BODY_VARS === "true";
    const components = dual
      ? [
          {
            type: "body",
            parameters: [
              { type: "text", text: String(brandName || "Team").slice(0, 200) },
              { type: "text", text: String(paymentLink).slice(0, 900) },
            ],
          },
        ]
      : [
          {
            type: "body",
            parameters: [
              {
                type: "text",
                text: `${isResend ? "[Reminder] " : ""}${brandName || "Team"}\n${paymentLink}`.slice(
                  0,
                  1024,
                ),
              },
            ],
          },
        ];
    return sendWhatsAppTransactional(phone, "customer", resellerId, {
      type: "template",
      template: {
        name: tpl,
        language: { code: "en" },
        components,
      },
    });
  }

  const label = isResend ? "Reminder" : "Payment";
  const text = `*${label} — ${brandName || "Virtual Number"}*\n\nPay securely:\n${paymentLink}`;
  return sendWhatsAppTransactional(phone, "customer", resellerId, {
    type: "text",
    text: { body: text.slice(0, 4096) },
  });
}

export async function notifyCustomerNumberActivatedWhatsApp({
  phone,
  virtualNumber,
  forwardNumber,
  startDate,
  endDate,
  brandName,
  resellerId,
}) {
  const tpl = process.env.WHATSAPP_TEMPLATE_NUMBER_ACTIVATED?.trim();
  if (tpl) {
    return sendWhatsAppTransactional(phone, "customer", resellerId, {
      type: "template",
      template: {
        name: tpl,
        language: { code: "en" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: String(virtualNumber).slice(0, 40) },
              { type: "text", text: String(forwardNumber || "-").slice(0, 40) },
              { type: "text", text: String(startDate || "").slice(0, 30) },
              { type: "text", text: String(endDate || "").slice(0, 30) },
              { type: "text", text: String(brandName || "Team").slice(0, 80) },
            ],
          },
        ],
      },
    });
  }
  const text =
    `*Number activated — ${brandName || "Team"}*\n\n` +
    `Virtual: ${virtualNumber}\n` +
    `Forward: ${forwardNumber || "-"}\n` +
    `Valid from: ${startDate || "-"}\n` +
    `Valid to: ${endDate || "-"}`;
  return sendWhatsAppTransactional(phone, "customer", resellerId, {
    type: "text",
    text: { body: text.slice(0, 4096) },
  });
}

/** 30d and 7d reminders — WhatsApp per spec */
export async function notifyCustomerExpiryReminderWhatsApp({
  phone,
  virtualNumber,
  brandName,
  resellerId,
  days,
}) {
  const tpl = process.env.WHATSAPP_TEMPLATE_EXPIRY_REMINDER?.trim();
  if (tpl) {
    return sendWhatsAppTransactional(phone, "customer", resellerId, {
      type: "template",
      template: {
        name: tpl,
        language: { code: "en" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: String(days) },
              { type: "text", text: String(virtualNumber).slice(0, 40) },
              { type: "text", text: String(brandName || "Team").slice(0, 80) },
            ],
          },
        ],
      },
    });
  }
  const text = `*Expiry reminder (${days} days) — ${brandName || "Team"}*\nVirtual number: ${virtualNumber}\nPlease renew to avoid interruption.`;
  return sendWhatsAppTransactional(phone, "customer", resellerId, {
    type: "text",
    text: { body: text.slice(0, 4096) },
  });
}

/** Low wallet — admin (reseller) WhatsApp */
export async function notifyResellerLowWalletWhatsApp({
  phone,
  balance,
  threshold,
  platformName,
  resellerId,
}) {
  const tpl = process.env.WHATSAPP_TEMPLATE_LOW_WALLET?.trim();
  if (tpl) {
    return sendWhatsAppTransactional(phone, "reseller", resellerId, {
      type: "template",
      template: {
        name: tpl,
        language: { code: "en" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: String(balance) },
              { type: "text", text: String(threshold) },
              { type: "text", text: String(platformName || "").slice(0, 80) },
            ],
          },
        ],
      },
    });
  }
  const text = `*Low wallet balance* (${platformName || "Platform"})\nCurrent: ₹${balance}\nThreshold: ₹${threshold}\nPlease top up.`;
  return sendWhatsAppTransactional(phone, "reseller", resellerId, {
    type: "text",
    text: { body: text.slice(0, 4096) },
  });
}
