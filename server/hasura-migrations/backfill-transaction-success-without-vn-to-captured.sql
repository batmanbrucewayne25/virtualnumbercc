-- One-time repair: legacy rows marked success before VN was linked (webhook race).
-- After deploy, `captured` = paid awaiting fulfillment; `success` = VN linked (terminal).
-- Run during low traffic; replay Razorpay `payment.captured` or rely on next webhook for affected rows.

UPDATE mst_transaction
SET status = 'captured'
WHERE status = 'success'
  AND virtual_number_id IS NULL
  AND payment_mode = 'razorpay'
  AND COALESCE(razorpay_payment_id, '') <> '';

-- Optional: review count before commit
-- SELECT id, transaction_number, razorpay_payment_id FROM mst_transaction
-- WHERE status = 'success' AND virtual_number_id IS NULL;
