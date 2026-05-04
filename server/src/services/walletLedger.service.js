const DEFAULT_MAX_ATTEMPTS = 4;
const DEFAULT_PENDING_WAIT_ATTEMPTS = 20;
const DEFAULT_PENDING_WAIT_MS = 100;
const DEFAULT_STALE_PENDING_MS = 2 * 60 * 1000;

export function normalizeWalletAmount(value) {
  if (value == null || value === "") return 0;
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function isWalletUniqueConstraintError(error) {
  const msg = [
    error?.message,
    error?.response?.errors?.[0]?.message,
    error?.response?.errors?.[0]?.extensions?.code,
  ]
    .filter(Boolean)
    .join(" ");
  return /duplicate key|unique constraint|Uniqueness violation|uq_wallet_txn_wallet_reference/i.test(
    msg,
  );
}

const sameMoney = (a, b) =>
  Math.abs(normalizeWalletAmount(a) - normalizeWalletAmount(b)) < 0.0001;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getHasuraRunSqlEndpoint() {
  const endpoint = process.env.HASURA_GRAPHQL_ENDPOINT;
  if (!endpoint) {
    throw new Error("HASURA_GRAPHQL_ENDPOINT is not set");
  }
  if (endpoint.includes("/v1/graphql")) {
    return endpoint.replace(/\/v1\/graphql\/?$/, "/v2/query");
  }
  return endpoint.replace(/\/+$/, "") + "/v2/query";
}

function sqlText(value) {
  if (value == null || value === "") return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlUuid(value) {
  if (value == null || value === "") return "NULL::uuid";
  const s = String(value);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
    throw new Error(`Invalid UUID for wallet debit: ${s}`);
  }
  return `'${s}'::uuid`;
}

function parseRunSqlRows(result) {
  const rows = result?.result;
  if (!Array.isArray(rows) || rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index]])),
  );
}

