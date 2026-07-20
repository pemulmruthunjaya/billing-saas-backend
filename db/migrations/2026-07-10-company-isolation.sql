-- Company isolation migration for SaaS data protection.
-- Review on a backup first.
-- Prefer running the safer Node migration in:
-- db/migrations/run-company-isolation.js

ALTER TABLE products
  ADD COLUMN company_id INT NULL;

ALTER TABLE vendors
  ADD COLUMN company_id INT NULL;

ALTER TABLE bills
  ADD COLUMN company_id INT NULL;

ALTER TABLE accounts
  ADD COLUMN company_id INT NULL;

ALTER TABLE journal_entries
  ADD COLUMN company_id INT NULL;

UPDATE products SET company_id = 1 WHERE company_id IS NULL;
UPDATE vendors SET company_id = 1 WHERE company_id IS NULL;
UPDATE bills SET company_id = 1 WHERE company_id IS NULL;
UPDATE accounts SET company_id = 1 WHERE company_id IS NULL;
UPDATE journal_entries SET company_id = 1 WHERE company_id IS NULL;

ALTER TABLE products
  MODIFY company_id INT NOT NULL;

ALTER TABLE vendors
  MODIFY company_id INT NOT NULL;

ALTER TABLE bills
  MODIFY company_id INT NOT NULL;

ALTER TABLE accounts
  MODIFY company_id INT NOT NULL;

ALTER TABLE journal_entries
  MODIFY company_id INT NOT NULL;

CREATE INDEX idx_products_company_id ON products(company_id);
CREATE INDEX idx_vendors_company_id ON vendors(company_id);
CREATE INDEX idx_bills_company_id ON bills(company_id);
CREATE INDEX idx_accounts_company_id ON accounts(company_id);
CREATE INDEX idx_journal_entries_company_id ON journal_entries(company_id);
