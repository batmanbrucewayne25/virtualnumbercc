import { getHasuraClient } from '../config/hasura.client.js';

/**
 * Get SMTP template from database by template type and admin_id
 * @param {string} templateType - Template type (e.g., 'admin_onboarding', 'reseller_onboarding')
 * @param {string} adminId - Admin ID (optional, for admin templates)
 * @returns {Promise<object|null>} Template object or null if not found
 */
export const getSmtpTemplateByType = async (templateType, adminId = null) => {
  try {
    const client = getHasuraClient();
    
    let query;
    let variables;
    
    if (adminId) {
      // Get admin template
      query = `
        query GetSmtpTemplateByType($template_type: String!, $admin_id: uuid!) {
          mst_smtp_template(
            where: { 
              template_type: { _eq: $template_type },
              admin_id: { _eq: $admin_id },
              is_active: { _eq: true }
            }
            limit: 1
            order_by: { created_at: desc }
          ) {
            id
            template_name
            subject
            body
            template_type
            variables
            is_active
          }
        }
      `;
      variables = { template_type: templateType, admin_id: adminId };
    } else {
      // Get reseller template (if needed in future)
      query = `
        query GetSmtpTemplateByType($template_type: String!) {
          mst_smtp_template(
            where: { 
              template_type: { _eq: $template_type },
              is_active: { _eq: true }
            }
            limit: 1
            order_by: { created_at: desc }
          ) {
            id
            template_name
            subject
            body
            template_type
            variables
            is_active
          }
        }
      `;
      variables = { template_type: templateType };
    }
    
    const data = await client.client.request(query, variables);
    
    if (data.mst_smtp_template && data.mst_smtp_template.length > 0) {
      return data.mst_smtp_template[0];
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching SMTP template from database:', error);
    return null;
  }
};

/**
 * Replace template variables in a string
 * Supports both {{variable_name}} and ${variableName} syntax
 * @param {string} template - Template string with variables
 * @param {object} variables - Object with variable values
 * @returns {string} Template with variables replaced
 */
export const replaceTemplateVariables = (template, variables = {}) => {
  if (!template) return '';
  
  let result = template;
  
  console.log('[Template Replacement] Starting replacement for template length:', template.length);
  console.log('[Template Replacement] Available variables:', Object.keys(variables));
  
  // Create a mapping for camelCase to snake_case and vice versa
  const variableMap = {};
  Object.keys(variables).forEach(key => {
    // Add the key as-is
    variableMap[key] = variables[key];
    
    // Convert snake_case to camelCase
    const camelCase = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    if (camelCase !== key) {
      variableMap[camelCase] = variables[key];
    }
    
    // Convert camelCase to snake_case
    const snakeCase = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    if (snakeCase !== key && !variableMap[snakeCase]) {
      variableMap[snakeCase] = variables[key];
    }
  });
  
  console.log('[Template Replacement] Variable map keys:', Object.keys(variableMap));
  
  // Replace all {{variable}} patterns (double curly braces)
  Object.keys(variableMap).forEach(key => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    const value = variableMap[key] !== null && variableMap[key] !== undefined ? String(variableMap[key]) : '';
    const matches = result.match(regex);
    if (matches) {
      console.log(`[Template Replacement] Replacing {{${key}}} with value (${matches.length} matches)`);
    }
    result = result.replace(regex, value);
  });
  
  // Replace all ${variable} patterns (JavaScript template literal syntax)
  Object.keys(variableMap).forEach(key => {
    // Escape special regex characters in the key (but NOT $, {, } - those are part of the template syntax)
    // Only escape: . * + ? ^ ( ) | [ ] \
    const escapedKey = key.replace(/[.*+?^()|[\]\\]/g, '\\$&');
    // Pattern: ${variable} - $ and { need to be escaped in regex string, } needs to be escaped too
    // In regex: \$ matches literal $, \{ matches literal {, \} matches literal }
    const regex = new RegExp(`\\$\\{${escapedKey}\\}`, 'g');
    const value = variableMap[key] !== null && variableMap[key] !== undefined ? String(variableMap[key]) : '';
    
    // Check if pattern exists before replacement
    const patternExists = result.includes(`\${${key}}`);
    if (patternExists) {
      const beforeReplace = result;
      result = result.replace(regex, value);
      const replaced = beforeReplace !== result;
      console.log(`[Template Replacement] \${${key}}: pattern found=${patternExists}, replaced=${replaced}, value length=${value.length}`);
      if (!replaced) {
        console.error(`[Template Replacement] WARNING: Pattern \${${key}} found but not replaced! Regex: ${regex}`);
      }
    }
  });
  
  // Also handle ${roleInfo} which might be a special case (if not already in variableMap)
  if (result.includes('${roleInfo}')) {
    const roleInfoValue = variables.roleInfo || variables.role_info || variables.role_name || variables.role || 'No role assigned';
    result = result.replace(/\$\{roleInfo\}/g, roleInfoValue);
    console.log('[Template Replacement] Replaced ${roleInfo}');
  }
  
  console.log('[Template Replacement] Final result length:', result.length);
  console.log('[Template Replacement] Still contains ${}:', result.includes('${'));
  
  return result;
};

