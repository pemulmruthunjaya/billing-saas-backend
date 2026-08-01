-- Safe migration for transactional vendor payments. Run on a backup first.
DROP PROCEDURE IF EXISTS add_column_if_missing;
DELIMITER $$
CREATE PROCEDURE add_column_if_missing(IN table_name_value VARCHAR(64), IN column_name_value VARCHAR(64), IN definition_value TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=table_name_value AND COLUMN_NAME=column_name_value
  ) THEN
    SET @ddl=CONCAT('ALTER TABLE `',table_name_value,'` ADD COLUMN ',definition_value);
    PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
  END IF;
END$$
DELIMITER ;

CALL add_column_if_missing('vendor_payments','paid_from_account_id','paid_from_account_id INT NULL AFTER payment_method');
CALL add_column_if_missing('vendor_payments','reference_number','reference_number VARCHAR(120) NULL AFTER paid_from_account_id');
CALL add_column_if_missing('vendor_payments','created_by','created_by INT NULL AFTER company_id');
CALL add_column_if_missing('vendor_payments','journal_entry_id','journal_entry_id BIGINT NULL AFTER created_by');
CALL add_column_if_missing('vendor_payments','idempotency_key','idempotency_key VARCHAR(100) NULL AFTER journal_entry_id');
CALL add_column_if_missing('vendor_payments','status','status VARCHAR(20) NOT NULL DEFAULT ''SUCCESS'' AFTER idempotency_key');
CALL add_column_if_missing('bills','paid_amount','paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER total_amount');
CALL add_column_if_missing('bills','due_amount','due_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER paid_amount');
CALL add_column_if_missing('journal_entries','vendor_id','vendor_id INT NULL AFTER company_id');
CALL add_column_if_missing('journal_entries','source_type','source_type VARCHAR(50) NULL AFTER vendor_id');
CALL add_column_if_missing('journal_entries','source_id','source_id BIGINT NULL AFTER source_type');
DROP PROCEDURE add_column_if_missing;

SET @has_submission_index=(SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='vendor_payments' AND INDEX_NAME='uq_vendor_payment_submission');
SET @index_sql=IF(@has_submission_index=0,'CREATE UNIQUE INDEX uq_vendor_payment_submission ON vendor_payments(company_id,idempotency_key)','SELECT 1');
PREPARE stmt FROM @index_sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_journal_source_index=(SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='journal_entries' AND INDEX_NAME='uq_journal_source');
SET @journal_index_sql=IF(@has_journal_source_index=0,'CREATE UNIQUE INDEX uq_journal_source ON journal_entries(company_id,source_type,source_id)','SELECT 1');
PREPARE stmt FROM @journal_index_sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE vendor_payments SET status='SUCCESS' WHERE status IS NULL OR status='';
UPDATE bills b
LEFT JOIN (SELECT bill_id,company_id,SUM(amount) paid FROM vendor_payments WHERE status='SUCCESS' GROUP BY bill_id,company_id) p
  ON p.bill_id=b.id AND p.company_id=b.company_id
SET b.paid_amount=GREATEST(COALESCE(p.paid,0),IF(b.status='Paid',b.total_amount,0)),
    b.due_amount=GREATEST(b.total_amount-GREATEST(COALESCE(p.paid,0),IF(b.status='Paid',b.total_amount,0)),0),
    b.status=CASE
      WHEN GREATEST(b.total_amount-GREATEST(COALESCE(p.paid,0),IF(b.status='Paid',b.total_amount,0)),0)<=0 THEN 'Paid'
      WHEN GREATEST(COALESCE(p.paid,0),IF(b.status='Paid',b.total_amount,0))>0 THEN 'Partial Paid'
      ELSE 'Unpaid' END;
