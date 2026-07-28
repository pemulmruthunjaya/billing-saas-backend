-- Adds the selected vendor to Payment Entry journal records.
-- Safe to run more than once on MySQL.

SET @has_vendor_id = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'journal_entries'
    AND COLUMN_NAME = 'vendor_id'
);

SET @add_vendor_id = IF(
  @has_vendor_id = 0,
  'ALTER TABLE journal_entries ADD COLUMN vendor_id INT NULL AFTER company_id',
  'SELECT 1'
);

PREPARE payment_vendor_statement FROM @add_vendor_id;
EXECUTE payment_vendor_statement;
DEALLOCATE PREPARE payment_vendor_statement;

SET @has_vendor_index = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'journal_entries'
    AND INDEX_NAME = 'idx_journal_entries_company_vendor'
);

SET @add_vendor_index = IF(
  @has_vendor_index = 0,
  'CREATE INDEX idx_journal_entries_company_vendor ON journal_entries(company_id, vendor_id)',
  'SELECT 1'
);

PREPARE payment_vendor_index_statement FROM @add_vendor_index;
EXECUTE payment_vendor_index_statement;
DEALLOCATE PREPARE payment_vendor_index_statement;
