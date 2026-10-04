-- Additive apartment ownership, finances, commerce, gate, facilities and map module.
CREATE UNIQUE INDEX IF NOT EXISTS community_unit_scope ON property_units(workspace_id,property_id,id);

CREATE TABLE IF NOT EXISTS community_parties (
  id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  user_id TEXT,
  PRIMARY KEY (workspace_id,id),
  UNIQUE (workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id) REFERENCES properties(workspace_id,id)
);

CREATE TABLE IF NOT EXISTS community_ownerships (
  id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  unit_id TEXT NOT NULL,
  party_id TEXT NOT NULL,
  share NUMERIC NOT NULL,
  income_share NUMERIC NOT NULL,
  expense_share NUMERIC NOT NULL,
  starts_on TEXT NOT NULL,
  ends_on TEXT,
  PRIMARY KEY (workspace_id,id),
  UNIQUE (workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id) REFERENCES properties(workspace_id,id),
  FOREIGN KEY (workspace_id,property_id,unit_id) REFERENCES property_units(workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id,party_id) REFERENCES community_parties(workspace_id,property_id,id),
  CHECK (share>0 AND share<=100),
  CHECK (income_share>=0 AND income_share<=100),
  CHECK (expense_share>=0 AND expense_share<=100),
  CHECK (ends_on IS NULL OR ends_on>starts_on)
);

CREATE TABLE IF NOT EXISTS community_agreements (
  id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  kind TEXT NOT NULL,
  debtor_party_id TEXT NOT NULL,
  creditor_party_id TEXT NOT NULL,
  parent_id TEXT,
  occupancy_id TEXT,
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL,
  rent NUMERIC NOT NULL,
  deposit NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  due_day INTEGER NOT NULL,
  status TEXT NOT NULL,
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
);

CREATE TABLE IF NOT EXISTS community_charges (
  id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  agreement_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  period TEXT NOT NULL,
  due_on TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  PRIMARY KEY (workspace_id,id),
  UNIQUE (workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id) REFERENCES properties(workspace_id,id),
  FOREIGN KEY (workspace_id,property_id,agreement_id) REFERENCES community_agreements(workspace_id,property_id,id),
  UNIQUE (workspace_id,agreement_id,kind,period),
  CHECK (amount>0),
  CHECK (kind IN ('rent','deposit'))
);

CREATE TABLE IF NOT EXISTS community_payments (
  id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  charge_id TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  reference TEXT NOT NULL,
  status TEXT NOT NULL,
  user_id TEXT NOT NULL,
  submission_id TEXT NOT NULL,
  verified_by TEXT,
  PRIMARY KEY (workspace_id,id),
  UNIQUE (workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id) REFERENCES properties(workspace_id,id),
  FOREIGN KEY (workspace_id,property_id,charge_id) REFERENCES community_charges(workspace_id,property_id,id),
  UNIQUE (workspace_id,user_id,submission_id),
  CHECK (amount>0),
  CHECK (status IN ('pending','verified','rejected'))
);

CREATE TABLE IF NOT EXISTS community_expenses (
  id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  scope TEXT NOT NULL,
  unit_id TEXT,
  party_id TEXT,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  incurred_on TEXT NOT NULL,
  paid_status TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY (workspace_id,id),
  UNIQUE (workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id) REFERENCES properties(workspace_id,id),
  FOREIGN KEY (workspace_id,property_id,unit_id) REFERENCES property_units(workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id,party_id) REFERENCES community_parties(workspace_id,property_id,id),
  CHECK (amount>0),
  CHECK (scope IN ('community','unit','operator')),
  CHECK (paid_status IN ('paid','unpaid'))
);

CREATE TABLE IF NOT EXISTS community_sellers (
  id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  pickup TEXT NOT NULL,
  PRIMARY KEY (workspace_id,id),
  UNIQUE (workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id) REFERENCES properties(workspace_id,id)
);

CREATE TABLE IF NOT EXISTS community_products (
  id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  seller_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  kind TEXT NOT NULL,
  ingredients TEXT NOT NULL,
  allergens TEXT NOT NULL,
  price NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  stock INTEGER NOT NULL,
  status TEXT NOT NULL,
  PRIMARY KEY (workspace_id,id),
  UNIQUE (workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id) REFERENCES properties(workspace_id,id),
  FOREIGN KEY (workspace_id,property_id,seller_id) REFERENCES community_sellers(workspace_id,property_id,id),
  CHECK (price>0),
  CHECK (stock>=0)
);

CREATE TABLE IF NOT EXISTS community_groups (
  id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  product_id TEXT NOT NULL,
  seller_id TEXT NOT NULL,
  unit_price NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  minimum INTEGER NOT NULL,
  maximum INTEGER NOT NULL,
  closes_at TEXT NOT NULL,
  pickup TEXT NOT NULL,
  status TEXT NOT NULL,
  PRIMARY KEY (workspace_id,id),
  UNIQUE (workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id) REFERENCES properties(workspace_id,id),
  FOREIGN KEY (workspace_id,property_id,product_id) REFERENCES community_products(workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id,seller_id) REFERENCES community_sellers(workspace_id,property_id,id),
  CHECK (unit_price>0),
  CHECK (minimum>0 AND maximum>=minimum),
  CHECK (status IN ('open','confirmed','failed'))
);

