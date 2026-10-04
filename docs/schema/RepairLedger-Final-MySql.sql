-- RepairLedger final MySQL 8.4 LTS / InnoDB schema: version 5.
-- Reference/bootstrap for an EMPTY database/schema only. Never run against an existing installation.
-- MySQL DDL is not transactionally reversible; back up before schema changes.
-- Existing installations MUST use the embedded numbered migrations through 005.
-- No customer data, credentials, seed records, drops or destructive resets are included.
CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at VARCHAR(40) NOT NULL, completed INTEGER NOT NULL DEFAULT 1 CHECK(completed IN (0,1)), checksum CHAR(64)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE workspaces (
 id VARCHAR(200) PRIMARY KEY, name VARCHAR(160) NOT NULL, default_currency CHAR(3) NOT NULL DEFAULT 'USD'
 CHECK(CHAR_LENGTH(default_currency)=3 AND default_currency=UPPER(default_currency)), created_at VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE properties (
 workspace_id VARCHAR(200) NOT NULL, id VARCHAR(200) NOT NULL, name VARCHAR(160) NOT NULL, address TEXT NOT NULL,
 units INTEGER NOT NULL CHECK(units > 0), timezone VARCHAR(100) NOT NULL, assets INTEGER NOT NULL DEFAULT 0,
 image_url TEXT, archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)), PRIMARY KEY(workspace_id,id),
 CONSTRAINT fk_properties_workspace FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE vendors (
 workspace_id VARCHAR(200) NOT NULL, id VARCHAR(200) NOT NULL, name VARCHAR(160) NOT NULL, email VARCHAR(254), phone VARCHAR(60), trade VARCHAR(100) NOT NULL,
 distance VARCHAR(255) NOT NULL, availability VARCHAR(255) NOT NULL, first_visit_fixes VARCHAR(255) NOT NULL,
 status VARCHAR(32) NOT NULL CHECK(status IN ('preferred','approved','review')), PRIMARY KEY(workspace_id,id),
 CONSTRAINT fk_vendors_workspace FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE property_units (
 workspace_id VARCHAR(200) NOT NULL, id VARCHAR(300) NOT NULL, property_id VARCHAR(200) NOT NULL, label VARCHAR(40) NOT NULL CHECK(CHAR_LENGTH(trim(label)) BETWEEN 1 AND 40),
 archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)), created_at VARCHAR(40) NOT NULL,
 PRIMARY KEY(workspace_id,id), UNIQUE(workspace_id,property_id,label), UNIQUE(workspace_id,id,property_id),
 FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
 FOREIGN KEY(workspace_id,property_id) REFERENCES properties(workspace_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE requests (
 workspace_id VARCHAR(200) NOT NULL, id VARCHAR(200) NOT NULL, revision BIGINT NOT NULL DEFAULT 0,
 title VARCHAR(200) NOT NULL, property VARCHAR(160) NOT NULL, property_id VARCHAR(200) NOT NULL, unit VARCHAR(40) NOT NULL,
 resident VARCHAR(160) NOT NULL, category VARCHAR(100) NOT NULL, priority VARCHAR(32) NOT NULL CHECK(priority IN ('routine','urgent')),
 resident_user_id VARCHAR(200),resident_occupancy_id VARCHAR(36),
 state VARCHAR(32) NOT NULL CHECK(state IN ('draft','submitted','urgent','acknowledged','assigned','waiting','scheduled','approved','in_progress','completed','verification','invoice_review','closed','cancelled')),
 next_action VARCHAR(255) NOT NULL, due_label VARCHAR(255) NOT NULL, description TEXT NOT NULL, access TEXT NOT NULL,
 language VARCHAR(100) NOT NULL, timezone VARCHAR(100) NOT NULL, created_at VARCHAR(40) NOT NULL, photo_url TEXT, access_notes TEXT,
 preferred_window TEXT, safety_json JSON NOT NULL DEFAULT (JSON_OBJECT()), assigned_vendor_id VARCHAR(200),
 assigned_vendor_name VARCHAR(160), vendor_decision VARCHAR(32) CHECK(vendor_decision IN ('pending','accepted','declined')),
 verification_json JSON, PRIMARY KEY(workspace_id,id),
 CONSTRAINT ck_requests_resident_binding CHECK((resident_user_id IS NULL AND resident_occupancy_id IS NULL) OR (resident_user_id IS NOT NULL AND resident_occupancy_id IS NOT NULL)),
 FOREIGN KEY(workspace_id,property_id) REFERENCES properties(workspace_id,id),
 FOREIGN KEY(workspace_id,assigned_vendor_id) REFERENCES vendors(workspace_id,id),
 UNIQUE KEY ux_request_property_reference(workspace_id,id,property_id),
 KEY ix_requests_queue(workspace_id,state,created_at),
 KEY ix_requests_unit(workspace_id,property_id,unit),
 KEY ix_requests_vendor(workspace_id,assigned_vendor_id,state),
 KEY ix_requests_resident_access(workspace_id,resident_user_id,resident_occupancy_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE request_locations (
 workspace_id VARCHAR(200) NOT NULL, request_id VARCHAR(200) NOT NULL, property_id VARCHAR(200) NOT NULL, unit_id VARCHAR(300) NOT NULL,
 PRIMARY KEY(workspace_id,request_id),
 FOREIGN KEY(workspace_id,request_id,property_id) REFERENCES requests(workspace_id,id,property_id),
 FOREIGN KEY(workspace_id,unit_id,property_id) REFERENCES property_units(workspace_id,id,property_id),
 KEY ix_request_locations_unit(workspace_id,unit_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE events (
 workspace_id VARCHAR(200) NOT NULL, request_id VARCHAR(200) NOT NULL, id VARCHAR(200) NOT NULL, type VARCHAR(100) NOT NULL,
 label VARCHAR(255) NOT NULL, detail TEXT NOT NULL, at VARCHAR(40) NOT NULL, actor VARCHAR(254), PRIMARY KEY(workspace_id,id),
 FOREIGN KEY(workspace_id,request_id) REFERENCES requests(workspace_id,id),
 KEY ix_events_request(workspace_id,request_id,at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE vendor_offers (
 workspace_id VARCHAR(200) NOT NULL, id VARCHAR(256) NOT NULL, request_id VARCHAR(200) NOT NULL, vendor_id VARCHAR(200) NOT NULL,
 `sequence` INTEGER NOT NULL CHECK(`sequence`>0), status VARCHAR(32) NOT NULL CHECK(status IN ('pending','accepted','declined','superseded','cancelled')),
 offered_at VARCHAR(40), responded_at VARCHAR(40), offered_by VARCHAR(200), response_by VARCHAR(200), note TEXT, response_note TEXT,
 legacy_snapshot INTEGER NOT NULL DEFAULT 0 CHECK(legacy_snapshot IN (0,1)),
 PRIMARY KEY(workspace_id,id), UNIQUE(workspace_id,request_id,`sequence`),
 FOREIGN KEY(workspace_id,request_id) REFERENCES requests(workspace_id,id),
 FOREIGN KEY(workspace_id,vendor_id) REFERENCES vendors(workspace_id,id),
 active_offer_guard TINYINT GENERATED ALWAYS AS (CASE WHEN status IN ('pending','accepted') THEN 1 ELSE NULL END) STORED,
 UNIQUE KEY ux_vendor_offers_active(workspace_id,request_id,active_offer_guard),
 KEY ix_vendor_offers_vendor(workspace_id,vendor_id,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE estimates (
 workspace_id VARCHAR(200) NOT NULL, request_id VARCHAR(200) NOT NULL, id VARCHAR(200) NOT NULL, version INTEGER NOT NULL CHECK(version > 0),
 vendor_id VARCHAR(200), currency CHAR(3) NOT NULL DEFAULT 'USD' CHECK(CHAR_LENGTH(currency)=3 AND currency=UPPER(currency)),
 scope TEXT NOT NULL, labor DECIMAL(14,2) NOT NULL CHECK(labor >= 0), parts DECIMAL(14,2) NOT NULL CHECK(parts >= 0),
 tax DECIMAL(14,2) NOT NULL CHECK(tax >= 0), total DECIMAL(14,2) NOT NULL,
 CONSTRAINT ck_estimates_total CHECK(ROUND(total,2) = ROUND(labor + parts + tax,2)),
 status VARCHAR(32) NOT NULL CHECK(status IN ('submitted','approved','changes_requested')), created_at VARCHAR(40) NOT NULL,
 approved_at VARCHAR(40), approved_by VARCHAR(200), PRIMARY KEY(workspace_id,id), UNIQUE(workspace_id,request_id,version),
 FOREIGN KEY(workspace_id,request_id) REFERENCES requests(workspace_id,id),
 CONSTRAINT fk_estimates_vendor FOREIGN KEY(workspace_id,vendor_id) REFERENCES vendors(workspace_id,id),
 KEY ix_estimates_request(workspace_id,request_id,version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE appointments (
 workspace_id VARCHAR(200) NOT NULL, request_id VARCHAR(200) NOT NULL, id VARCHAR(200) NOT NULL, starts_at VARCHAR(40) NOT NULL,
 ends_at VARCHAR(40) NOT NULL, timezone VARCHAR(100) NOT NULL, status VARCHAR(32) NOT NULL CHECK(status IN ('proposed','confirmed','cancelled')),
 resident_confirmed_at VARCHAR(40), vendor_confirmed_at VARCHAR(40), created_at VARCHAR(40) NOT NULL, PRIMARY KEY(workspace_id,id),
 FOREIGN KEY(workspace_id,request_id) REFERENCES requests(workspace_id,id),
 KEY ix_appointments_request(workspace_id,request_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE evidence (
 workspace_id VARCHAR(200) NOT NULL, request_id VARCHAR(200) NOT NULL, id VARCHAR(200) NOT NULL, path TEXT NOT NULL, name VARCHAR(160) NOT NULL,
 content_type VARCHAR(100) NOT NULL, size BIGINT NOT NULL CHECK(size > 0 AND size <= 20971520), uploaded_by VARCHAR(200) NOT NULL,
 created_at VARCHAR(40) NOT NULL, status VARCHAR(32) NOT NULL CHECK(status IN ('uploading','uploaded')), PRIMARY KEY(workspace_id,id),
 path_hash BINARY(32) GENERATED ALWAYS AS (UNHEX(SHA2(path,256))) STORED,
 UNIQUE(path_hash), FOREIGN KEY(workspace_id,request_id) REFERENCES requests(workspace_id,id),
 KEY ix_evidence_request(workspace_id,request_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE messages (
 workspace_id VARCHAR(200) NOT NULL, request_id VARCHAR(200) NOT NULL, id VARCHAR(200) NOT NULL, sender VARCHAR(254) NOT NULL,
 role VARCHAR(32) NOT NULL CHECK(role IN ('resident','manager','vendor','system')), body TEXT NOT NULL,
 at VARCHAR(40) NOT NULL, status VARCHAR(32) NOT NULL, PRIMARY KEY(workspace_id,id),
 FOREIGN KEY(workspace_id,request_id) REFERENCES requests(workspace_id,id),
 KEY ix_messages_request(workspace_id,request_id,at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE notifications (
 workspace_id VARCHAR(200) NOT NULL, id VARCHAR(200) NOT NULL, title VARCHAR(200) NOT NULL, detail TEXT NOT NULL, type VARCHAR(100) NOT NULL,
 request_id VARCHAR(200), `read` INTEGER NOT NULL DEFAULT 0 CHECK(`read` IN (0,1)), href TEXT, at VARCHAR(40) NOT NULL, PRIMARY KEY(workspace_id,id),
 CONSTRAINT fk_notifications_workspace FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
 CONSTRAINT fk_notifications_request FOREIGN KEY(workspace_id,request_id) REFERENCES requests(workspace_id,id),
 KEY ix_notifications_inbox(workspace_id,`read`,at),
 KEY ix_notifications_request(workspace_id,request_id,at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE request_verifications (
 workspace_id VARCHAR(200) NOT NULL, id VARCHAR(256) NOT NULL, request_id VARCHAR(200) NOT NULL, revision BIGINT NOT NULL CHECK(revision>=0),
 status VARCHAR(32) NOT NULL CHECK(status IN ('pending','verified','unresolved')), note TEXT, actor_id VARCHAR(200), recorded_at VARCHAR(40) NOT NULL,
 legacy_snapshot INTEGER NOT NULL DEFAULT 0 CHECK(legacy_snapshot IN (0,1)),
 PRIMARY KEY(workspace_id,id), UNIQUE(workspace_id,request_id,revision),
 FOREIGN KEY(workspace_id,request_id) REFERENCES requests(workspace_id,id),
 KEY ix_request_verifications_request(workspace_id,request_id,revision)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE notification_reads (
 workspace_id VARCHAR(200) NOT NULL, notification_id VARCHAR(200) NOT NULL, user_id VARCHAR(200) NOT NULL, read_at VARCHAR(40) NOT NULL,
 PRIMARY KEY(workspace_id,notification_id,user_id),
 FOREIGN KEY(workspace_id,notification_id) REFERENCES notifications(workspace_id,id),
 KEY ix_notification_reads_user(workspace_id,user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

-- Additive mobile operations. Gate presence never changes repair approval, access consent or completion.
CREATE TABLE IF NOT EXISTS gate_presence (
 workspace_id VARCHAR(200) NOT NULL, appointment_id VARCHAR(200) NOT NULL,
 arrived_at VARCHAR(40) NOT NULL, arrived_by VARCHAR(200) NOT NULL,
 departed_at VARCHAR(40), departed_by VARCHAR(200), revision BIGINT NOT NULL CHECK(revision>0),
 PRIMARY KEY(workspace_id,appointment_id),
 FOREIGN KEY(workspace_id,appointment_id) REFERENCES appointments(workspace_id,id),
 CONSTRAINT ck_gate_departure CHECK((departed_at IS NULL AND departed_by IS NULL) OR (departed_at IS NOT NULL AND departed_by IS NOT NULL AND departed_at>=arrived_at)),
 KEY ix_gate_open(workspace_id,departed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;
CREATE TABLE IF NOT EXISTS common_area_issues (
 workspace_id VARCHAR(200) NOT NULL,id VARCHAR(200) NOT NULL,property_id VARCHAR(200) NOT NULL,
 location VARCHAR(160) NOT NULL,title VARCHAR(200) NOT NULL,category VARCHAR(100) NOT NULL,description TEXT NOT NULL,
 priority VARCHAR(32) NOT NULL CHECK(priority IN ('routine','urgent')),
 status VARCHAR(32) NOT NULL CHECK(status IN ('reported','in_progress','resolved')),
 reported_by VARCHAR(200) NOT NULL,submission_id VARCHAR(36) NOT NULL,
 resolution_note TEXT,updated_by VARCHAR(200),created_at VARCHAR(40) NOT NULL,updated_at VARCHAR(40) NOT NULL,
 revision BIGINT NOT NULL DEFAULT 0 CHECK(revision>=0),PRIMARY KEY(workspace_id,id),
 UNIQUE(workspace_id,reported_by,submission_id),FOREIGN KEY(workspace_id,property_id) REFERENCES properties(workspace_id,id),
 KEY ix_common_area_queue(workspace_id,property_id,status,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;
CREATE TABLE IF NOT EXISTS common_area_issue_events (
 workspace_id VARCHAR(200) NOT NULL,id VARCHAR(200) NOT NULL,issue_id VARCHAR(200) NOT NULL,status VARCHAR(32) NOT NULL,
 note TEXT NOT NULL,actor_id VARCHAR(200) NOT NULL,at VARCHAR(40) NOT NULL,PRIMARY KEY(workspace_id,id),
 FOREIGN KEY(workspace_id,issue_id) REFERENCES common_area_issues(workspace_id,id),
 KEY ix_common_area_history(workspace_id,issue_id,at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

-- BEGIN COMMUNITY V6
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

-- END COMMUNITY V6

-- BEGIN USER CONTEXT V7
CREATE TABLE IF NOT EXISTS users (
    workspace_id VARCHAR(200) NOT NULL,
    user_id VARCHAR(200) NOT NULL,
    user_context TINYINT NOT NULL DEFAULT 1,
    revision BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (workspace_id,user_id),
    CONSTRAINT users_context_valid CHECK (user_context IN (1,2))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

-- END USER CONTEXT V7

-- BEGIN MANAGEMENT V8
ALTER TABLE users DROP CHECK users_context_valid;
ALTER TABLE users ADD CONSTRAINT users_context_allowed CHECK (user_context IN (1,2,3));
ALTER TABLE users ADD COLUMN display_name VARCHAR(200) NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN email VARCHAR(254) NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN identity_role VARCHAR(20) NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN managed_role VARCHAR(20) NULL;
ALTER TABLE users ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN allow_user TINYINT NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN allow_admin TINYINT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN allow_seller TINYINT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN created_at VARCHAR(40) NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS user_memberships (workspace_id VARCHAR(200) NOT NULL,user_id VARCHAR(200) NOT NULL,property_id VARCHAR(200) NOT NULL,unit_id VARCHAR(300) NULL,occupancy_id VARCHAR(100) NULL,starts_at VARCHAR(40) NULL,ends_at VARCHAR(40) NULL,PRIMARY KEY(workspace_id,user_id,property_id),FOREIGN KEY(workspace_id,user_id) REFERENCES users(workspace_id,user_id),FOREIGN KEY(workspace_id,property_id) REFERENCES properties(workspace_id,id),FOREIGN KEY(workspace_id,property_id,unit_id) REFERENCES property_units(workspace_id,property_id,id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;
CREATE TABLE IF NOT EXISTS user_admin_audit (workspace_id VARCHAR(200) NOT NULL,id VARCHAR(100) NOT NULL,user_id VARCHAR(200) NOT NULL,actor_id VARCHAR(200) NOT NULL,action VARCHAR(40) NOT NULL,created_at VARCHAR(40) NOT NULL,PRIMARY KEY(workspace_id,id),FOREIGN KEY(workspace_id,user_id) REFERENCES users(workspace_id,user_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;
CREATE TABLE IF NOT EXISTS community_services (workspace_id VARCHAR(200) NOT NULL,property_id VARCHAR(200) NOT NULL,id VARCHAR(100) NOT NULL,revision BIGINT NOT NULL,created_at VARCHAR(40) NOT NULL,seller_id VARCHAR(100) NOT NULL,name VARCHAR(200) NOT NULL,category VARCHAR(100) NOT NULL,description LONGTEXT NOT NULL,price DECIMAL(14,2) NOT NULL,currency VARCHAR(3) NOT NULL,price_unit VARCHAR(20) NOT NULL,status VARCHAR(20) NOT NULL,PRIMARY KEY(workspace_id,id),UNIQUE(workspace_id,property_id,id),FOREIGN KEY(workspace_id,property_id) REFERENCES properties(workspace_id,id),FOREIGN KEY(workspace_id,property_id,seller_id) REFERENCES community_sellers(workspace_id,property_id,id),CHECK(price>0),CHECK(price_unit IN ('visit','hour','fixed')),CHECK(status IN ('active','paused'))) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;
CREATE TABLE IF NOT EXISTS community_service_requests (workspace_id VARCHAR(200) NOT NULL,property_id VARCHAR(200) NOT NULL,id VARCHAR(100) NOT NULL,revision BIGINT NOT NULL,created_at VARCHAR(40) NOT NULL,service_id VARCHAR(100) NOT NULL,seller_id VARCHAR(100) NOT NULL,user_id VARCHAR(200) NOT NULL,service_name VARCHAR(200) NOT NULL,description LONGTEXT NOT NULL,preferred_at VARCHAR(40) NOT NULL,price DECIMAL(14,2) NOT NULL,currency VARCHAR(3) NOT NULL,price_unit VARCHAR(20) NOT NULL,status VARCHAR(20) NOT NULL,submission_id VARCHAR(100) NOT NULL,PRIMARY KEY(workspace_id,id),UNIQUE(workspace_id,property_id,id),FOREIGN KEY(workspace_id,property_id) REFERENCES properties(workspace_id,id),FOREIGN KEY(workspace_id,property_id,service_id) REFERENCES community_services(workspace_id,property_id,id),FOREIGN KEY(workspace_id,property_id,seller_id) REFERENCES community_sellers(workspace_id,property_id,id),CHECK(price>0),CHECK(price_unit IN ('visit','hour','fixed')),CHECK(status IN ('requested','accepted','completed','declined','cancelled')),UNIQUE(workspace_id,user_id,submission_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

-- END MANAGEMENT V8

-- BEGIN STRUCTURE V9
-- Existing properties remain communities. Existing flats and floor plans remain unassigned to a block until an admin organizes them.
CREATE TABLE IF NOT EXISTS community_blocks (
 id VARCHAR(100) NOT NULL, workspace_id VARCHAR(200) NOT NULL, property_id VARCHAR(200) NOT NULL,
 revision BIGINT NOT NULL, created_at VARCHAR(40) NOT NULL, name VARCHAR(200) NOT NULL,
 PRIMARY KEY(workspace_id,id), UNIQUE(workspace_id,property_id,id), UNIQUE(workspace_id,property_id,name),
 FOREIGN KEY(workspace_id,property_id) REFERENCES properties(workspace_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;
CREATE TABLE IF NOT EXISTS community_unit_locations (
 workspace_id VARCHAR(200) NOT NULL, property_id VARCHAR(200) NOT NULL, unit_id VARCHAR(300) NOT NULL, block_id VARCHAR(100) NOT NULL, floor INTEGER NOT NULL,
 PRIMARY KEY(workspace_id,unit_id),
 FOREIGN KEY(workspace_id,property_id,unit_id) REFERENCES property_units(workspace_id,property_id,id),
 FOREIGN KEY(workspace_id,property_id,block_id) REFERENCES community_blocks(workspace_id,property_id,id),
 CHECK(floor BETWEEN -5 AND 150)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;
CREATE TABLE IF NOT EXISTS community_block_layouts (
 id VARCHAR(100) NOT NULL, workspace_id VARCHAR(200) NOT NULL, property_id VARCHAR(200) NOT NULL,
 revision BIGINT NOT NULL, created_at VARCHAR(40) NOT NULL, block_id VARCHAR(100) NOT NULL, floor INTEGER NOT NULL,
 name VARCHAR(200) NOT NULL, draft_json TEXT NOT NULL, published_json TEXT NOT NULL, published_at VARCHAR(40),
 PRIMARY KEY(workspace_id,id), UNIQUE(workspace_id,property_id,id), UNIQUE(workspace_id,property_id,block_id,floor),
 FOREIGN KEY(workspace_id,property_id,block_id) REFERENCES community_blocks(workspace_id,property_id,id),
 CHECK(floor BETWEEN -5 AND 150)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;
CREATE TABLE IF NOT EXISTS community_deliveries (
 id VARCHAR(100) NOT NULL, workspace_id VARCHAR(200) NOT NULL, property_id VARCHAR(200) NOT NULL,
 revision BIGINT NOT NULL, created_at VARCHAR(40) NOT NULL, user_id VARCHAR(200) NOT NULL,
 seller_id VARCHAR(100), unit_id VARCHAR(300), name VARCHAR(200) NOT NULL, reference VARCHAR(200) NOT NULL, notes TEXT NOT NULL,
 packages INTEGER NOT NULL, bulk INTEGER NOT NULL, expected_at VARCHAR(40) NOT NULL,
 approval TEXT NOT NULL, status TEXT NOT NULL, accepted_at VARCHAR(40), received_at VARCHAR(40),
 PRIMARY KEY(workspace_id,id), UNIQUE(workspace_id,property_id,id),
 FOREIGN KEY(workspace_id,property_id) REFERENCES properties(workspace_id,id),
 FOREIGN KEY(workspace_id,property_id,seller_id) REFERENCES community_sellers(workspace_id,property_id,id),
 FOREIGN KEY(workspace_id,property_id,unit_id) REFERENCES property_units(workspace_id,property_id,id),
 CHECK(packages BETWEEN 1 AND 10000), CHECK(bulk IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

-- END STRUCTURE V9

-- Mark the baseline compatible with the application's nine versioned migrations.
INSERT INTO schema_migrations(version,applied_at,completed,checksum) VALUES
 (1,DATE_FORMAT(UTC_TIMESTAMP(6),'%Y-%m-%dT%H:%i:%s.%f+00:00'),1,'B7500B2330F6FA15F9A94594F842432D58A4273445D56191FEF3F2B33BE3FFAD'),
 (2,DATE_FORMAT(UTC_TIMESTAMP(6),'%Y-%m-%dT%H:%i:%s.%f+00:00'),1,'DCFC6886F8C9586B511D122B2018A3959FBD882025E2C0EC737857F169A96CA0'),
 (3,DATE_FORMAT(UTC_TIMESTAMP(6),'%Y-%m-%dT%H:%i:%s.%f+00:00'),1,'6CE00719E7DC7C99A80DCF272FE54632E34F915E6B62225A4DFC52488D86D80E'),
 (4,DATE_FORMAT(UTC_TIMESTAMP(6),'%Y-%m-%dT%H:%i:%s.%f+00:00'),1,'A21F5F1DCC9608B1A442C5EACD3D6741F899EC93AB1FF2043BFE40B486E377E5'),
 (5,DATE_FORMAT(UTC_TIMESTAMP(6),'%Y-%m-%dT%H:%i:%s.%f+00:00'),1,'E793B24EF86ED751CA6D24431795733B6927BB967FE30A03AED5FF12511E5C11'),
 (6,DATE_FORMAT(UTC_TIMESTAMP(6),'%Y-%m-%dT%H:%i:%s.%f+00:00'),1,'0BFBA9F0CF1C34A8C5FD21653C2641C9633F5CBC899523AA9F88D691D5279F52'),
 (7,DATE_FORMAT(UTC_TIMESTAMP(6),'%Y-%m-%dT%H:%i:%s.%f+00:00'),1,'69A5CE400F33BC18366A0E9157CDBCEAA7C250E78D50E9401123BB7EC3A050BB'),
 (8,DATE_FORMAT(UTC_TIMESTAMP(6),'%Y-%m-%dT%H:%i:%s.%f+00:00'),1,'DA15C1C4516D96409D82210DF94984E0424368B5E9075FDFFCD21D8527936180'),
 (9,DATE_FORMAT(UTC_TIMESTAMP(6),'%Y-%m-%dT%H:%i:%s.%f+00:00'),1,'75CFFF235ED8DF1B553EA12D841EE8C6F868C0068521EA169995240CEF6B355F');

