/**
 * Reseller logo URLs for email HTML (requires absolute URLs).
 * Set PUBLIC_API_BASE_URL (no trailing slash), e.g. https://api.example.com.
 * Logos in DB are filenames served at GET /api/upload/logo/:filename.
 *
 * Platform / admin emails (no resellerId in resolveTransactionalEmail context):
 * set PLATFORM_LOGO_URL to a full https URL for the HTML header <img>.
 * Example (Virtual Number India admin logo):
 *   PLATFORM_LOGO_URL=https://app.virtualnumberindia.in/assets/images/own/dlogo.png
 * Copy server/.env.example to .env and adjust for your deployment.
 */
export function buildLogoImageUrl(filenameOrUrl) {
  if (filenameOrUrl == null || filenameOrUrl === "") return "";
  const s = String(filenameOrUrl).trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  const base = (process.env.PUBLIC_API_BASE_URL || "").trim().replace(/\/$/, "");
  if (!base) return "";
  return `${base}/api/upload/logo/${encodeURIComponent(s)}`;
}

/**
 * End-customer display: "first_name last_name", else profile_name, else email.
 */
export function formatCustomerDisplayName(c) {
  if (!c) return "";
  const fn = String(c.firstName ?? c.first_name ?? "").trim();
  const ln = String(c.lastName ?? c.last_name ?? "").trim();
  const full = `${fn} ${ln}`.trim();
  if (full) return full;
  const profile = String(c.profile_name ?? "").trim();
  if (profile) return profile;
  const email = String(c.email ?? "").trim();
  if (email) return email;
  return "";
}

/**
 * Reseller personal name for greetings: "first_name last_name" only (no brand / email).
 */
export function formatResellerPersonalName(r) {
  if (!r) return "";
  return `${String(r.first_name ?? "").trim()} ${String(r.last_name ?? "").trim()}`.trim();
}

/**
 * Reseller display for greetings (aligned with transactionalEmail resellerDisplayName).
 */
export function formatResellerDisplayName(r) {
  if (!r) return "";
  const name = `${String(r.first_name ?? "").trim()} ${String(r.last_name ?? "").trim()}`.trim();
  return (
    String(r.brand_name ?? "").trim() ||
    String(r.business_name ?? "").trim() ||
    name ||
    String(r.email ?? "").trim() ||
    ""
  );
}
