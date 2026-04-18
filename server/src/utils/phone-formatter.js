/**
 * Normalize Indian mobile numbers to E.164 for Razorpay `customer.contact` (+91XXXXXXXXXX).
 * Returns undefined if the value cannot be interpreted as a valid Indian mobile (avoids sending garbage).
 *
 * @param {string|number|null|undefined} raw
 * @returns {string|undefined}
 */
export function normalizeIndiaContactE164(raw) {
  if (raw == null || raw === "") return undefined;
  const s = String(raw).trim();
  if (!s) return undefined;

  const digits = s.replace(/\D/g, "");

  // 10 digits starting with 6–9 (typical Indian mobile)
  if (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) {
    return `+91${digits}`;
  }

  // 0XXXXXXXXXX → drop leading 0
  if (digits.length === 11 && /^0[6-9]\d{9}$/.test(digits)) {
    return `+91${digits.slice(1)}`;
  }

  // 91XXXXXXXXXX (12 digits)
  if (digits.length === 12 && /^91[6-9]\d{9}$/.test(digits)) {
    return `+${digits}`;
  }

  // Already +91 … in input
  const compact = s.replace(/\s/g, "");
  if (/^\+91[6-9]\d{9}$/.test(compact)) {
    return compact;
  }

  return undefined;
}
