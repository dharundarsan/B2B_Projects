-- RepairLedger final SQLite reference schema: version 5.
-- Reference/bootstrap for an EMPTY database/schema only. Never run against an existing installation.
-- Existing installations MUST use the embedded numbered migrations through 005.
-- No customer data, credentials, seed records, drops or destructive resets are included.
BEGIN;

CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);

CREATE TABLE workspaces (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, default_currency TEXT NOT NULL DEFAULT 'USD'
 CHECK(length(default_currency)=3 AND default_currency=UPPER(default_currency)), created_at TEXT NOT NULL
);

CREATE TABLE properties (
 workspace_id TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL, address TEXT NOT NULL,
 units INTEGER NOT NULL CHECK(units > 0), timezone TEXT NOT NULL, assets INTEGER NOT NULL DEFAULT 0,
 image_url TEXT, archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)), PRIMARY KEY(workspace_id,id),
 CONSTRAINT fk_properties_workspace FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
);

CREATE TABLE vendors (
 workspace_id TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL, email TEXT, phone TEXT, trade TEXT NOT NULL,
 distance TEXT NOT NULL, availability TEXT NOT NULL, first_visit_fixes TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('preferred','approved','review')), PRIMARY KEY(workspace_id,id),
 CONSTRAINT fk_vendors_workspace FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
);

CREATE TABLE property_units (
 workspace_id TEXT NOT NULL, id TEXT NOT NULL, property_id TEXT NOT NULL, label TEXT NOT NULL CHECK(length(trim(label)) BETWEEN 1 AND 40),
 archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)), created_at TEXT NOT NULL,
 PRIMARY KEY(workspace_id,id), UNIQUE(workspace_id,property_id,label), UNIQUE(workspace_id,id,property_id),
 FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
 FOREIGN KEY(workspace_id,property_id) REFERENCES properties(workspace_id,id)
);

CREATE TABLE requests (
 workspace_id TEXT NOT NULL, id TEXT NOT NULL, revision BIGINT NOT NULL DEFAULT 0,
 title TEXT NOT NULL, property TEXT NOT NULL, property_id TEXT NOT NULL, unit TEXT NOT NULL,
 resident TEXT NOT NULL, category TEXT NOT NULL, priority TEXT NOT NULL CHECK(priority IN ('routine','urgent')),
 resident_user_id TEXT,resident_occupancy_id TEXT,
 state TEXT NOT NULL CHECK(state IN ('draft','submitted','urgent','acknowledged','assigned','waiting','scheduled','approved','in_progress','completed','verification','invoice_review','closed','cancelled')),
 next_action TEXT NOT NULL, due_label TEXT NOT NULL, description TEXT NOT NULL, access TEXT NOT NULL,
 language TEXT NOT NULL, timezone TEXT NOT NULL, created_at TEXT NOT NULL, photo_url TEXT, access_notes TEXT,
 preferred_window TEXT, safety_json TEXT NOT NULL DEFAULT '{}', assigned_vendor_id TEXT,
 assigned_vendor_name TEXT, vendor_decision TEXT CHECK(vendor_decision IN ('pending','accepted','declined')),
 verification_json TEXT, PRIMARY KEY(workspace_id,id),
 CONSTRAINT ck_requests_resident_binding CHECK((resident_user_id IS NULL AND resident_occupancy_id IS NULL) OR (resident_user_id IS NOT NULL AND resident_occupancy_id IS NOT NULL)),
 FOREIGN KEY(workspace_id,property_id) REFERENCES properties(workspace_id,id),
 FOREIGN KEY(workspace_id,assigned_vendor_id) REFERENCES vendors(workspace_id,id)
);

CREATE UNIQUE INDEX ux_request_property_reference ON requests(workspace_id,id,property_id);
CREATE INDEX ix_requests_resident_access ON requests(workspace_id,resident_user_id,resident_occupancy_id);

CREATE TABLE request_locations (
 workspace_id TEXT NOT NULL, request_id TEXT NOT NULL, property_id TEXT NOT NULL, unit_id TEXT NOT NULL,
 PRIMARY KEY(workspace_id,request_id),
 FOREIGN KEY(workspace_id,request_id,property_id) REFERENCES requests(workspace_id,id,property_id),
 FOREIGN KEY(workspace_id,unit_id,property_id) REFERENCES property_units(workspace_id,id,property_id)
);

