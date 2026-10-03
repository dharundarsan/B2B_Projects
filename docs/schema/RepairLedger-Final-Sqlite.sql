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

-- Mark the baseline compatible with the application's five versioned migrations.
INSERT INTO schema_migrations(version,applied_at) VALUES
 (1,CAST(CURRENT_TIMESTAMP AS TEXT)),(2,CAST(CURRENT_TIMESTAMP AS TEXT)),(3,CAST(CURRENT_TIMESTAMP AS TEXT)),(4,CAST(CURRENT_TIMESTAMP AS TEXT)),(5,CAST(CURRENT_TIMESTAMP AS TEXT));
COMMIT;


