const db = require("../db/connection");

let customerPartySchemaReady = false;

const CUSTOMER_COLUMNS = [
  ["gstin", "VARCHAR(15) NULL"],
  ["pan_number", "VARCHAR(10) NULL"],
  ["opening_balance", "DECIMAL(15,2) NOT NULL DEFAULT 0"],
  ["opening_balance_type", "VARCHAR(20) NOT NULL DEFAULT 'to_collect'"],
  ["party_category", "VARCHAR(100) NULL"],
  ["billing_address", "TEXT NULL"],
  ["shipping_address", "TEXT NULL"],
  ["credit_period_days", "INT NOT NULL DEFAULT 30"],
  ["credit_limit", "DECIMAL(15,2) NOT NULL DEFAULT 0"],
  ["contact_person_name", "VARCHAR(150) NULL"],
  ["contact_person_dob", "DATE NULL"],
];

const ensureCustomerPartySchema = async () => {
  if (customerPartySchemaReady) return;

  const [columns] = await db.query("SHOW COLUMNS FROM customers");
  const existing = new Set(columns.map((column) => column.Field));

  for (const [name, definition] of CUSTOMER_COLUMNS) {
    if (!existing.has(name)) {
      await db.query(`ALTER TABLE customers ADD COLUMN ${name} ${definition}`);
    }
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS customer_bank_accounts (
      id INT NOT NULL AUTO_INCREMENT,
      customer_id INT NOT NULL,
      company_id INT NOT NULL,
      account_holder_name VARCHAR(150) NULL,
      bank_name VARCHAR(150) NOT NULL,
      account_number VARCHAR(50) NOT NULL,
      ifsc_code VARCHAR(11) NULL,
      branch_name VARCHAR(150) NULL,
      is_primary TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_customer_bank_customer (customer_id),
      INDEX idx_customer_bank_company (company_id)
    )
  `);

  customerPartySchemaReady = true;
};

module.exports = { ensureCustomerPartySchema };