CREATE TABLE events (
 workspace_id TEXT NOT NULL, request_id TEXT NOT NULL, id TEXT NOT NULL, type TEXT NOT NULL,
 label TEXT NOT NULL, detail TEXT NOT NULL, at TEXT NOT NULL, actor TEXT, PRIMARY KEY(workspace_id,id),
 FOREIGN KEY(workspace_id,request_id) REFERENCES requests(workspace_id,id)
);

CREATE TABLE vendor_offers (
 workspace_id TEXT NOT NULL, id TEXT NOT NULL, request_id TEXT NOT NULL, vendor_id TEXT NOT NULL,
 sequence INTEGER NOT NULL CHECK(sequence>0), status TEXT NOT NULL CHECK(status IN ('pending','accepted','declined','superseded','cancelled')),
 offered_at TEXT, responded_at TEXT, offered_by TEXT, response_by TEXT, note TEXT, response_note TEXT,
 legacy_snapshot INTEGER NOT NULL DEFAULT 0 CHECK(legacy_snapshot IN (0,1)),
 PRIMARY KEY(workspace_id,id), UNIQUE(workspace_id,request_id,sequence),
 FOREIGN KEY(workspace_id,request_id) REFERENCES requests(workspace_id,id),
 FOREIGN KEY(workspace_id,vendor_id) REFERENCES vendors(workspace_id,id)
);

CREATE TABLE estimates (
 workspace_id TEXT NOT NULL, request_id TEXT NOT NULL, id TEXT NOT NULL, version INTEGER NOT NULL CHECK(version > 0),
 vendor_id TEXT, currency TEXT NOT NULL DEFAULT 'USD' CHECK(length(currency)=3 AND currency=UPPER(currency)),
 scope TEXT NOT NULL, labor NUMERIC(14,2) NOT NULL CHECK(labor >= 0), parts NUMERIC(14,2) NOT NULL CHECK(parts >= 0),
 tax NUMERIC(14,2) NOT NULL CHECK(tax >= 0), total NUMERIC(14,2) NOT NULL CHECK(ROUND(total,2) = ROUND(labor + parts + tax,2)),
 status TEXT NOT NULL CHECK(status IN ('submitted','approved','changes_requested')), created_at TEXT NOT NULL,
 approved_at TEXT, approved_by TEXT, PRIMARY KEY(workspace_id,id), UNIQUE(workspace_id,request_id,version),
 FOREIGN KEY(workspace_id,request_id) REFERENCES requests(workspace_id,id),
 CONSTRAINT fk_estimates_vendor FOREIGN KEY(workspace_id,vendor_id) REFERENCES vendors(workspace_id,id)
);

CREATE TABLE appointments (
 workspace_id TEXT NOT NULL, request_id TEXT NOT NULL, id TEXT NOT NULL, starts_at TEXT NOT NULL,
 ends_at TEXT NOT NULL, timezone TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('proposed','confirmed','cancelled')),
 resident_confirmed_at TEXT, vendor_confirmed_at TEXT, created_at TEXT NOT NULL, PRIMARY KEY(workspace_id,id),
 FOREIGN KEY(workspace_id,request_id) REFERENCES requests(workspace_id,id)
);

CREATE TABLE evidence (
 workspace_id TEXT NOT NULL, request_id TEXT NOT NULL, id TEXT NOT NULL, path TEXT NOT NULL, name TEXT NOT NULL,
 content_type TEXT NOT NULL, size BIGINT NOT NULL CHECK(size > 0 AND size <= 20971520), uploaded_by TEXT NOT NULL,
 created_at TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('uploading','uploaded')), PRIMARY KEY(workspace_id,id),
 UNIQUE(path), FOREIGN KEY(workspace_id,request_id) REFERENCES requests(workspace_id,id)
);

CREATE TABLE messages (
 workspace_id TEXT NOT NULL, request_id TEXT NOT NULL, id TEXT NOT NULL, sender TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('resident','manager','vendor','system')), body TEXT NOT NULL,
 at TEXT NOT NULL, status TEXT NOT NULL, PRIMARY KEY(workspace_id,id),
 FOREIGN KEY(workspace_id,request_id) REFERENCES requests(workspace_id,id)
);

CREATE TABLE notifications (
 workspace_id TEXT NOT NULL, id TEXT NOT NULL, title TEXT NOT NULL, detail TEXT NOT NULL, type TEXT NOT NULL,
 request_id TEXT, read INTEGER NOT NULL DEFAULT 0 CHECK(read IN (0,1)), href TEXT, at TEXT NOT NULL, PRIMARY KEY(workspace_id,id),
 CONSTRAINT fk_notifications_workspace FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
 CONSTRAINT fk_notifications_request FOREIGN KEY(workspace_id,request_id) REFERENCES requests(workspace_id,id)
);

