/**
 * Prints paths for SQL verification and migration order (no DB connection).
 */
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.join(__dirname, "../../hasura-migrations");

console.log("Run in psql against your app database:");
console.log(path.join(migrationsDir, "VERIFY_WALLET_DEBIT_INVARIANTS.sql"));
console.log("");
console.log("Required for Razorpay idempotency (apply before prod webhooks):");
console.log(
  path.join(migrationsDir, "add-wallet-transaction-unique-constraint.sql"),
);
console.log(
  path.join(migrationsDir, "add-razorpay-payment-fulfillment-claim.sql"),
);
console.log("");
console.log("Suggested migration order:");
console.log(path.join(migrationsDir, "MIGRATION_ORDER.txt"));
console.log("");
console.log("After deploy, manual regression checklist:");
console.log("  npm run verify:payment-test-hint");
