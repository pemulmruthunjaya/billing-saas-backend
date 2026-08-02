-- Schema-only migration. This intentionally does not backfill or modify historical balances.
CREATE TABLE IF NOT EXISTS opening_balance_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id INT NOT NULL,
  entity_type ENUM('account','customer','vendor') NOT NULL,
  entity_id BIGINT NOT NULL,
  sequence_no INT NOT NULL,
  event_kind ENUM('initial','adjustment') NOT NULL,
  signed_delta DECIMAL(15,2) NOT NULL,
  target_account_id INT NOT NULL,
  journal_entry_id INT NULL,
  created_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_opening_event_sequence (company_id,entity_type,entity_id,sequence_no),
  UNIQUE KEY uq_opening_event_journal (journal_entry_id),
  KEY idx_opening_event_company_target (company_id,target_account_id),
  CONSTRAINT fk_opening_event_journal
    FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
