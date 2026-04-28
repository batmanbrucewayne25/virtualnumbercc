import { getHasuraClient } from "../config/hasura.client.js";

const DEFAULT_API_URL = "https://graph.facebook.com/v18.0";
const DEFAULT_OTP_TEMPLATE_NAME = "botbeeotp";

/**
 * Optional env fallback when no DB row exists (no hardcoded secrets).
 * Set WHATSAPP_ACCESS_TOKEN (or WHATSAPP_API_KEY) and WHATSAPP_PHONE_NUMBER_ID.
 */
export function getEnvWhatsAppFallback() {
  const api_key =
    process.env.WHATSAPP_ACCESS_TOKEN?.trim() ||
    process.env.WHATSAPP_API_KEY?.trim() ||
    "";
  const phone_number_id = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || "";
  const api_url = process.env.WHATSAPP_API_URL?.trim() || DEFAULT_API_URL;
  const template_name =
    process.env.WHATSAPP_OTP_TEMPLATE?.trim() || DEFAULT_OTP_TEMPLATE_NAME;
  if (!api_key || !phone_number_id) {
    return null;
  }
  return {
    api_key,
    api_url,
    phone_number_id,
    business_account_id: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || null,
    template_name,
  };
}

function normalizeOtpConfig(config) {
  if (!config) return null;
  return {
    ...config,
    api_url: config.api_url?.trim() || DEFAULT_API_URL,
    template_name: config.template_name || config.business_account_id || DEFAULT_OTP_TEMPLATE_NAME,
  };
}

/**
 * First active admin WhatsApp row (Meta Cloud API).
 */
export async function getFirstAdminWhatsAppConfig() {
  try {
    const client = getHasuraClient();
    const query = `
      query GetAdminWhatsAppConfig {
        mst_whatsapp_config(
          where: {
            admin_id: { _is_null: false },
            is_active: { _eq: true }
          }
          limit: 1
          order_by: { created_at: desc }
        ) {
          api_key
          api_url
          phone_number_id
          business_account_id
        }
      }
    `;
    const result = await client.client.request(query);
    if (result.mst_whatsapp_config?.length > 0) {
      return normalizeOtpConfig(result.mst_whatsapp_config[0]);
    }
  } catch (error) {
    console.warn("[WhatsApp Config] Error fetching admin config:", error.message);
  }
  return null;
}

/**
 * Reseller-scoped WhatsApp config (ClientHub / customer OTP).
 */
export async function getResellerWhatsAppConfig(resellerId) {
  if (!resellerId) return null;
  try {
    const client = getHasuraClient();
    const query = `
      query GetResellerWhatsAppConfig($reseller_id: uuid!) {
        mst_whatsapp_config(
          where: {
            reseller_id: { _eq: $reseller_id },
            is_active: { _eq: true }
          }
          limit: 1
          order_by: { created_at: desc }
        ) {
          api_key
          api_url
          phone_number_id
          business_account_id
        }
      }
    `;
    const result = await client.client.request(query, { reseller_id: resellerId });
    if (result.mst_whatsapp_config?.length > 0) {
      return normalizeOtpConfig(result.mst_whatsapp_config[0]);
    }
  } catch (error) {
    console.warn("[WhatsApp Config] Error fetching reseller config:", error.message);
  }
  return null;
}

/**
 * For OTP sends: customer + reseller_id uses reseller Meta app first, then admin, then env.
 */
export async function resolveWhatsAppConfigForOtp(userType, resellerId) {
  if (
    (userType === "customer" || userType === "reseller") &&
    resellerId
  ) {
    const resellerCfg = await getResellerWhatsAppConfig(resellerId);
    if (
      resellerCfg?.api_key &&
      resellerCfg?.phone_number_id
    ) {
      console.log("[WhatsApp OTP] Using reseller WhatsApp configuration");
      return resellerCfg;
    }
    console.log(
      "[WhatsApp OTP] No active reseller WhatsApp config; falling back to admin / env"
    );
  }
  const adminCfg = await getFirstAdminWhatsAppConfig();
  if (adminCfg?.api_key && adminCfg?.phone_number_id) {
    console.log("[WhatsApp OTP] Using admin WhatsApp configuration");
    return adminCfg;
  }
  const envCfg = getEnvWhatsAppFallback();
  if (envCfg) {
    console.log("[WhatsApp OTP] Using WHATSAPP_* environment variables");
  }
  return envCfg;
}

/**
 * Shared loader for template/text messages (admin DB, then env). No hardcoded API keys.
 */
export async function getWhatsAppConfigResolved() {
  const adminCfg = await getFirstAdminWhatsAppConfig();
  if (adminCfg?.api_key && adminCfg?.phone_number_id) {
    return adminCfg;
  }
  return getEnvWhatsAppFallback();
}