CREATE TABLE request_verifications (
 workspace_id TEXT NOT NULL, id TEXT NOT NULL, request_id TEXT NOT NULL, revision BIGINT NOT NULL CHECK(revision>=0),
 status TEXT NOT NULL CHECK(status IN ('pending','verified','unresolved')), note TEXT, actor_id TEXT, recorded_at TEXT NOT NULL,
 legacy_snapshot INTEGER NOT NULL DEFAULT 0 CHECK(legacy_snapshot IN (0,1)),
 PRIMARY KEY(workspace_id,id), UNIQUE(workspace_id,request_id,revision),
 FOREIGN KEY(workspace_id,request_id) REFERENCES requests(workspace_id,id)
);

CREATE TABLE notification_reads (
 workspace_id TEXT NOT NULL, notification_id TEXT NOT NULL, user_id TEXT NOT NULL, read_at TEXT NOT NULL,
 PRIMARY KEY(workspace_id,notification_id,user_id),
 FOREIGN KEY(workspace_id,notification_id) REFERENCES notifications(workspace_id,id)
);

CREATE INDEX ix_requests_queue ON requests(workspace_id,state,created_at);
CREATE INDEX ix_requests_unit ON requests(workspace_id,property_id,unit);
CREATE INDEX ix_requests_vendor ON requests(workspace_id,assigned_vendor_id,state);
CREATE INDEX ix_events_request ON events(workspace_id,request_id,at);
CREATE INDEX ix_estimates_request ON estimates(workspace_id,request_id,version);
CREATE INDEX ix_appointments_request ON appointments(workspace_id,request_id,created_at);
CREATE INDEX ix_evidence_request ON evidence(workspace_id,request_id,created_at);
CREATE INDEX ix_messages_request ON messages(workspace_id,request_id,at);
CREATE INDEX ix_notifications_inbox ON notifications(workspace_id,read,at);
CREATE INDEX ix_request_locations_unit ON request_locations(workspace_id,unit_id);
CREATE UNIQUE INDEX ux_vendor_offers_active ON vendor_offers(workspace_id,request_id) WHERE status IN ('pending','accepted');
CREATE INDEX ix_vendor_offers_vendor ON vendor_offers(workspace_id,vendor_id,status);
CREATE INDEX ix_request_verifications_request ON request_verifications(workspace_id,request_id,revision);
CREATE INDEX ix_notification_reads_user ON notification_reads(workspace_id,user_id);
CREATE INDEX ix_notifications_request ON notifications(workspace_id,request_id,at);

-- SQLite is the local/test adapter only. Production uses the MySQL migration.
CREATE TABLE gate_presence (
 workspace_id TEXT NOT NULL,appointment_id TEXT NOT NULL,arrived_at TEXT NOT NULL,arrived_by TEXT NOT NULL,
 departed_at TEXT,departed_by TEXT,revision INTEGER NOT NULL CHECK(revision>0),PRIMARY KEY(workspace_id,appointment_id),
 FOREIGN KEY(workspace_id,appointment_id) REFERENCES appointments(workspace_id,id),
 CHECK((departed_at IS NULL AND departed_by IS NULL) OR (departed_at IS NOT NULL AND departed_by IS NOT NULL AND departed_at>=arrived_at))
);
CREATE INDEX ix_gate_open ON gate_presence(workspace_id,departed_at);
CREATE TABLE common_area_issues (
 workspace_id TEXT NOT NULL,id TEXT NOT NULL,property_id TEXT NOT NULL,location TEXT NOT NULL,title TEXT NOT NULL,
 category TEXT NOT NULL,description TEXT NOT NULL,priority TEXT NOT NULL CHECK(priority IN ('routine','urgent')),
 status TEXT NOT NULL CHECK(status IN ('reported','in_progress','resolved')),reported_by TEXT NOT NULL,submission_id TEXT NOT NULL,
 resolution_note TEXT,updated_by TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0),
 PRIMARY KEY(workspace_id,id),UNIQUE(workspace_id,reported_by,submission_id),
 FOREIGN KEY(workspace_id,property_id) REFERENCES properties(workspace_id,id)
);
CREATE INDEX ix_common_area_queue ON common_area_issues(workspace_id,property_id,status,created_at);
CREATE TABLE common_area_issue_events (
 workspace_id TEXT NOT NULL,id TEXT NOT NULL,issue_id TEXT NOT NULL,status TEXT NOT NULL,note TEXT NOT NULL,actor_id TEXT NOT NULL,at TEXT NOT NULL,
 PRIMARY KEY(workspace_id,id),FOREIGN KEY(workspace_id,issue_id) REFERENCES common_area_issues(workspace_id,id)
);
CREATE INDEX ix_common_area_history ON common_area_issue_events(workspace_id,issue_id,at);

