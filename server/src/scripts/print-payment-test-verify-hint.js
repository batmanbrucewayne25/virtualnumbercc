/**
 * Post-deploy manual checklist (no DB/API connection).
 * Run after migrations + API deploy: npm run verify:payment-test-hint
 */
console.log("Phase 4 — regression check after wallet hardening deploy:\n");
console.log(
  "1) In production Postgres, all checks in VERIFY_WALLET_DEBIT_INVARIANTS.sql must return ok = true (especially uq_wallet_txn_wallet_reference and claim PK).",
);
console.log(
  "2) Run ONE test payment; in API logs expect a single successful wallet debit for that mst_transaction id (not multiple [postPayment][walletDebit] SUCCESS for same reference).",
);
console.log(
  "3) In DB: SELECT count(*) FROM mst_wallet_transaction WHERE reference = '<txn_uuid>'; expect 1 per wallet_id (unique constraint enforces at most one row per wallet_id+reference).",
);
console.log(
  "4) Confirm customer leaves pending/pending-payment when fulfillment completes.",
);
