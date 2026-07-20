const db = require("../db/connection");

let payrollTablesReady = false;

const getColumnSet = async (table) => {
  const [columns] = await db.query(`SHOW COLUMNS FROM \`${table}\``);
  return new Set(columns.map((column) => column.Field));
};

const ensureColumn = async (table, column, definition) => {
  const columns = await getColumnSet(table);
  if (!columns.has(column)) {
    await db.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  }
};

const ensurePayrollTables = async () => {
  if (payrollTablesReady) {
    return;
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS payroll_employees (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      employee_code VARCHAR(80) NULL,
      phone VARCHAR(50) NULL,
      email VARCHAR(255) NULL,
      designation VARCHAR(150) NULL,
      joining_date DATE NULL,
      monthly_salary DECIMAL(12,2) NOT NULL DEFAULT 0,
      status VARCHAR(30) NOT NULL DEFAULT 'Active',
      notes TEXT NULL,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_payroll_employee_company (company_id),
      INDEX idx_payroll_employee_code (company_id, employee_code),
      INDEX idx_payroll_employee_status (company_id, status)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS payroll_entries (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      employee_id INT NOT NULL,
      employee_name VARCHAR(255) NOT NULL,
      payroll_month VARCHAR(7) NOT NULL,
      payroll_date DATE NOT NULL,
      salary_mode VARCHAR(40) NOT NULL DEFAULT 'Manual',
      working_days DECIMAL(8,2) NOT NULL DEFAULT 0,
      present_days DECIMAL(8,2) NOT NULL DEFAULT 0,
      absent_days DECIMAL(8,2) NOT NULL DEFAULT 0,
      total_hours DECIMAL(10,2) NOT NULL DEFAULT 0,
      overtime_hours DECIMAL(10,2) NOT NULL DEFAULT 0,
      standard_hours DECIMAL(10,2) NOT NULL DEFAULT 0,
      basic_salary DECIMAL(12,2) NOT NULL DEFAULT 0,
      allowances DECIMAL(12,2) NOT NULL DEFAULT 0,
      deductions DECIMAL(12,2) NOT NULL DEFAULT 0,
      net_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      status VARCHAR(30) NOT NULL DEFAULT 'Unpaid',
      payment_date DATE NULL,
      notes TEXT NULL,
      attendance_import_id INT NULL,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_payroll_employee_month (company_id, employee_id, payroll_month),
      INDEX idx_payroll_entries_company_month (company_id, payroll_month),
      INDEX idx_payroll_entries_status (company_id, status)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS payroll_attendance_imports (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      payroll_month VARCHAR(7) NOT NULL,
      file_name VARCHAR(255) NULL,
      row_count INT NOT NULL DEFAULT 0,
      created_count INT NOT NULL DEFAULT 0,
      updated_count INT NOT NULL DEFAULT 0,
      skipped_count INT NOT NULL DEFAULT 0,
      standard_hours_per_day DECIMAL(8,2) NOT NULL DEFAULT 8,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_payroll_attendance_import_company (company_id, created_at)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS payroll_attendance_lines (
      id INT AUTO_INCREMENT PRIMARY KEY,
      import_id INT NOT NULL,
      company_id INT NOT NULL,
      employee_id INT NULL,
      employee_code VARCHAR(80) NULL,
      employee_name VARCHAR(255) NULL,
      payroll_month VARCHAR(7) NOT NULL,
      working_days DECIMAL(8,2) NOT NULL DEFAULT 0,
      present_days DECIMAL(8,2) NOT NULL DEFAULT 0,
      absent_days DECIMAL(8,2) NOT NULL DEFAULT 0,
      total_hours DECIMAL(10,2) NOT NULL DEFAULT 0,
      overtime_hours DECIMAL(10,2) NOT NULL DEFAULT 0,
      allowances DECIMAL(12,2) NOT NULL DEFAULT 0,
      deductions DECIMAL(12,2) NOT NULL DEFAULT 0,
      calculated_salary DECIMAL(12,2) NOT NULL DEFAULT 0,
      status VARCHAR(30) NOT NULL DEFAULT 'Imported',
      message TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_payroll_attendance_lines_import (import_id),
      INDEX idx_payroll_attendance_lines_company (company_id, payroll_month)
    )
  `);

  await ensureColumn("payroll_employees", "employee_code", "VARCHAR(80) NULL AFTER name");
  await ensureColumn("payroll_entries", "salary_mode", "VARCHAR(40) NOT NULL DEFAULT 'Manual' AFTER payroll_date");
  await ensureColumn("payroll_entries", "working_days", "DECIMAL(8,2) NOT NULL DEFAULT 0 AFTER salary_mode");
  await ensureColumn("payroll_entries", "present_days", "DECIMAL(8,2) NOT NULL DEFAULT 0 AFTER working_days");
  await ensureColumn("payroll_entries", "absent_days", "DECIMAL(8,2) NOT NULL DEFAULT 0 AFTER present_days");
  await ensureColumn("payroll_entries", "total_hours", "DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER absent_days");
  await ensureColumn("payroll_entries", "overtime_hours", "DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER total_hours");
  await ensureColumn("payroll_entries", "standard_hours", "DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER overtime_hours");
  await ensureColumn("payroll_entries", "attendance_import_id", "INT NULL AFTER notes");

  payrollTablesReady = true;
};

module.exports = {
  ensurePayrollTables,
};
