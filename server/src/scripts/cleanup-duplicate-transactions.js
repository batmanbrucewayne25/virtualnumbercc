import { getHasuraClient } from "../config/hasura.client.js";

/**
 * Cleanup Script: Remove duplicate transactions
 *
 * This script identifies and removes duplicate transactions where:
 * 1. A pending transaction exists alongside a successful transaction for the same customer/amount
 * 2. Multiple pending transactions exist for the same customer/amount (keeps newest)
 * 3. Multiple successful transactions exist with the same razorpay_payment_id (keeps oldest)
 *
 * Usage: node server/src/scripts/cleanup-duplicate-transactions.js
 */

async function cleanupAllDuplicateTransactions() {
  const client = getHasuraClient();

  console.log("[CLEANUP] Starting duplicate transaction cleanup...\n");

  // Find all customers with multiple transactions
  const query = `
    query FindCustomersWithMultipleTransactions {
      mst_transaction(
        where: { transaction_type: { _eq: "payment" } }
        order_by: { customer_id: asc, created_at: asc }
      ) {
        id
        transaction_number
        customer_id
        reseller_id
        status
        amount
        razorpay_payment_id
        razorpay_order_id
        created_at
        updated_at
      }
    }
  `;

  try {
    const result = await client.client.request(query);
    const allTransactions = result.mst_transaction || [];

    console.log(
      `[CLEANUP] Found ${allTransactions.length} total transactions\n`
    );

    // Group transactions by customer_id + reseller_id
    const transactionsByCustomer = {};
    allTransactions.forEach((txn) => {
      if (!txn.customer_id) return; // Skip transactions without customer_id

      const key = `${txn.customer_id}_${txn.reseller_id}`;
      if (!transactionsByCustomer[key]) {
        transactionsByCustomer[key] = [];
      }
      transactionsByCustomer[key].push(txn);
    });

    console.log(
      `[CLEANUP] Found ${
        Object.keys(transactionsByCustomer).length
      } customers with transactions\n`
    );

    // Process each customer
    let totalDeleted = 0;
    const deletedTransactions = [];

    for (const [key, transactions] of Object.entries(transactionsByCustomer)) {
      if (transactions.length <= 1) continue; // Skip if only 1 transaction

      const [customerId, resellerId] = key.split("_");
      console.log(
        `[CLEANUP] Processing customer ${customerId} with ${transactions.length} transactions`
      );

      // Group by amount
      const byAmount = {};
      transactions.forEach((txn) => {
        const amountKey = Math.round(txn.amount * 100) / 100;
        if (!byAmount[amountKey]) {
          byAmount[amountKey] = [];
        }
        byAmount[amountKey].push(txn);
      });

      // Find duplicates for each amount
      Object.entries(byAmount).forEach(([amount, group]) => {
        if (group.length <= 1) return;

        const pendingTxns = group.filter((t) => t.status === "pending");
        const successfulTxns = group.filter(
          (t) =>
            t.status === "success" ||
            t.status === "authorized" ||
            t.status === "captured"
        );

        // Case 1: Pending + Successful → Delete pending
        if (pendingTxns.length > 0 && successfulTxns.length > 0) {
          console.log(
            `  [DUPLICATE] Amount ${amount}: ${pendingTxns.length} pending + ${successfulTxns.length} successful → Deleting pending`
          );
          pendingTxns.forEach((txn) => {
            console.log(
              `    - Deleting pending: ${txn.transaction_number} (${txn.status})`
            );
            deletedTransactions.push(txn.id);
          });
        }
        // Case 2: Multiple pending → Keep newest
        else if (pendingTxns.length > 1) {
          const sorted = pendingTxns.sort(
            (a, b) => new Date(b.created_at) - new Date(a.created_at)
          );
          console.log(
            `  [DUPLICATE] Amount ${amount}: ${
              pendingTxns.length
            } pending → Keeping newest, deleting ${pendingTxns.length - 1}`
          );
          sorted.slice(1).forEach((txn) => {
            console.log(
              `    - Deleting old pending: ${txn.transaction_number}`
            );
            deletedTransactions.push(txn.id);
          });
        }
        // Case 3: Multiple successful with same razorpay_payment_id → Keep oldest
        else if (successfulTxns.length > 1) {
          const byPaymentId = {};
          successfulTxns.forEach((txn) => {
            const paymentId = txn.razorpay_payment_id || "no_id";
            if (!byPaymentId[paymentId]) byPaymentId[paymentId] = [];
            byPaymentId[paymentId].push(txn);
          });

          Object.entries(byPaymentId).forEach(([paymentId, dupGroup]) => {
            if (dupGroup.length > 1 && paymentId !== "no_id") {
              const sorted = dupGroup.sort(
                (a, b) => new Date(a.created_at) - new Date(b.created_at)
              );
              console.log(
                `  [DUPLICATE] Amount ${amount}, Payment ${paymentId}: ${
                  dupGroup.length
                } successful → Keeping oldest, deleting ${dupGroup.length - 1}`
              );
              sorted.slice(1).forEach((txn) => {
                console.log(
                  `    - Deleting duplicate: ${txn.transaction_number}`
                );
                deletedTransactions.push(txn.id);
              });
            }
          });
        }
      });
    }

    // Delete all marked transactions
    if (deletedTransactions.length > 0) {
      console.log(
        `\n[CLEANUP] Deleting ${deletedTransactions.length} duplicate transactions...`
      );

      const deleteMutation = `
        mutation DeleteDuplicateTransactions($ids: [uuid!]!) {
          delete_mst_transaction(where: { id: { _in: $ids } }) {
            affected_rows
          }
        }
      `;

      const deleteResult = await client.client.request(deleteMutation, {
        ids: deletedTransactions,
      });

      totalDeleted = deleteResult.delete_mst_transaction.affected_rows;
      console.log(
        `[CLEANUP] Successfully deleted ${totalDeleted} duplicate transactions\n`
      );

      return {
        success: true,
        message: `Cleaned up ${totalDeleted} duplicate transactions`,
        deleted_count: totalDeleted,
      };
    } else {
      console.log("\n[CLEANUP] No duplicate transactions found to delete\n");
      return {
        success: true,
        message: "No duplicate transactions found",
        deleted_count: 0,
      };
    }
  } catch (error) {
    console.error("[CLEANUP] Error:", error);
    return {
      success: false,
      message: error.message || "Failed to cleanup duplicate transactions",
    };
  }
}

// Run cleanup if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`.replace(/\\/g, "/")) {
  cleanupAllDuplicateTransactions()
    .then((result) => {
      console.log("[CLEANUP] Result:", result);
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error("[CLEANUP] Fatal error:", error);
      process.exit(1);
    });
}
