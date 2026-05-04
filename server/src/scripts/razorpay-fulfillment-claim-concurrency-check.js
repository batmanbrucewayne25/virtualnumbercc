/**
 * Concurrency check: two sequential claim inserts for the same Razorpay payment id.
 * Expect first affected_rows=1, second=0 (requires migration + Hasura track).
 *
 * Usage (from server/):
 *   FULFILLMENT_CLAIM_TEST_RESELLER_ID=<uuid> npm run test:fulfillment-claim
 *
 * Cleans up the test claim row on success.
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { GraphQLClient } from "graphql-request";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../.env") });

const MUTATION = `
  mutation TryClaim($payment_id: String!, $reseller_id: uuid!) {
    insert_mst_razorpay_payment_fulfillment_claim(
      objects: [{ razorpay_payment_id: $payment_id, reseller_id: $reseller_id }]
      on_conflict: {
        constraint: mst_razorpay_payment_fulfillment_claim_pkey
        update_columns: []
      }
    ) {
      affected_rows
    }
  }
`;

const DELETE_MUTATION = `
  mutation DelClaim($payment_id: String!) {
    delete_mst_razorpay_payment_fulfillment_claim(
      where: { razorpay_payment_id: { _eq: $payment_id } }
    ) {
      affected_rows
    }
  }
`;

async function main() {
  const endpoint = process.env.HASURA_GRAPHQL_ENDPOINT;
  const secret = process.env.HASURA_ADMIN_SECRET;
  const resellerId = process.env.FULFILLMENT_CLAIM_TEST_RESELLER_ID;

  if (!endpoint || !secret) {
    console.error("Missing HASURA_GRAPHQL_ENDPOINT or HASURA_ADMIN_SECRET");
    process.exit(1);
  }
  if (!resellerId) {
    console.error(
      "Set FULFILLMENT_CLAIM_TEST_RESELLER_ID to a valid reseller uuid",
    );
    process.exit(1);
  }

  const client = new GraphQLClient(endpoint, {
    headers: {
      "Content-Type": "application/json",
      ...(secret && { "x-hasura-admin-secret": secret }),
    },
  });

  const paymentId = `pay_claim_test_${Date.now()}`;

  try {
    const r1 = await client.request(MUTATION, {
      payment_id: paymentId,
      reseller_id: resellerId,
    });
    const a1 = r1?.insert_mst_razorpay_payment_fulfillment_claim?.affected_rows;

    const r2 = await client.request(MUTATION, {
      payment_id: paymentId,
      reseller_id: resellerId,
    });
    const a2 = r2?.insert_mst_razorpay_payment_fulfillment_claim?.affected_rows;

    if (a1 !== 1) {
      console.error(`FAIL: first insert expected affected_rows=1, got ${a1}`);
      process.exit(1);
    }
    if (a2 !== 0) {
      console.error(
        `FAIL: second insert expected affected_rows=0 (conflict), got ${a2}`,
      );
      process.exit(1);
    }

    await client.request(DELETE_MUTATION, { payment_id: paymentId });
    console.log("OK: claim mutex behaves as expected (second insert no-op).");
  } catch (e) {
    const msg = String(e?.message || e?.response?.errors?.[0]?.message || e);
    if (msg.includes("mst_razorpay_payment_fulfillment_claim")) {
      console.error(
        "FAIL: Hasura does not expose claim table. Run add-razorpay-payment-fulfillment-claim.sql and track the table.",
      );
      console.error(msg);
      process.exit(1);
    }
    console.error(e);
    process.exit(1);
  }
}

main();
