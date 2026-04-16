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

/**
 * Convert admin/reseller textarea input (display order: specific → broad) back to
 * storage order (broad → specific) for mst_reseller.address.
 *
 * @param {string|null|undefined} input
 * @returns {string[]|null}
 */
export function parseAddressInputToStorageArray(input) {
  if (input == null || String(input).trim() === "") return null;
  const lines = String(input)
    .split(/\n|,/)
    .map((a) => a.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;
  return [...lines].reverse();
}
