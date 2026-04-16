import { getApiBaseUrl } from "@/utils/apiUrl";

/**
 * Base URL for static uploads (no trailing slash).
 * Prefer VITE_IMAGE_UPLOAD_PATH, then VITE_IMAGE_BASE_PATH, then API origin + /uploads.
 */
export function getUploadsBaseUrl() {
  const fromEnv =
    import.meta.env.VITE_IMAGE_UPLOAD_PATH?.trim() ||
    import.meta.env.VITE_IMAGE_BASE_PATH?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/+$/, "");
  }
  try {
    const origin = new URL(getApiBaseUrl()).origin;
    return `${origin}/uploads`;
  } catch {
    return "http://localhost:3001/uploads";
  }
}

function apiOrigin() {
  try {
    return new URL(getApiBaseUrl()).origin;
  } catch {
    return "http://localhost:3001";
  }
}

/**
 * Public URL for a file stored under uploads/{subfolder}/ (e.g. profile-images, logos).
 * Handles absolute http(s), data:, root-relative paths, and plain filenames.
 *
 * @param {string|null|undefined} stored
 * @param {string} subfolder e.g. "logos", "profile-images", "favicons"
 * @returns {string|null}
 */
export function buildUploadedAssetUrl(stored, subfolder) {
  if (stored == null) return null;
  const s = String(stored).trim();
  if (!s) return null;
  if (/^(https?:\/\/|data:)/i.test(s)) return s;
  if (s.startsWith("/")) {
    return `${apiOrigin()}${s}`;
  }
  const folder = String(subfolder).replace(/^\/+|\/+$/g, "");
  let rest = s.replace(/\\/g, "/");
  const prefix = new RegExp(`^${folder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/`, "i");
  while (prefix.test(rest)) {
    rest = rest.replace(prefix, "");
  }
  const base = getUploadsBaseUrl();
  return `${base}/${folder}/${rest}`;
}

/**
 * Reseller logo URL from DB value (filename, absolute URL, data URI, or /uploads/... path).
 * @param {string|null|undefined} logo
 * @returns {string|null}
 */
export function buildLogoPublicUrl(logo) {
  return buildUploadedAssetUrl(logo, "logos");
}