async function runHasuraSql(sql) {
  const secret = process.env.HASURA_ADMIN_SECRET;
  if (!secret) {
    throw new Error("HASURA_ADMIN_SECRET is required for atomic wallet debit");
  }
  const response = await fetch(getHasuraRunSqlEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hasura-admin-secret": secret,
    },
    body: JSON.stringify({
      type: "run_sql",
      args: {
        source: process.env.HASURA_GRAPHQL_SOURCE || "Virtual",
        sql,
      },
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.error || body?.code) {
    throw new Error(
      body?.error ||
        body?.internal?.error?.message ||
        body?.message ||
        `Hasura run_sql failed with HTTP ${response.status}`,
    );
  }
  return body;
}

async function debitWalletOnceInDatabase({
  walletId,
  amount,
  description,
  reference,
  customerId,
  virtualNumberId,
}) {
  const amountNum = normalizeWalletAmount(amount);
  const sql = `
    SELECT
      status,
      ledger_id::text AS ledger_id,
      balance_before::text AS balance_before,
      balance_after::text AS balance_after
    FROM public.debit_wallet_once(
      ${sqlUuid(walletId)},
      ${amountNum},
      ${sqlText(reference)},
      ${sqlText(description)},
      ${sqlUuid(customerId)},
      ${sqlUuid(virtualNumberId)}
    );
  `;
  const result = await runHasuraSql(sql);
  return parseRunSqlRows(result)[0] || null;
}

async function getDebitLedgerByReference(client, walletId, reference) {
  const result = await client.client.request(
    `query WalletDebitLedgerByReference($wallet_id: uuid!, $reference: String!) {
      mst_wallet_transaction(
        where: {
          wallet_id: { _eq: $wallet_id }
          reference: { _eq: $reference }
          transaction_type: { _eq: "DEBIT" }
        }
        limit: 1
      ) {
        id
        wallet_id
        amount
        balance_before
        balance_after
        debit_status
        customer_id
        virtual_number_id
        created_at
      }
    }`,
    { wallet_id: walletId, reference },
  );
  return result?.mst_wallet_transaction?.[0] || null;
}

async function patchDebitLedgerContext(
  client,
  ledgerId,
  customerId,
  virtualNumberId,
) {
  if (!ledgerId || (!customerId && !virtualNumberId)) return;
  try {
    if (customerId && virtualNumberId) {
      await client.client.request(
        `mutation PatchWalletDebitLedgerContext(
          $id: uuid!
          $customer_id: uuid!
          $virtual_number_id: uuid
        ) {
          update_mst_wallet_transaction(
            where: {
              _and: [
                { id: { _eq: $id } }
                {
                  _or: [
                    { customer_id: { _is_null: true } }
                    { virtual_number_id: { _is_null: true } }
                  ]
                }
              ]
            }
            _set: {
              customer_id: $customer_id
              virtual_number_id: $virtual_number_id
            }
          ) {
            affected_rows
          }
        }`,
        {
          id: ledgerId,
          customer_id: customerId,
          virtual_number_id: virtualNumberId || null,
        },
      );
      return;
    }

    if (customerId) {
      await client.client.request(
        `mutation PatchWalletDebitLedgerCustomer(
          $id: uuid!
          $customer_id: uuid!
        ) {
          update_mst_wallet_transaction(
            where: {
              _and: [
                { id: { _eq: $id } }
                { customer_id: { _is_null: true } }
              ]
            }
            _set: { customer_id: $customer_id }
          ) {
            affected_rows
          }
        }`,
        {
          id: ledgerId,
          customer_id: customerId,
        },
      );
      return;
    }

    await client.client.request(
      `mutation PatchWalletDebitLedgerVirtualNumber(
        $id: uuid!
        $virtual_number_id: uuid!
      ) {
        update_mst_wallet_transaction(
          where: {
            _and: [
              { id: { _eq: $id } }
              { virtual_number_id: { _is_null: true } }
            ]
          }
          _set: { virtual_number_id: $virtual_number_id }
        ) {
          affected_rows
        }
      }`,
      {
        id: ledgerId,
        virtual_number_id: virtualNumberId,
      },
    );
  } catch (error) {
    console.warn(
      `[walletLedger] context patch skipped for ledger=${ledgerId}:`,
      error.message,
    );
  }
}

async function fetchWalletById(client, walletId) {
  const result = await client.client.request(
    `query WalletForLedgerDebit($id: uuid!) {
      mst_wallet_by_pk(id: $id) {
        id
        balance
        debit_amount
      }
    }`,
    { id: walletId },
  );
  return result?.mst_wallet_by_pk || null;
}

async function deleteLedgerByStatus(client, ledgerId, debitStatus) {
  if (!ledgerId) return false;
  const result = await client.client.request(
    `mutation DeleteWalletDebitLedgerByStatus($id: uuid!, $debit_status: String!) {
      delete_mst_wallet_transaction(
        where: {
          _and: [
            { id: { _eq: $id } }
            { debit_status: { _eq: $debit_status } }
          ]
        }
      ) {
        affected_rows
      }
    }`,
    { id: ledgerId, debit_status: debitStatus },
  );
  return (result?.delete_mst_wallet_transaction?.affected_rows || 0) === 1;
}

async function deletePendingLedger(client, ledgerId) {
  return deleteLedgerByStatus(client, ledgerId, "pending");
}

async function finalizePendingLedger(
  client,
  ledgerId,
  balanceBefore,
  balanceAfter,
  customerId,
  virtualNumberId,
) {
  const result = await client.client.request(
    `mutation FinalizePendingWalletDebitLedger(
      $id: uuid!
      $balance_before: numeric!
      $balance_after: numeric!
      $customer_id: uuid
      $virtual_number_id: uuid
    ) {
      update_mst_wallet_transaction(
        where: {
          _and: [
            { id: { _eq: $id } }
            { debit_status: { _eq: "pending" } }
          ]
        }
        _set: {
          balance_before: $balance_before
          balance_after: $balance_after
          customer_id: $customer_id
          virtual_number_id: $virtual_number_id
          debit_status: "success"
        }
      ) {
        affected_rows
      }
    }`,
    {
      id: ledgerId,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      customer_id: customerId || null,
      virtual_number_id: virtualNumberId || null,
    },
  );
  return (result?.update_mst_wallet_transaction?.affected_rows || 0) === 1;
}

async function waitForPendingLedger(client, walletId, reference, options) {
  for (let i = 0; i < options.pendingWaitAttempts; i++) {
    const row = await getDebitLedgerByReference(client, walletId, reference);
    if (!row) return { kind: "missing" };
    if (row.debit_status === "success" || row.debit_status == null) {
      return { kind: "success", row };
    }
    if (row.debit_status === "failed") {
      return { kind: "failed", row };
    }
    await sleep(options.pendingWaitMs);
  }
  return {
    kind: "timeout",
    row: await getDebitLedgerByReference(client, walletId, reference),
  };
}

async function recoverPendingLedger(client, row, amount, options) {
  if (!row?.id || row.debit_status !== "pending") {
    return { kind: "not_pending" };
  }

  const createdMs = Date.parse(row.created_at || "");
  const stale =
    !Number.isFinite(createdMs) || Date.now() - createdMs >= options.staleMs;
  if (!stale) return { kind: "fresh" };

  const wallet = await fetchWalletById(client, row.wallet_id);
  if (!wallet?.id) return { kind: "wallet_missing" };

  const walletBalance = normalizeWalletAmount(wallet.balance);
  const ledgerBefore = normalizeWalletAmount(row.balance_before);
  const ledgerAfter = normalizeWalletAmount(row.balance_after);
  const ledgerAmount = normalizeWalletAmount(row.amount);

  if (!sameMoney(ledgerAmount, amount)) {
    return { kind: "amount_mismatch" };
  }

  if (sameMoney(walletBalance, ledgerAfter)) {
    const finalized = await finalizePendingLedger(
      client,
      row.id,
      ledgerBefore,
      ledgerAfter,
      row.customer_id || null,
      row.virtual_number_id || null,
    );
    return finalized ? { kind: "finalized" } : { kind: "finalize_failed" };
  }

  if (sameMoney(walletBalance, ledgerBefore)) {
    const deleted = await deletePendingLedger(client, row.id);
    return deleted ? { kind: "released" } : { kind: "release_failed" };
  }

  return { kind: "manual_reconcile" };
}

/**
 * Debit a wallet without allowing balance/history drift:
 * 1. insert a pending ledger row keyed by wallet_id + reference
 * 2. CAS-update the wallet from the exact balance used in the ledger
 * 3. mark the ledger success
 */
export async function debitWalletLedgerFirst(
  client,
  {
    walletId,
    amount,
    description = "Wallet debit",
    reference,
    customerId = null,
    virtualNumberId = null,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    pendingWaitAttempts = DEFAULT_PENDING_WAIT_ATTEMPTS,
    pendingWaitMs = DEFAULT_PENDING_WAIT_MS,
    staleMs = DEFAULT_STALE_PENDING_MS,
  },
) {
  const amountNum = normalizeWalletAmount(amount);
  const refStr =
    reference != null && reference !== "" ? String(reference).trim() : "";

  if (!walletId) {
    return { ok: false, status: "wallet_missing", message: "Wallet not found" };
  }
  if (!refStr) {
    return {
      ok: false,
      status: "missing_reference",
      message: "Wallet debit reference is required",
    };
  }
  if (amountNum <= 0) {
    return {
      ok: false,
      status: "invalid_amount",
      message: "Invalid debit amount",
    };
  }

  try {
    const row = await debitWalletOnceInDatabase({
      walletId,
      amount: amountNum,
      description,
      reference: refStr,
      customerId,
      virtualNumberId,
    });
    if (!row) {
      return {
        ok: false,
        status: "db_function_no_result",
        message: "Atomic wallet debit returned no result",
      };
    }

    const status = row.status;
    const ok =
      status === "debited" ||
      status === "already_debited" ||
      status === "already_debited_repaired";
    return {
      ok,
      status,
      ledgerId: row.ledger_id || null,
      balanceBefore: normalizeWalletAmount(row.balance_before),
      balanceAfter: normalizeWalletAmount(row.balance_after),
      message: ok
        ? undefined
        : status === "insufficient_balance"
          ? `Insufficient wallet balance. Required: ${amountNum.toFixed(2)}, Available: ${normalizeWalletAmount(row.balance_before).toFixed(2)}.`
          : `Wallet debit failed (${status})`,
    };
  } catch (error) {
    console.error("[walletLedger] atomic database debit failed:", error.message);
    return {
      ok: false,
      status: "atomic_debit_failed",
      message: error.message || "Atomic wallet debit failed",
    };
  }

  const options = { pendingWaitAttempts, pendingWaitMs, staleMs };

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const existing = await getDebitLedgerByReference(client, walletId, refStr);
    if (existing) {
      if (existing.debit_status === "success" || existing.debit_status == null) {
        await patchDebitLedgerContext(
          client,
          existing.id,
          customerId,
          virtualNumberId,
        );
        return {
          ok: true,
          status: "already_debited",
          ledgerId: existing.id,
          balanceBefore: normalizeWalletAmount(existing.balance_before),
          balanceAfter: normalizeWalletAmount(existing.balance_after),
        };
      }

      if (existing.debit_status === "pending") {
        const waited = await waitForPendingLedger(
          client,
          walletId,
          refStr,
          options,
        );
        if (waited.kind === "success") {
          await patchDebitLedgerContext(
            client,
            waited.row.id,
            customerId,
            virtualNumberId,
          );
          return {
            ok: true,
            status: "already_debited",
            ledgerId: waited.row.id,
            balanceBefore: normalizeWalletAmount(waited.row.balance_before),
            balanceAfter: normalizeWalletAmount(waited.row.balance_after),
          };
        }
        if (waited.kind === "failed" && waited.row?.id) {
          await deleteLedgerByStatus(client, waited.row.id, "failed");
          continue;
        }
        const recovery = await recoverPendingLedger(
          client,
          waited.row || existing,
          amountNum,
          options,
        );
        if (recovery.kind === "finalized") {
          continue;
        }
        if (recovery.kind === "released") {
          continue;
        }
        return {
          ok: false,
          status: "debit_in_progress",
          message: "Wallet debit is already in progress. Please retry shortly.",
        };
      }

      if (existing.debit_status === "failed") {
        await deleteLedgerByStatus(client, existing.id, "failed");
      }
    }

    const wallet = await fetchWalletById(client, walletId);
    if (!wallet?.id) {
      return {
        ok: false,
        status: "wallet_missing",
        message: "Wallet not found",
      };
    }

    const balanceBefore = normalizeWalletAmount(wallet.balance);
    const debitBefore = normalizeWalletAmount(wallet.debit_amount);
    if (balanceBefore < amountNum) {
      return {
        ok: false,
        status: "insufficient_balance",
        message: `Insufficient wallet balance. Required: ${amountNum.toFixed(2)}, Available: ${balanceBefore.toFixed(2)}.`,
      };
    }

    const balanceAfter = balanceBefore - amountNum;
    let ledgerId = null;
    try {
      const inserted = await client.client.request(
        `mutation InsertPendingWalletDebitLedger(
          $wallet_id: uuid!
          $amount: numeric!
          $balance_before: numeric!
          $balance_after: numeric!
          $description: String
          $reference: String!
          $customer_id: uuid
          $virtual_number_id: uuid
        ) {
          insert_mst_wallet_transaction_one(object: {
            wallet_id: $wallet_id
            transaction_type: "DEBIT"
            amount: $amount
            balance_before: $balance_before
            balance_after: $balance_after
            description: $description
            reference: $reference
            customer_id: $customer_id
            virtual_number_id: $virtual_number_id
            debit_status: "pending"
          }) {
            id
          }
        }`,
        {
          wallet_id: walletId,
          amount: amountNum,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          description,
          reference: refStr,
          customer_id: customerId || null,
          virtual_number_id: virtualNumberId || null,
        },
      );
      ledgerId = inserted?.insert_mst_wallet_transaction_one?.id || null;
      if (!ledgerId) {
        return {
          ok: false,
          status: "ledger_insert_failed",
          message: "Wallet debit ledger insert failed",
        };
      }
    } catch (error) {
      if (isWalletUniqueConstraintError(error)) {
        continue;
      }
      throw error;
    }

    const newDebitAmount = debitBefore + amountNum;
    const casResult = await client.client.request(
      `mutation DebitWalletBalanceCAS(
        $id: uuid!
        $balance_eq: numeric!
        $new_balance: numeric!
        $new_debit_amount: numeric!
        $last_transaction_at: timestamp!
      ) {
        update_mst_wallet(
          where: {
            _and: [
              { id: { _eq: $id } }
              { balance: { _eq: $balance_eq } }
            ]
          }
          _set: {
            balance: $new_balance
            debit_amount: $new_debit_amount
            last_transaction_at: $last_transaction_at
          }
        ) {
          affected_rows
          returning {
            id
            balance
            debit_amount
          }
        }
      }`,
      {
        id: walletId,
        balance_eq: balanceBefore,
        new_balance: balanceAfter,
        new_debit_amount: newDebitAmount,
        last_transaction_at: new Date().toISOString(),
      },
    );

    if ((casResult?.update_mst_wallet?.affected_rows || 0) !== 1) {
      await deletePendingLedger(client, ledgerId);
      continue;
    }

    const finalized = await finalizePendingLedger(
      client,
      ledgerId,
      balanceBefore,
      balanceAfter,
      customerId,
      virtualNumberId,
    );

    if (!finalized) {
      return {
        ok: false,
        status: "ledger_finalize_failed",
        message:
          "Wallet balance was debited but ledger is still pending. Retry will reconcile it.",
        ledgerId,
        balanceBefore,
        balanceAfter,
      };
    }

    return {
      ok: true,
      status: "debited",
      ledgerId,
      balanceBefore,
      balanceAfter,
    };
  }

  return {
    ok: false,
    status: "cas_retry_exhausted",
    message: "Wallet debit could not be completed because balance changed.",
  };
}