CREATE TABLE IF NOT EXISTS community_orders (
  id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  product_id TEXT NOT NULL,
  seller_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  group_id TEXT,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  submission_id TEXT NOT NULL,
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
);

CREATE TABLE IF NOT EXISTS community_pledges (
  id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  PRIMARY KEY (workspace_id,id),
  UNIQUE (workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id) REFERENCES properties(workspace_id,id),
  FOREIGN KEY (workspace_id,property_id,group_id) REFERENCES community_groups(workspace_id,property_id,id),
  UNIQUE (workspace_id,group_id,user_id),
  CHECK (quantity>=0)
);

CREATE TABLE IF NOT EXISTS community_gate_entries (
  id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  unit_id TEXT NOT NULL,
  occupancy_id TEXT NOT NULL,
  resident_user_id TEXT NOT NULL,
  expected_at TEXT NOT NULL,
  approval TEXT NOT NULL,
  status TEXT NOT NULL,
  arrived_at TEXT,
  departed_at TEXT,
  accepted_at TEXT,
  received_at TEXT,
  user_id TEXT NOT NULL,
  PRIMARY KEY (workspace_id,id),
  UNIQUE (workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id) REFERENCES properties(workspace_id,id),
  FOREIGN KEY (workspace_id,property_id,unit_id) REFERENCES property_units(workspace_id,property_id,id),
  CHECK (approval IN ('pending','approved','denied')),
  CHECK (status IN ('expected','arrived','departed','accepted','received'))
);

CREATE TABLE IF NOT EXISTS community_facilities (
  id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  name TEXT NOT NULL,
  capacity INTEGER NOT NULL,
  slot_minutes INTEGER NOT NULL,
  price NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  rules TEXT NOT NULL,
  status TEXT NOT NULL,
  PRIMARY KEY (workspace_id,id),
  UNIQUE (workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id) REFERENCES properties(workspace_id,id),
  CHECK (capacity>0),
  CHECK (slot_minutes BETWEEN 15 AND 1440),
  CHECK (price>=0)
);

CREATE TABLE IF NOT EXISTS community_bookings (
  id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  facility_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  status TEXT NOT NULL,
  price NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  submission_id TEXT NOT NULL,
  PRIMARY KEY (workspace_id,id),
  UNIQUE (workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id) REFERENCES properties(workspace_id,id),
  FOREIGN KEY (workspace_id,property_id,facility_id) REFERENCES community_facilities(workspace_id,property_id,id),
  UNIQUE (workspace_id,user_id,submission_id),
  CHECK (ends_at>starts_at),
  CHECK (price>=0)
);

CREATE TABLE IF NOT EXISTS community_notes (
  id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  user_id TEXT NOT NULL,
  assigned_user_id TEXT,
  status TEXT NOT NULL,
  PRIMARY KEY (workspace_id,id),
  UNIQUE (workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id) REFERENCES properties(workspace_id,id)
);

CREATE TABLE IF NOT EXISTS community_layouts (
  id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  floor INTEGER NOT NULL,
  name TEXT NOT NULL,
  draft_json TEXT NOT NULL,
  published_json TEXT NOT NULL,
  published_at TEXT,
  PRIMARY KEY (workspace_id,id),
  UNIQUE (workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id) REFERENCES properties(workspace_id,id),
  UNIQUE (workspace_id,property_id,floor),
  CHECK (floor BETWEEN -5 AND 150)
);

CREATE TABLE IF NOT EXISTS community_audit (
  id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  user_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  PRIMARY KEY (workspace_id,id),
  UNIQUE (workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id) REFERENCES properties(workspace_id,id)
);

CREATE TABLE IF NOT EXISTS community_receipts (
  id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  expense_id TEXT NOT NULL,
  path TEXT NOT NULL,
  name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  status TEXT NOT NULL,
  PRIMARY KEY (workspace_id,id),
  UNIQUE (workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id) REFERENCES properties(workspace_id,id),
  FOREIGN KEY (workspace_id,property_id,expense_id) REFERENCES community_expenses(workspace_id,property_id,id),
  CHECK (size>0 AND size<=20971520)
);

CREATE TABLE IF NOT EXISTS community_agreement_units (
  workspace_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  agreement_id TEXT NOT NULL,
  unit_id TEXT NOT NULL,
  PRIMARY KEY (workspace_id,agreement_id,unit_id),
  FOREIGN KEY (workspace_id,property_id,agreement_id) REFERENCES community_agreements(workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id,unit_id) REFERENCES property_units(workspace_id,property_id,id)
);

CREATE TABLE IF NOT EXISTS community_expense_allocations (
  workspace_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  expense_id TEXT NOT NULL,
  party_id TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  PRIMARY KEY (workspace_id,expense_id,party_id),
  FOREIGN KEY (workspace_id,property_id,expense_id) REFERENCES community_expenses(workspace_id,property_id,id),
  FOREIGN KEY (workspace_id,property_id,party_id) REFERENCES community_parties(workspace_id,property_id,id)
);
