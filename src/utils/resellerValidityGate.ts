/**
 * Same rules as MasterLayout "Recharge required" modal:
 * blocked only when validity row exists AND (end date in past OR status EXPIRED/SUSPENDED).
 */
export type ResellerValidityLike = {
  validity_end_date?: string | null;
  status?: string | null;
} | null;

export function computeResellerValidityGate(
  validity: ResellerValidityLike,
): { blocked: boolean; reason: string } {
  if (!validity) {
    return { blocked: false, reason: "" };
  }

  const endDate = validity.validity_end_date
    ? new Date(validity.validity_end_date)
    : null;
  const now = new Date();
  const isExpiredByDate = Boolean(endDate && endDate < now);
  const isExpiredStatus =
    validity.status === "EXPIRED" || validity.status === "SUSPENDED";

  if (!isExpiredByDate && !isExpiredStatus) {
    return { blocked: false, reason: "" };
  }

  if (validity.status === "SUSPENDED") {
    return {
      blocked: true,
      reason:
        "Your account is suspended. Please recharge to extend your account.",
    };
  }

  return {
    blocked: true,
    reason:
      "Your validity has expired. Please recharge to extend your account.",
  };
}
