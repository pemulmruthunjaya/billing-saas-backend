-- Multi-company and branch foundation.
-- This migration is additive. Existing company_id data and accounting records are unchanged.

CREATE TABLE IF NOT EXISTS user_company_memberships (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  company_id INT NOT NULL,
  membership_role ENUM('owner', 'staff') NOT NULL DEFAULT 'staff',
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_company_membership (user_id, company_id),
  KEY idx_membership_company (company_id, is_active),
  CONSTRAINT fk_membership_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_membership_company FOREIGN KEY (company_id) REFERENCES companies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO user_company_memberships
  (user_id, company_id, membership_role, is_default, is_active)
SELECT id, company_id, IF(role = 'owner', 'owner', 'staff'), 1, IFNULL(is_active, 1)
FROM users
WHERE company_id IS NOT NULL
ON DUPLICATE KEY UPDATE
  membership_role = VALUES(membership_role),
  is_active = VALUES(is_active);

CREATE TABLE IF NOT EXISTS branches (
  id INT NOT NULL AUTO_INCREMENT,
  company_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  code VARCHAR(40) NOT NULL,
  branch_type ENUM('HEAD_OFFICE', 'BRANCH', 'STORE', 'WAREHOUSE') NOT NULL DEFAULT 'BRANCH',
  phone VARCHAR(30) NULL,
  email VARCHAR(190) NULL,
  address TEXT NULL,
  city VARCHAR(100) NULL,
  state VARCHAR(100) NULL,
  pincode VARCHAR(12) NULL,
  gstin VARCHAR(20) NULL,
  is_head_office TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_company_branch_code (company_id, code),
  KEY idx_branch_company_active (company_id, is_active),
  CONSTRAINT fk_branch_company FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT fk_branch_creator FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO branches (company_id, name, code, branch_type, is_head_office, is_active)
SELECT c.id, 'Head Office', 'HO', 'HEAD_OFFICE', 1, 1
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM branches b WHERE b.company_id = c.id AND b.is_head_office = 1
);

CREATE TABLE IF NOT EXISTS user_branch_memberships (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  company_id INT NOT NULL,
  branch_id INT NOT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_branch_membership (user_id, branch_id),
  KEY idx_user_branch_company (user_id, company_id, is_active),
  CONSTRAINT fk_user_branch_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_user_branch_company FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT fk_user_branch_branch FOREIGN KEY (branch_id) REFERENCES branches(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO user_branch_memberships (user_id, company_id, branch_id, is_default, is_active)
SELECT u.id, u.company_id, b.id, 1, IFNULL(u.is_active, 1)
FROM users u
JOIN branches b ON b.company_id = u.company_id AND b.is_head_office = 1
WHERE u.company_id IS NOT NULL
ON DUPLICATE KEY UPDATE is_active = VALUES(is_active);

CREATE TABLE IF NOT EXISTS company_business_settings (
  company_id INT NOT NULL,
  business_types JSON NULL,
  industry_type VARCHAR(120) NULL,
  registration_type VARCHAR(120) NULL,
  state VARCHAR(100) NULL,
  city VARCHAR(100) NULL,
  pincode VARCHAR(12) NULL,
  pan_number VARCHAR(20) NULL,
  gst_registered TINYINT(1) NOT NULL DEFAULT 0,
  e_invoicing_enabled TINYINT(1) NOT NULL DEFAULT 0,
  tds_enabled TINYINT(1) NOT NULL DEFAULT 0,
  tcs_enabled TINYINT(1) NOT NULL DEFAULT 0,
  signature LONGTEXT NULL,
  additional_details JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (company_id),
  CONSTRAINT fk_business_settings_company FOREIGN KEY (company_id) REFERENCES companies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
