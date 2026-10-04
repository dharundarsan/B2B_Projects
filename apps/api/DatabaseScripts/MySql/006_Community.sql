-- Additive apartment ownership, finances, commerce, gate, facilities and map module.
ALTER TABLE property_units ADD CONSTRAINT community_unit_scope UNIQUE (workspace_id,property_id,id);

CREATE TABLE IF NOT EXISTS community_parties (
  id VARCHAR(100) NOT NULL,
  workspace_id VARCHAR(200) NOT NULL,
  property_id VARCHAR(200) NOT NULL,
  revision BIGINT NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  name VARCHAR(200) NOT NULL,
  kind VARCHAR(20) NOT NULL,
  user_id VARCHAR(200),
  PRIMARY KEY (workspace_id,id),
  UNIQUE (workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id) REFERENCES properties(workspace_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE IF NOT EXISTS community_ownerships (
  id VARCHAR(100) NOT NULL,
  workspace_id VARCHAR(200) NOT NULL,
  property_id VARCHAR(200) NOT NULL,
  revision BIGINT NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  unit_id VARCHAR(300) NOT NULL,
  party_id VARCHAR(100) NOT NULL,
  share DECIMAL(14,2) NOT NULL,
  income_share DECIMAL(14,2) NOT NULL,
  expense_share DECIMAL(14,2) NOT NULL,
  starts_on VARCHAR(10) NOT NULL,
  ends_on VARCHAR(10),
  PRIMARY KEY (workspace_id,id),
  UNIQUE (workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id) REFERENCES properties(workspace_id,id),
  FOREIGN KEY (workspace_id,property_id,unit_id) REFERENCES property_units(workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id,party_id) REFERENCES community_parties(workspace_id,property_id,id),
  CHECK (share>0 AND share<=100),
  CHECK (income_share>=0 AND income_share<=100),
  CHECK (expense_share>=0 AND expense_share<=100),
  CHECK (ends_on IS NULL OR ends_on>starts_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE IF NOT EXISTS community_agreements (
  id VARCHAR(100) NOT NULL,
  workspace_id VARCHAR(200) NOT NULL,
  property_id VARCHAR(200) NOT NULL,
  revision BIGINT NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  kind VARCHAR(20) NOT NULL,
  debtor_party_id VARCHAR(100) NOT NULL,
  creditor_party_id VARCHAR(100) NOT NULL,
  parent_id VARCHAR(100),
  occupancy_id VARCHAR(100),
  starts_on VARCHAR(10) NOT NULL,
  ends_on VARCHAR(10) NOT NULL,
  rent DECIMAL(14,2) NOT NULL,
  deposit DECIMAL(14,2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  due_day INT NOT NULL,
  status VARCHAR(20) NOT NULL,
  PRIMARY KEY (workspace_id,id),
  UNIQUE (workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id) REFERENCES properties(workspace_id,id),
  FOREIGN KEY (workspace_id,property_id,debtor_party_id) REFERENCES community_parties(workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id,creditor_party_id) REFERENCES community_parties(workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id,parent_id) REFERENCES community_agreements(workspace_id,property_id,id),
  CHECK (kind IN ('direct','master','sublease')),
  CHECK (rent>0),
  CHECK (deposit>=0),
  CHECK (due_day BETWEEN 1 AND 28),
  CHECK (ends_on>starts_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE IF NOT EXISTS community_charges (
  id VARCHAR(100) NOT NULL,
  workspace_id VARCHAR(200) NOT NULL,
  property_id VARCHAR(200) NOT NULL,
  revision BIGINT NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  agreement_id VARCHAR(100) NOT NULL,
  kind VARCHAR(20) NOT NULL,
  period VARCHAR(10) NOT NULL,
  due_on VARCHAR(10) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  PRIMARY KEY (workspace_id,id),
  UNIQUE (workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id) REFERENCES properties(workspace_id,id),
  FOREIGN KEY (workspace_id,property_id,agreement_id) REFERENCES community_agreements(workspace_id,property_id,id),
  UNIQUE (workspace_id,agreement_id,kind,period),
  CHECK (amount>0),
  CHECK (kind IN ('rent','deposit'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE IF NOT EXISTS community_payments (
  id VARCHAR(100) NOT NULL,
  workspace_id VARCHAR(200) NOT NULL,
  property_id VARCHAR(200) NOT NULL,
  revision BIGINT NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  charge_id VARCHAR(100) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  reference VARCHAR(300) NOT NULL,
  status VARCHAR(20) NOT NULL,
  user_id VARCHAR(200) NOT NULL,
  submission_id VARCHAR(100) NOT NULL,
  verified_by VARCHAR(200),
  PRIMARY KEY (workspace_id,id),
  UNIQUE (workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id) REFERENCES properties(workspace_id,id),
  FOREIGN KEY (workspace_id,property_id,charge_id) REFERENCES community_charges(workspace_id,property_id,id),
  UNIQUE (workspace_id,user_id,submission_id),
  CHECK (amount>0),
  CHECK (status IN ('pending','verified','rejected'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE IF NOT EXISTS community_expenses (
  id VARCHAR(100) NOT NULL,
  workspace_id VARCHAR(200) NOT NULL,
  property_id VARCHAR(200) NOT NULL,
  revision BIGINT NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  scope VARCHAR(20) NOT NULL,
  unit_id VARCHAR(300),
  party_id VARCHAR(100),
  category VARCHAR(100) NOT NULL,
  description LONGTEXT NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  incurred_on VARCHAR(10) NOT NULL,
  paid_status VARCHAR(20) NOT NULL,
  user_id VARCHAR(200) NOT NULL,
  PRIMARY KEY (workspace_id,id),
  UNIQUE (workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id) REFERENCES properties(workspace_id,id),
  FOREIGN KEY (workspace_id,property_id,unit_id) REFERENCES property_units(workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id,party_id) REFERENCES community_parties(workspace_id,property_id,id),
  CHECK (amount>0),
  CHECK (scope IN ('community','unit','operator')),
  CHECK (paid_status IN ('paid','unpaid'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE IF NOT EXISTS community_sellers (
  id VARCHAR(100) NOT NULL,
  workspace_id VARCHAR(200) NOT NULL,
  property_id VARCHAR(200) NOT NULL,
  revision BIGINT NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  user_id VARCHAR(200) NOT NULL,
  name VARCHAR(200) NOT NULL,
  kind VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,
  pickup VARCHAR(300) NOT NULL,
  PRIMARY KEY (workspace_id,id),
  UNIQUE (workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id) REFERENCES properties(workspace_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE IF NOT EXISTS community_products (
  id VARCHAR(100) NOT NULL,
  workspace_id VARCHAR(200) NOT NULL,
  property_id VARCHAR(200) NOT NULL,
  revision BIGINT NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  seller_id VARCHAR(100) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description LONGTEXT NOT NULL,
  kind VARCHAR(20) NOT NULL,
  ingredients LONGTEXT NOT NULL,
  allergens LONGTEXT NOT NULL,
  price DECIMAL(14,2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  stock INT NOT NULL,
  status VARCHAR(20) NOT NULL,
  PRIMARY KEY (workspace_id,id),
  UNIQUE (workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id) REFERENCES properties(workspace_id,id),
  FOREIGN KEY (workspace_id,property_id,seller_id) REFERENCES community_sellers(workspace_id,property_id,id),
  CHECK (price>0),
  CHECK (stock>=0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE IF NOT EXISTS community_groups (
  id VARCHAR(100) NOT NULL,
  workspace_id VARCHAR(200) NOT NULL,
  property_id VARCHAR(200) NOT NULL,
  revision BIGINT NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  product_id VARCHAR(100) NOT NULL,
  seller_id VARCHAR(100) NOT NULL,
  unit_price DECIMAL(14,2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  minimum INT NOT NULL,
  maximum INT NOT NULL,
  closes_at VARCHAR(40) NOT NULL,
  pickup VARCHAR(300) NOT NULL,
  status VARCHAR(20) NOT NULL,
  PRIMARY KEY (workspace_id,id),
  UNIQUE (workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id) REFERENCES properties(workspace_id,id),
  FOREIGN KEY (workspace_id,property_id,product_id) REFERENCES community_products(workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id,seller_id) REFERENCES community_sellers(workspace_id,property_id,id),
  CHECK (unit_price>0),
  CHECK (minimum>0 AND maximum>=minimum),
  CHECK (status IN ('open','confirmed','failed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE IF NOT EXISTS community_orders (
  id VARCHAR(100) NOT NULL,
  workspace_id VARCHAR(200) NOT NULL,
  property_id VARCHAR(200) NOT NULL,
  revision BIGINT NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  product_id VARCHAR(100) NOT NULL,
  seller_id VARCHAR(100) NOT NULL,
  user_id VARCHAR(200) NOT NULL,
  group_id VARCHAR(100),
  quantity INT NOT NULL,
  unit_price DECIMAL(14,2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  status VARCHAR(20) NOT NULL,
  payment_status VARCHAR(20) NOT NULL,
  submission_id VARCHAR(100) NOT NULL,
  PRIMARY KEY (workspace_id,id),
  UNIQUE (workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id) REFERENCES properties(workspace_id,id),
  FOREIGN KEY (workspace_id,property_id,product_id) REFERENCES community_products(workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id,seller_id) REFERENCES community_sellers(workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id,group_id) REFERENCES community_groups(workspace_id,property_id,id),
  UNIQUE (workspace_id,user_id,submission_id),
  CHECK (quantity>0),
  CHECK (unit_price>0),
  CHECK (status IN ('placed','accepted','ready','handed_over','cancelled')),
  CHECK (payment_status IN ('unpaid','paid','refund_due','refunded'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE IF NOT EXISTS community_pledges (
  id VARCHAR(100) NOT NULL,
  workspace_id VARCHAR(200) NOT NULL,
  property_id VARCHAR(200) NOT NULL,
  revision BIGINT NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  group_id VARCHAR(100) NOT NULL,
  user_id VARCHAR(200) NOT NULL,
  quantity INT NOT NULL,
  PRIMARY KEY (workspace_id,id),
  UNIQUE (workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id) REFERENCES properties(workspace_id,id),
  FOREIGN KEY (workspace_id,property_id,group_id) REFERENCES community_groups(workspace_id,property_id,id),
  UNIQUE (workspace_id,group_id,user_id),
  CHECK (quantity>=0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE IF NOT EXISTS community_gate_entries (
  id VARCHAR(100) NOT NULL,
  workspace_id VARCHAR(200) NOT NULL,
  property_id VARCHAR(200) NOT NULL,
  revision BIGINT NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  kind VARCHAR(20) NOT NULL,
  name VARCHAR(200) NOT NULL,
  unit_id VARCHAR(300) NOT NULL,
  occupancy_id VARCHAR(100) NOT NULL,
  resident_user_id VARCHAR(200) NOT NULL,
  expected_at VARCHAR(40) NOT NULL,
  approval VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,
  arrived_at VARCHAR(40),
  departed_at VARCHAR(40),
  accepted_at VARCHAR(40),
  received_at VARCHAR(40),
  user_id VARCHAR(200) NOT NULL,
  PRIMARY KEY (workspace_id,id),
  UNIQUE (workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id) REFERENCES properties(workspace_id,id),
  FOREIGN KEY (workspace_id,property_id,unit_id) REFERENCES property_units(workspace_id,property_id,id),
  CHECK (approval IN ('pending','approved','denied')),
  CHECK (status IN ('expected','arrived','departed','accepted','received'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE IF NOT EXISTS community_facilities (
  id VARCHAR(100) NOT NULL,
  workspace_id VARCHAR(200) NOT NULL,
  property_id VARCHAR(200) NOT NULL,
  revision BIGINT NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  name VARCHAR(200) NOT NULL,
  capacity INT NOT NULL,
  slot_minutes INT NOT NULL,
  price DECIMAL(14,2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  rules LONGTEXT NOT NULL,
  status VARCHAR(20) NOT NULL,
  PRIMARY KEY (workspace_id,id),
  UNIQUE (workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id) REFERENCES properties(workspace_id,id),
  CHECK (capacity>0),
  CHECK (slot_minutes BETWEEN 15 AND 1440),
  CHECK (price>=0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE IF NOT EXISTS community_bookings (
  id VARCHAR(100) NOT NULL,
  workspace_id VARCHAR(200) NOT NULL,
  property_id VARCHAR(200) NOT NULL,
  revision BIGINT NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  facility_id VARCHAR(100) NOT NULL,
  user_id VARCHAR(200) NOT NULL,
  starts_at VARCHAR(40) NOT NULL,
  ends_at VARCHAR(40) NOT NULL,
  status VARCHAR(20) NOT NULL,
  price DECIMAL(14,2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  submission_id VARCHAR(100) NOT NULL,
  PRIMARY KEY (workspace_id,id),
  UNIQUE (workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id) REFERENCES properties(workspace_id,id),
  FOREIGN KEY (workspace_id,property_id,facility_id) REFERENCES community_facilities(workspace_id,property_id,id),
  UNIQUE (workspace_id,user_id,submission_id),
  CHECK (ends_at>starts_at),
  CHECK (price>=0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE IF NOT EXISTS community_notes (
  id VARCHAR(100) NOT NULL,
  workspace_id VARCHAR(200) NOT NULL,
  property_id VARCHAR(200) NOT NULL,
  revision BIGINT NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  kind VARCHAR(20) NOT NULL,
  title VARCHAR(200) NOT NULL,
  body LONGTEXT NOT NULL,
  user_id VARCHAR(200) NOT NULL,
  assigned_user_id VARCHAR(200),
  status VARCHAR(20) NOT NULL,
  PRIMARY KEY (workspace_id,id),
  UNIQUE (workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id) REFERENCES properties(workspace_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE IF NOT EXISTS community_layouts (
  id VARCHAR(100) NOT NULL,
  workspace_id VARCHAR(200) NOT NULL,
  property_id VARCHAR(200) NOT NULL,
  revision BIGINT NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  floor INT NOT NULL,
  name VARCHAR(200) NOT NULL,
  draft_json LONGTEXT NOT NULL,
  published_json LONGTEXT NOT NULL,
  published_at VARCHAR(40),
  PRIMARY KEY (workspace_id,id),
  UNIQUE (workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id) REFERENCES properties(workspace_id,id),
  UNIQUE (workspace_id,property_id,floor),
  CHECK (floor BETWEEN -5 AND 150)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE IF NOT EXISTS community_audit (
  id VARCHAR(100) NOT NULL,
  workspace_id VARCHAR(200) NOT NULL,
  property_id VARCHAR(200) NOT NULL,
  revision BIGINT NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  user_id VARCHAR(200) NOT NULL,
  entity_id VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  PRIMARY KEY (workspace_id,id),
  UNIQUE (workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id) REFERENCES properties(workspace_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE IF NOT EXISTS community_receipts (
  id VARCHAR(100) NOT NULL,
  workspace_id VARCHAR(200) NOT NULL,
  property_id VARCHAR(200) NOT NULL,
  revision BIGINT NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  expense_id VARCHAR(100) NOT NULL,
  path VARCHAR(1000) NOT NULL,
  name VARCHAR(200) NOT NULL,
  content_type VARCHAR(100) NOT NULL,
  size BIGINT NOT NULL,
  status VARCHAR(20) NOT NULL,
  PRIMARY KEY (workspace_id,id),
  UNIQUE (workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id) REFERENCES properties(workspace_id,id),
  FOREIGN KEY (workspace_id,property_id,expense_id) REFERENCES community_expenses(workspace_id,property_id,id),
  CHECK (size>0 AND size<=20971520)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE IF NOT EXISTS community_agreement_units (
  workspace_id VARCHAR(200) NOT NULL,
  property_id VARCHAR(200) NOT NULL,
  agreement_id VARCHAR(100) NOT NULL,
  unit_id VARCHAR(300) NOT NULL,
  PRIMARY KEY (workspace_id,agreement_id,unit_id),
  FOREIGN KEY (workspace_id,property_id,agreement_id) REFERENCES community_agreements(workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id,unit_id) REFERENCES property_units(workspace_id,property_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE IF NOT EXISTS community_expense_allocations (
  workspace_id VARCHAR(200) NOT NULL,
  property_id VARCHAR(200) NOT NULL,
  expense_id VARCHAR(100) NOT NULL,
  party_id VARCHAR(100) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  PRIMARY KEY (workspace_id,expense_id,party_id),
  FOREIGN KEY (workspace_id,property_id,expense_id) REFERENCES community_expenses(workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id,party_id) REFERENCES community_parties(workspace_id,property_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;