-- BEGIN COMMUNITY V6
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

-- END COMMUNITY V6

-- BEGIN USER CONTEXT V7
CREATE TABLE IF NOT EXISTS users (
    workspace_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_context INTEGER NOT NULL DEFAULT 1 CHECK (user_context IN (1,2)),
    revision INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (workspace_id,user_id)
);

-- END USER CONTEXT V7

-- BEGIN MANAGEMENT V8
CREATE TABLE users_v8 (workspace_id TEXT NOT NULL,user_id TEXT NOT NULL,user_context INTEGER NOT NULL DEFAULT 1 CHECK (user_context IN (1,2,3)),revision INTEGER NOT NULL DEFAULT 0,display_name TEXT NOT NULL DEFAULT '',email TEXT NOT NULL DEFAULT '',identity_role TEXT NOT NULL DEFAULT '',managed_role TEXT NULL,status TEXT NOT NULL DEFAULT 'active',allow_user INTEGER NOT NULL DEFAULT 1,allow_admin INTEGER NOT NULL DEFAULT 0,allow_seller INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT '',PRIMARY KEY(workspace_id,user_id));
INSERT INTO users_v8(workspace_id,user_id,user_context,revision) SELECT workspace_id,user_id,user_context,revision FROM users;
DROP TABLE users;
ALTER TABLE users_v8 RENAME TO users;
CREATE TABLE IF NOT EXISTS user_memberships (workspace_id TEXT NOT NULL,user_id TEXT NOT NULL,property_id TEXT NOT NULL,unit_id TEXT NULL,occupancy_id TEXT NULL,starts_at TEXT NULL,ends_at TEXT NULL,PRIMARY KEY(workspace_id,user_id,property_id),FOREIGN KEY(workspace_id,user_id) REFERENCES users(workspace_id,user_id),FOREIGN KEY(workspace_id,property_id) REFERENCES properties(workspace_id,id),FOREIGN KEY(workspace_id,property_id,unit_id) REFERENCES property_units(workspace_id,property_id,id));
CREATE TABLE IF NOT EXISTS user_admin_audit (workspace_id TEXT NOT NULL,id TEXT NOT NULL,user_id TEXT NOT NULL,actor_id TEXT NOT NULL,action TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(workspace_id,id),FOREIGN KEY(workspace_id,user_id) REFERENCES users(workspace_id,user_id));
CREATE TABLE IF NOT EXISTS community_services (workspace_id TEXT NOT NULL,property_id TEXT NOT NULL,id TEXT NOT NULL,revision INTEGER NOT NULL,created_at TEXT NOT NULL,seller_id TEXT NOT NULL,name TEXT NOT NULL,category TEXT NOT NULL,description TEXT NOT NULL,price NUMERIC NOT NULL,currency TEXT NOT NULL,price_unit TEXT NOT NULL,status TEXT NOT NULL,PRIMARY KEY(workspace_id,id),UNIQUE(workspace_id,property_id,id),FOREIGN KEY(workspace_id,property_id) REFERENCES properties(workspace_id,id),FOREIGN KEY(workspace_id,property_id,seller_id) REFERENCES community_sellers(workspace_id,property_id,id),CHECK(price>0),CHECK(price_unit IN ('visit','hour','fixed')),CHECK(status IN ('active','paused')));
CREATE TABLE IF NOT EXISTS community_service_requests (workspace_id TEXT NOT NULL,property_id TEXT NOT NULL,id TEXT NOT NULL,revision INTEGER NOT NULL,created_at TEXT NOT NULL,service_id TEXT NOT NULL,seller_id TEXT NOT NULL,user_id TEXT NOT NULL,service_name TEXT NOT NULL,description TEXT NOT NULL,preferred_at TEXT NOT NULL,price NUMERIC NOT NULL,currency TEXT NOT NULL,price_unit TEXT NOT NULL,status TEXT NOT NULL,submission_id TEXT NOT NULL,PRIMARY KEY(workspace_id,id),UNIQUE(workspace_id,property_id,id),FOREIGN KEY(workspace_id,property_id) REFERENCES properties(workspace_id,id),FOREIGN KEY(workspace_id,property_id,service_id) REFERENCES community_services(workspace_id,property_id,id),FOREIGN KEY(workspace_id,property_id,seller_id) REFERENCES community_sellers(workspace_id,property_id,id),CHECK(price>0),CHECK(price_unit IN ('visit','hour','fixed')),CHECK(status IN ('requested','accepted','completed','declined','cancelled')),UNIQUE(workspace_id,user_id,submission_id));

