import {
  getSmtpTemplateByTypeForContext,
  replaceTemplateVariables,
} from "./smtpTemplate.service.js";
import { getDefaultTransactionalTemplate } from "../../mailtemplate/transactionalEmailDefaults.js";
import { getHasuraClient } from "../config/hasura.client.js";
import {
  buildLogoImageUrl,
  formatCustomerDisplayName,
  formatResellerDisplayName,
} from "../utils/emailBranding.js";

function htmlToText(html) {
  if (!html) return "";
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Merge reseller logo, customer display name, and optional platform logo into template variables.
 * @param {Record<string, string|number|null|undefined>} variables
 * @param {{ adminId?: string|null, resellerId?: string|null, customerId?: string|null }} context
 */
async function enrichTransactionalVariables(variables, context) {
  const merged = { ...variables };

  if (context.resellerId) {
    try {
      const client = getHasuraClient();
      const d = await client.client.request(
        `query R($id: uuid!) {
          mst_reseller_by_pk(id: $id) {
            logo
            minified_logo
            brand_name
            business_name
            first_name
            last_name
            email
          }
        }`,
        { id: context.resellerId },
      );
      const r = d.mst_reseller_by_pk;
      if (r) {
        const file = r.minified_logo || r.logo;
        const url = buildLogoImageUrl(file);
        if (url) merged.brand_logo_url = url;
        if (merged.brand_name == null || merged.brand_name === "") {
          merged.brand_name =
            r.brand_name ||
            r.business_name ||
            `${r.first_name || ""} ${r.last_name || ""}`.trim() ||
            r.email ||
            "Team";
        }
        const resellerDisplay = formatResellerDisplayName(r);
        const re = String(r.email ?? "").trim();
        const u = String(merged.user ?? "").trim();
        if (
          resellerDisplay &&
          re &&
          (!u || u.toLowerCase() === re.toLowerCase())
        ) {
          merged.user = resellerDisplay;
        }
      }
    } catch (e) {
      console.warn("[resolveTransactionalEmail] reseller enrich skipped:", e.message);
    }
  } else {
    const pl = (process.env.PLATFORM_LOGO_URL || "").trim();
    if (pl) merged.platform_logo_url = pl;
  }

  if (context.customerId) {
    try {
      const client = getHasuraClient();
      const d = await client.client.request(
        `query C($id: uuid!) {
          mst_customer_by_pk(id: $id) {
            first_name
            last_name
            profile_name
            email
          }
        }`,
        { id: context.customerId },
      );
      const c = d.mst_customer_by_pk;
      if (c) {
        const dn = formatCustomerDisplayName(c);
        if (dn) {
          merged.customer_display_name = dn;
          const em = String(c.email ?? "").trim();
          const u = String(merged.user ?? "").trim();
          if (!u || (em && u.toLowerCase() === em.toLowerCase())) {
            merged.user = dn;
          }
          const cm = String(merged.customer_name ?? "").trim();
          if (!cm || (em && cm.toLowerCase() === em.toLowerCase())) {
            merged.customer_name = dn;
          }
        }
      }
    } catch (e) {
      console.warn("[resolveTransactionalEmail] customer enrich skipped:", e.message);
    }
  }

  return merged;
}

/**
 * Resolve subject/html/text: DB template (admin/reseller/global) or code default.
 * @param {string} templateType - TEMPLATE_TYPE.* value
 * @param {Record<string, string|number|null|undefined>} variables
 * @param {{ adminId?: string|null, resellerId?: string|null, customerId?: string|null }} context
 */
export async function resolveTransactionalEmail(
  templateType,
  variables = {},
  context = {},
) {
  const merged = await enrichTransactionalVariables(variables, context);

  const row = await getSmtpTemplateByTypeForContext(templateType, context);
  if (row?.subject && row?.body) {
    const subject = replaceTemplateVariables(row.subject, merged);
    const html = replaceTemplateVariables(row.body, merged);
    return {
      subject,
      html,
      text: htmlToText(html),
    };
  }

  const factory = getDefaultTransactionalTemplate(templateType);
  if (typeof factory === "function") {
    return factory(merged);
  }

  return null;
}
