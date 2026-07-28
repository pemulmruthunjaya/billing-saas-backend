CREATE TABLE IF NOT EXISTS recurring_invoices (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id BIGINT UNSIGNED NOT NULL,
  frequency ENUM('daily','weekly','monthly','quarterly','yearly') NOT NULL,
  repeat_every INT UNSIGNED NOT NULL DEFAULT 1,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  next_invoice_date DATE NOT NULL,
  auto_email TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('Draft','Active','Paused','Completed','Cancelled') NOT NULL DEFAULT 'Draft',
  notes TEXT NULL,
  company_id BIGINT UNSIGNED NOT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_recurring_invoices_company_status (company_id, status),
  KEY idx_recurring_invoices_due (company_id, next_invoice_date, status),
  KEY idx_recurring_invoices_customer (company_id, customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS recurring_invoice_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  recurring_invoice_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  description VARCHAR(500) NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  unit_price DECIMAL(15,2) NOT NULL,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  amount DECIMAL(15,2) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_recurring_invoice_items_parent (recurring_invoice_id),
  CONSTRAINT fk_recurring_invoice_items_parent
    FOREIGN KEY (recurring_invoice_id) REFERENCES recurring_invoices(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
