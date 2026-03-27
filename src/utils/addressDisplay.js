/**
 * Hasura / KYC often store address segments broad → specific (e.g. country first).
 * For reading, show specific → broad (one line per segment when joined with newline).
 *
 * @param {string|string[]|null|undefined} addr
 * @returns {string[]}
 */
export function getAddressDisplayLines(addr) {
  if (addr == null || addr === "") return [];
  const lines = Array.isArray(addr)
    ? addr.map((l) => String(l).trim()).filter(Boolean)
    : String(addr)
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
  return [...lines].reverse();
}

/**
 * @param {string|string[]|null|undefined} addr
 * @returns {string}
 */
export function formatAddressDisplayMultiline(addr) {
  return getAddressDisplayLines(addr).join("\n");
}