-- END MANAGEMENT V8

-- BEGIN STRUCTURE V9
-- Existing properties remain communities. Existing flats and floor plans remain unassigned to a block until an admin organizes them.
CREATE TABLE IF NOT EXISTS community_blocks (
 id TEXT NOT NULL, workspace_id TEXT NOT NULL, property_id TEXT NOT NULL,
 revision INTEGER NOT NULL, created_at TEXT NOT NULL, name TEXT NOT NULL,
 PRIMARY KEY(workspace_id,id), UNIQUE(workspace_id,property_id,id), UNIQUE(workspace_id,property_id,name),
 FOREIGN KEY(workspace_id,property_id) REFERENCES properties(workspace_id,id)
);
CREATE TABLE IF NOT EXISTS community_unit_locations (
 workspace_id TEXT NOT NULL, property_id TEXT NOT NULL, unit_id TEXT NOT NULL, block_id TEXT NOT NULL, floor INTEGER NOT NULL,
 PRIMARY KEY(workspace_id,unit_id),
 FOREIGN KEY(workspace_id,property_id,unit_id) REFERENCES property_units(workspace_id,property_id,id),
 FOREIGN KEY(workspace_id,property_id,block_id) REFERENCES community_blocks(workspace_id,property_id,id),
 CHECK(floor BETWEEN -5 AND 150)
);
CREATE TABLE IF NOT EXISTS community_block_layouts (
 id TEXT NOT NULL, workspace_id TEXT NOT NULL, property_id TEXT NOT NULL,
 revision INTEGER NOT NULL, created_at TEXT NOT NULL, block_id TEXT NOT NULL, floor INTEGER NOT NULL,
 name TEXT NOT NULL, draft_json TEXT NOT NULL, published_json TEXT NOT NULL, published_at TEXT,
 PRIMARY KEY(workspace_id,id), UNIQUE(workspace_id,property_id,id), UNIQUE(workspace_id,property_id,block_id,floor),
 FOREIGN KEY(workspace_id,property_id,block_id) REFERENCES community_blocks(workspace_id,property_id,id),
 CHECK(floor BETWEEN -5 AND 150)
);
CREATE TABLE IF NOT EXISTS community_deliveries (
 id TEXT NOT NULL, workspace_id TEXT NOT NULL, property_id TEXT NOT NULL,
 revision INTEGER NOT NULL, created_at TEXT NOT NULL, user_id TEXT NOT NULL,
 seller_id TEXT, unit_id TEXT, name TEXT NOT NULL, reference TEXT NOT NULL, notes TEXT NOT NULL,
 packages INTEGER NOT NULL, bulk INTEGER NOT NULL, expected_at TEXT NOT NULL,
 approval TEXT NOT NULL, status TEXT NOT NULL, accepted_at TEXT, received_at TEXT,
 PRIMARY KEY(workspace_id,id), UNIQUE(workspace_id,property_id,id),
 FOREIGN KEY(workspace_id,property_id) REFERENCES properties(workspace_id,id),
 FOREIGN KEY(workspace_id,property_id,seller_id) REFERENCES community_sellers(workspace_id,property_id,id),
 FOREIGN KEY(workspace_id,property_id,unit_id) REFERENCES property_units(workspace_id,property_id,id),
 CHECK(packages BETWEEN 1 AND 10000), CHECK(bulk IN (0,1))
);

-- END STRUCTURE V9

-- Mark the baseline compatible with the application's nine versioned migrations.
INSERT INTO schema_migrations(version,applied_at) VALUES
 (1,CAST(CURRENT_TIMESTAMP AS TEXT)),(2,CAST(CURRENT_TIMESTAMP AS TEXT)),(3,CAST(CURRENT_TIMESTAMP AS TEXT)),(4,CAST(CURRENT_TIMESTAMP AS TEXT)),(5,CAST(CURRENT_TIMESTAMP AS TEXT)),(6,CAST(CURRENT_TIMESTAMP AS TEXT)),(7,CAST(CURRENT_TIMESTAMP AS TEXT)),(8,CAST(CURRENT_TIMESTAMP AS TEXT)),(9,CAST(CURRENT_TIMESTAMP AS TEXT));
COMMIT;


