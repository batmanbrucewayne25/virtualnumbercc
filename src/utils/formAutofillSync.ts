/**
 * Chrome and other browsers often autofill inputs without firing React's `onChange`,
 * so controlled state stays empty while the visible field shows values.
 *
 * At submit time, read the live DOM value — it matches what the user sees.
 * Fall back to React state when the element is missing (SSR/tests).
 */
export function readAutofillAwareInput(elementId: string): string {
  if (typeof document === "undefined") return "";
  const el = document.getElementById(elementId);
  if (!el || !("value" in el)) return "";
  return String((el as HTMLInputElement).value).trim();
}

/**
 * Prefer DOM value when non-empty; otherwise use React state (trimmed).
 */
export function mergeAutofillWithState(
  elementId: string,
  reactValue: string,
): string {
  const dom = readAutofillAwareInput(elementId);
  if (dom !== "") return dom;
  return String(reactValue ?? "").trim();
}
