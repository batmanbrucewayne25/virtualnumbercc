/**
 * Strong password rules for onboarding / account creation:
 * - Minimum 8 characters
 * - At least one uppercase letter (A–Z)
 * - At least one digit (0–9)
 * - At least one special character (non-alphanumeric)
 */

export const STRONG_PASSWORD_HINT =
  "Min 8 characters, with 1 uppercase letter, 1 number, and 1 special character.";

export function isStrongPassword(password: string): boolean {
  return getStrongPasswordError(password) === null;
}

/** Returns an error message if invalid, or null if the password meets all rules. */
export function getStrongPasswordError(password: string): string | null {
  if (password == null || typeof password !== "string") {
    return "Password is required.";
  }
  if (password.length < 8) {
    return "Password must be at least 8 characters long.";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must include at least one uppercase letter (A–Z).";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must include at least one number.";
  }
  // Any character that is not a letter or digit counts as special
  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Password must include at least one special character (e.g. !@#$%).";
  }
  return null;
}
