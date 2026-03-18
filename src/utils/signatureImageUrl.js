import { getApiBaseUrl } from "@/utils/apiUrl";

function extractFilename(value) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // If it's a path or URL, get the last segment
  if (trimmed.includes("/")) {
    const parts = trimmed.split("/").filter(Boolean);
    return parts[parts.length - 1] || null;
  }
  return trimmed;
}

export function getSignatureImageUrl(signatureValue) {
  if (!signatureValue || typeof signatureValue !== "string") return null;
  const raw = signatureValue.trim();
  if (!raw) return null;

  // Already a complete URL - use as-is
  if (
    raw.startsWith("data:") ||
    raw.startsWith("http://") ||
    raw.startsWith("https://")
  ) {
    return raw;
  }

  const filename = extractFilename(raw);
  if (!filename) return null;

  // Sanitize: only allow alphanumeric, dash, underscore, dot (prevent path traversal)
  if (!/^[a-zA-Z0-9_.-]+$/.test(filename)) {
    return null;
  }

  // Prefer relative path - always works when app and API share same origin
  // Resolves to: origin + /uploads/signatures/filename
  return `/uploads/signatures/${filename}`;
}

export function getSignatureImageApiUrl(signatureValue) {
  const filename = extractFilename(signatureValue);
  if (!filename || !/^[a-zA-Z0-9_.-]+$/.test(filename)) return null;

  const apiBase = getApiBaseUrl();
  const base = (apiBase || "").replace(/\/+$/, "");
  return `${base}/upload/signature/${encodeURIComponent(filename)}`;
}

/**
 * Get absolute URL for signature (for popups, emails, etc.)
 * @param {string} signatureValue - Value from DB
 * @returns {string|null} - Full URL
 */
export function getSignatureImageAbsoluteUrl(signatureValue) {
  const url = getSignatureImageUrl(signatureValue);
  if (!url) return getSignatureImageApiUrl(signatureValue);
  if (url.startsWith("http")) return url;
  if (typeof window !== "undefined") {
    return `${window.location.origin}${url.startsWith("/") ? "" : "/"}${url}`;
  }
  return getSignatureImageApiUrl(signatureValue);
}
