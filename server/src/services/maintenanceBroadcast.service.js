import { getHasuraClient } from "../config/hasura.client.js";
import {
  sendMaintenanceDisabledAdminEmail,
  sendMaintenanceEnabledAdminEmail,
} from "./transactionalEmail.service.js";

function resellerDisplayName(r) {
  if (!r) return "Team";
  const name = `${r.first_name || ""} ${r.last_name || ""}`.trim();
  return (
    r.brand_name ||
    r.business_name ||
    name ||
    r.email ||
    "Team"
  );
}

/**
 * Resellers eligible for platform maintenance emails: completed signup (step 7),
 * not soft-deleted, with a non-empty email. Same cohort as admin reseller list.
 */
export async function fetchResellerRecipientsForMaintenanceBroadcast() {
  const client = getHasuraClient();
  const data = await client.client.request(`
    query MaintenanceBroadcastResellers {
      mst_reseller(
        where: {
          _and: [
            {
              _or: [
                { isDelete: { _is_null: true } },
                { isDelete: { _eq: false } }
              ]
            },
            { current_step: { _eq: 7 } },
            { email: { _is_null: false } },
            { email: { _neq: "" } }
          ]
        }
      ) {
        id
        email
        first_name
        last_name
        brand_name
        business_name
      }
    }
  `);
  const rows = data?.mst_reseller || [];
  const byEmail = new Map();
  for (const r of rows) {
    const email = (r.email && String(r.email).trim()) || "";
    if (!email) continue;
    const key = email.toLowerCase();
    if (!byEmail.has(key)) {
      byEmail.set(key, {
        email,
        displayName: resellerDisplayName(r),
      });
    }
  }
  return [...byEmail.values()];
}

export async function broadcastMaintenanceEnabledToResellers() {
  const recipients = await fetchResellerRecipientsForMaintenanceBroadcast();
  const results = { total: recipients.length, sent: 0, failed: 0, failures: [] };
  for (const { email, displayName } of recipients) {
    const r = await sendMaintenanceEnabledAdminEmail(email, displayName);
    if (r.success) {
      results.sent += 1;
    } else {
      results.failed += 1;
      results.failures.push({ email, message: r.message || "Send failed" });
    }
  }
  return results;
}

export async function broadcastMaintenanceDisabledToResellers() {
  const recipients = await fetchResellerRecipientsForMaintenanceBroadcast();
  const results = { total: recipients.length, sent: 0, failed: 0, failures: [] };
  for (const { email, displayName } of recipients) {
    const r = await sendMaintenanceDisabledAdminEmail(email, displayName);
    if (r.success) {
      results.sent += 1;
    } else {
      results.failed += 1;
      results.failures.push({ email, message: r.message || "Send failed" });
    }
  }
  return results;
}
