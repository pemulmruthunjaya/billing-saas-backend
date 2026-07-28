CREATE TABLE IF NOT EXISTS receipt_entries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  receipt_number VARCHAR(60) NOT NULL,
  receipt_date DATE NOT NULL,
  receipt_type ENUM('CUSTOMER','OTHER','ADVANCE') NOT NULL,
  customer_id BIGINT UNSIGNED NULL,
  invoice_id BIGINT UNSIGNED NULL,
  received_in_account_id BIGINT UNSIGNED NOT NULL,
  received_from_account_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  payment_mode VARCHAR(40) NOT NULL,
  reference_number VARCHAR(120) NULL,
  narration VARCHAR(500) NULL,
  company_id BIGINT UNSIGNED NOT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  journal_entry_id BIGINT UNSIGNED NULL,
  payment_id BIGINT UNSIGNED NULL,
  advance_id BIGINT UNSIGNED NULL,
  idempotency_key VARCHAR(80) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_receipt_company_number (company_id, receipt_number),
  UNIQUE KEY uq_receipt_company_idempotency (company_id, idempotency_key),
  KEY idx_receipt_company_date (company_id, receipt_date),
  KEY idx_receipt_customer (company_id, customer_id),
  KEY idx_receipt_invoice (company_id, invoice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customer_advances (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  receipt_entry_id BIGINT UNSIGNED NOT NULL,
  original_amount DECIMAL(15,2) NOT NULL,
  unapplied_amount DECIMAL(15,2) NOT NULL,
  status ENUM('UNAPPLIED','PARTIALLY_APPLIED','APPLIED','CANCELLED') NOT NULL DEFAULT 'UNAPPLIED',
  created_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_customer_advance_receipt (company_id, receipt_entry_id),
  KEY idx_customer_advances_customer (company_id, customer_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE payments
  ADD COLUMN receipt_entry_id BIGINT UNSIGNED NULL;

CREATE UNIQUE INDEX uq_payments_receipt_entry
  ON payments (receipt_entry_id);
