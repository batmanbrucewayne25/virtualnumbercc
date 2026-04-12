/**
 * Simple in-memory rate limit for OTP send / resend (per process).
 * Configure with OTP_RESEND_WINDOW_MS (default 60000).
 */

const hits = new Map();

function windowMs() {
  const n = Number(process.env.OTP_RESEND_WINDOW_MS || 60000);
  return Number.isFinite(n) && n > 0 ? n : 60000;
}

/**
 * @param {string} key
 * @param {number} [customWindowMs]
 * @returns {{ ok: true } | { ok: false, retryAfterMs: number, message: string }}
 */
export function assertOtpRateLimit(key, customWindowMs) {
  const w = customWindowMs ?? windowMs();
  const now = Date.now();
  const prev = hits.get(key) || 0;
  if (now - prev < w) {
    const retryAfterMs = w - (now - prev);
    return {
      ok: false,
      retryAfterMs,
      message: `Please wait ${Math.ceil(retryAfterMs / 1000)} seconds before requesting another OTP.`,
    };
  }
  hits.set(key, now);
  return { ok: true };
}
