-- ============================================================================
-- Atomic, idempotent wallet debit
-- ============================================================================
-- Serializes all debits for one wallet with SELECT ... FOR UPDATE and keeps the
-- wallet balance update + wallet ledger success transition in one Postgres
-- transaction. This prevents webhook retries from changing mst_wallet.balance
-- more than once while UNIQUE(wallet_id, reference) keeps only one history row.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.debit_wallet_once(
  p_wallet_id uuid,
  p_amount numeric,
  p_reference text,
  p_description text DEFAULT NULL,
  p_customer_id uuid DEFAULT NULL,
  p_virtual_number_id uuid DEFAULT NULL
)
RETURNS TABLE (
  status text,
  ledger_id uuid,
  balance_before numeric,
  balance_after numeric
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_wallet mst_wallet%ROWTYPE;
  v_ledger mst_wallet_transaction%ROWTYPE;
  v_before numeric;
  v_after numeric;
  v_success_debit_total numeric;
  v_prior_success_debit_total numeric;
  v_expected_balance numeric;
  v_wallet_drift_epsilon numeric := 0.0001;
  v_repaired boolean := false;
BEGIN
  IF p_wallet_id IS NULL THEN
    RETURN QUERY SELECT 'wallet_missing'::text, NULL::uuid, NULL::numeric, NULL::numeric;
    RETURN;
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN QUERY SELECT 'invalid_amount'::text, NULL::uuid, NULL::numeric, NULL::numeric;
    RETURN;
  END IF;

  IF p_reference IS NULL OR btrim(p_reference) = '' THEN
    RETURN QUERY SELECT 'missing_reference'::text, NULL::uuid, NULL::numeric, NULL::numeric;
    RETURN;
  END IF;

  SELECT *
  INTO v_wallet
  FROM mst_wallet
  WHERE id = p_wallet_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'wallet_missing'::text, NULL::uuid, NULL::numeric, NULL::numeric;
    RETURN;
  END IF;

  SELECT *
  INTO v_ledger
  FROM mst_wallet_transaction
  WHERE wallet_id = p_wallet_id
    AND reference = p_reference
    AND transaction_type = 'DEBIT'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF COALESCE(v_ledger.debit_status, 'success') = 'success' THEN
      SELECT COALESCE(SUM(amount), 0)
      INTO v_success_debit_total
      FROM mst_wallet_transaction
      WHERE wallet_id = p_wallet_id
        AND transaction_type = 'DEBIT'
        AND COALESCE(debit_status, 'success') = 'success';

      SELECT COALESCE(SUM(amount), 0)
      INTO v_prior_success_debit_total
      FROM mst_wallet_transaction
      WHERE wallet_id = p_wallet_id
        AND transaction_type = 'DEBIT'
        AND COALESCE(debit_status, 'success') = 'success'
        AND id <> v_ledger.id
        AND (
          created_at < v_ledger.created_at
          OR (created_at = v_ledger.created_at AND id::text < v_ledger.id::text)
        );

      v_before := COALESCE(v_wallet.credit_amount, 0) - v_prior_success_debit_total;
      v_after := v_before - COALESCE(v_ledger.amount, 0);
      v_expected_balance := COALESCE(v_wallet.credit_amount, 0) - v_success_debit_total;
      v_repaired := false;

      IF (
        ABS(COALESCE(v_wallet.debit_amount, 0) - v_success_debit_total) > v_wallet_drift_epsilon
        OR ABS(COALESCE(v_wallet.balance, 0) - v_expected_balance) > v_wallet_drift_epsilon
      ) THEN
        UPDATE mst_wallet
        SET
          balance = v_expected_balance,
          debit_amount = v_success_debit_total,
          last_transaction_at = now()
        WHERE id = p_wallet_id;
        v_repaired := true;
      END IF;

      UPDATE mst_wallet_transaction
      SET
        customer_id = COALESCE(mst_wallet_transaction.customer_id, p_customer_id),
        virtual_number_id = COALESCE(mst_wallet_transaction.virtual_number_id, p_virtual_number_id),
        balance_before = v_before,
        balance_after = v_after
      WHERE id = v_ledger.id
      RETURNING * INTO v_ledger;

      RETURN QUERY SELECT
        CASE WHEN v_repaired THEN 'already_debited_repaired'::text ELSE 'already_debited'::text END,
        v_ledger.id,
        v_ledger.balance_before,
        v_ledger.balance_after;
      RETURN;
    END IF;

    IF v_ledger.debit_status = 'pending' THEN
      IF v_wallet.balance = v_ledger.balance_after THEN
        UPDATE mst_wallet_transaction
        SET
          debit_status = 'success',
          customer_id = COALESCE(mst_wallet_transaction.customer_id, p_customer_id),
          virtual_number_id = COALESCE(mst_wallet_transaction.virtual_number_id, p_virtual_number_id)
        WHERE id = v_ledger.id;

        RETURN QUERY SELECT
          'already_debited'::text,
          v_ledger.id,
          v_ledger.balance_before,
          v_ledger.balance_after;
        RETURN;
      END IF;

      IF v_wallet.balance = v_ledger.balance_before THEN
        DELETE FROM mst_wallet_transaction WHERE id = v_ledger.id;
      ELSE
        RETURN QUERY SELECT
          'manual_reconcile'::text,
          v_ledger.id,
          v_ledger.balance_before,
          v_ledger.balance_after;
        RETURN;
      END IF;
    ELSIF v_ledger.debit_status = 'failed' THEN
      DELETE FROM mst_wallet_transaction WHERE id = v_ledger.id;
    ELSE
      RETURN QUERY SELECT
        'manual_reconcile'::text,
        v_ledger.id,
        v_ledger.balance_before,
        v_ledger.balance_after;
      RETURN;
    END IF;
  END IF;

  SELECT COALESCE(SUM(amount), 0)
  INTO v_success_debit_total
  FROM mst_wallet_transaction
  WHERE wallet_id = p_wallet_id
    AND transaction_type = 'DEBIT'
    AND COALESCE(debit_status, 'success') = 'success';

  v_before := COALESCE(v_wallet.credit_amount, 0) - v_success_debit_total;

  IF v_before < p_amount THEN
    RETURN QUERY SELECT
      'insufficient_balance'::text,
      NULL::uuid,
      v_before,
      v_before;
    RETURN;
  END IF;

  v_after := v_before - p_amount;

  INSERT INTO mst_wallet_transaction (
    wallet_id,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    description,
    reference,
    customer_id,
    virtual_number_id,
    debit_status
  )
  VALUES (
    p_wallet_id,
    'DEBIT',
    p_amount,
    v_before,
    v_after,
    p_description,
    p_reference,
    p_customer_id,
    p_virtual_number_id,
    'success'
  )
  RETURNING * INTO v_ledger;

  UPDATE mst_wallet
  SET
    balance = v_after,
    debit_amount = v_success_debit_total + p_amount,
    last_transaction_at = now()
  WHERE id = p_wallet_id;

  RETURN QUERY SELECT 'debited'::text, v_ledger.id, v_before, v_after;
END;
$$;

-- Keep the wallet summary row canonical even if an older code path tries to
-- change balance/debit_amount directly. Successful wallet ledger rows are the
-- source of truth; credit_amount is the credited total.
CREATE OR REPLACE FUNCTION public.enforce_wallet_ledger_totals()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_success_debit_total numeric;
BEGIN
  SELECT COALESCE(SUM(amount), 0)
  INTO v_success_debit_total
  FROM mst_wallet_transaction
  WHERE wallet_id = NEW.id
    AND transaction_type = 'DEBIT'
    AND COALESCE(debit_status, 'success') = 'success';

  NEW.debit_amount := v_success_debit_total;
  NEW.balance := COALESCE(NEW.credit_amount, 0) - v_success_debit_total;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_wallet_ledger_totals ON mst_wallet;

CREATE TRIGGER trg_enforce_wallet_ledger_totals
BEFORE UPDATE OF balance, credit_amount, debit_amount ON mst_wallet
FOR EACH ROW
EXECUTE FUNCTION public.enforce_wallet_ledger_totals();

-- If any code path writes a successful ledger row directly, keep mst_wallet in
-- sync immediately. The wallet row is a summary; successful DEBIT ledger rows
-- are the source of truth.
CREATE OR REPLACE FUNCTION public.sync_wallet_from_success_debit_ledger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_wallet_id uuid;
  v_success_debit_total numeric;
BEGIN
  v_wallet_id := COALESCE(NEW.wallet_id, OLD.wallet_id);

  IF v_wallet_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(amount), 0)
  INTO v_success_debit_total
  FROM mst_wallet_transaction
  WHERE wallet_id = v_wallet_id
    AND transaction_type = 'DEBIT'
    AND COALESCE(debit_status, 'success') = 'success';

  UPDATE mst_wallet
  SET
    debit_amount = v_success_debit_total,
    balance = COALESCE(credit_amount, 0) - v_success_debit_total,
    last_transaction_at = now()
  WHERE id = v_wallet_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_wallet_from_success_debit_ledger ON mst_wallet_transaction;

CREATE TRIGGER trg_sync_wallet_from_success_debit_ledger
AFTER INSERT OR UPDATE OF amount, debit_status, transaction_type, wallet_id OR DELETE ON mst_wallet_transaction
FOR EACH ROW
EXECUTE FUNCTION public.sync_wallet_from_success_debit_ledger();
