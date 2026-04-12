import {
  getSmtpTemplateByTypeForContext,
  replaceTemplateVariables,
} from "./smtpTemplate.service.js";
import { getDefaultTransactionalTemplate } from "../../mailtemplate/transactionalEmailDefaults.js";

function htmlToText(html) {
  if (!html) return "";
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Resolve subject/html/text: DB template (admin/reseller/global) or code default.
 * @param {string} templateType - TEMPLATE_TYPE.* value
 * @param {Record<string, string|number|null|undefined>} variables
 * @param {{ adminId?: string|null, resellerId?: string|null }} context
 */
export async function resolveTransactionalEmail(
  templateType,
  variables = {},
  context = {},
) {
  const row = await getSmtpTemplateByTypeForContext(templateType, context);
  if (row?.subject && row?.body) {
    const subject = replaceTemplateVariables(row.subject, variables);
    const html = replaceTemplateVariables(row.body, variables);
    return {
      subject,
      html,
      text: htmlToText(html),
    };
  }

  const factory = getDefaultTransactionalTemplate(templateType);
  if (typeof factory === "function") {
    return factory(variables);
  }

  return null;
}
