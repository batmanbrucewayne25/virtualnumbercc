/**
 * Parse a date string from the database (UTC) into a Date object.
 * If the string has no timezone, it is treated as UTC.
 * Use this when comparing with "now" for elapsed time (e.g. edit windows).
 */
export function parseDateAsUTC(dateString) {
  if (!dateString) return null;
  const s = String(dateString).trim();
  if (!s) return null;
  // If no Z or timezone offset, assume UTC
  if (!/Z|[+-]\d{2}:?\d{2}$/.test(s)) {
    const withZ = s.includes("T") ? `${s.replace(/\.\d+$/, "")}Z` : `${s}T00:00:00.000Z`;
    const date = new Date(withZ);
    return isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(s);
  return isNaN(date.getTime()) ? null : date;
}

const IST_TIMEZONE = "Asia/Kolkata";

/**
 * Format a UTC date string for display in IST (date only).
 * @param {string} dateString - ISO date/datetime from DB (UTC)
 * @returns {string} Formatted date in IST (e.g. "08/03/2026") or "-" if invalid
 */
export function formatDateIST(dateString) {
  const date = parseDateAsUTC(dateString);
  if (!date) return "-";
  return date.toLocaleDateString("en-GB", {
    timeZone: IST_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Format a UTC date string for display in IST (date and time).
 * @param {string} dateString - ISO date/datetime from DB (UTC)
 * @returns {string} Formatted datetime in IST (e.g. "08/03/2026, 07:29") or "-" if invalid
 */
export function formatDateTimeIST(dateString) {
  const date = parseDateAsUTC(dateString);
  if (!date) return "-";
  return date.toLocaleString("en-GB", {
    timeZone: IST_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format with date and time including seconds (IST).
 */
export function formatDateTimeWithSecondsIST(dateString) {
  const date = parseDateAsUTC(dateString);
  if (!date) return "-";
  return date.toLocaleString("en-GB", {
    timeZone: IST_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
