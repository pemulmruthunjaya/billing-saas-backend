-- Presentation-only settings for Sales Invoice printing.
-- Safe to run more than once.

SET @has_invoice_customization = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'invoice_settings'
    AND COLUMN_NAME = 'customization_json'
);

SET @add_invoice_customization = IF(
  @has_invoice_customization = 0,
  'ALTER TABLE invoice_settings ADD COLUMN customization_json JSON NULL',
  'SELECT 1'
);

PREPARE invoice_customization_statement FROM @add_invoice_customization;
EXECUTE invoice_customization_statement;
DEALLOCATE PREPARE invoice_customization_statement;
