-- Portable relational schema. Timestamps are UTC ISO-8601 text in both providers;
-- production monetary storage is exact NUMERIC; calculations use C# decimal.
-- SQLite development numeric-affinity conversion is covered by integration tests.
CREATE TABLE IF NOT EXISTS properties (
 workspace_id TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL, address TEXT NOT NULL,
 units INTEGER NOT NULL CHECK(units > 0), timezone TEXT NOT NULL, assets INTEGER NOT NULL DEFAULT 0,
 image_url TEXT, archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)), PRIMARY KEY(workspace_id,id)
);
CREATE TABLE IF NOT EXISTS vendors (
 workspace_id TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL, email TEXT, phone TEXT, trade TEXT NOT NULL,
 distance TEXT NOT NULL, availability TEXT NOT NULL, first_visit_fixes TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('preferred','approved','review')), PRIMARY KEY(workspace_id,id)
);
CREATE TABLE IF NOT EXISTS requests (
 workspace_id TEXT NOT NULL, id TEXT NOT NULL, revision BIGINT NOT NULL DEFAULT 0,
 title TEXT NOT NULL, property TEXT NOT NULL, property_id TEXT NOT NULL, unit TEXT NOT NULL,
 resident TEXT NOT NULL, category TEXT NOT NULL, priority TEXT NOT NULL CHECK(priority IN ('routine','urgent')),
 state TEXT NOT NULL CHECK(state IN ('draft','submitted','urgent','acknowledged','assigned','waiting','scheduled','approved','in_progress','completed','verification','invoice_review','closed','cancelled')),
 next_action TEXT NOT NULL, due_label TEXT NOT NULL, description TEXT NOT NULL, access TEXT NOT NULL,
 language TEXT NOT NULL, timezone TEXT NOT NULL, created_at TEXT NOT NULL, photo_url TEXT, access_notes TEXT,
 preferred_window TEXT, safety_json TEXT NOT NULL DEFAULT '{}', assigned_vendor_id TEXT,
 assigned_vendor_name TEXT, vendor_decision TEXT CHECK(vendor_decision IN ('pending','accepted','declined')),
 verification_json TEXT, PRIMARY KEY(workspace_id,id),
 FOREIGN KEY(workspace_id,property_id) REFERENCES properties(workspace_id,id),
 FOREIGN KEY(workspace_id,assigned_vendor_id) REFERENCES vendors(workspace_id,id)
);
CREATE INDEX IF NOT EXISTS ix_requests_queue ON requests(workspace_id,state,created_at);
CREATE INDEX IF NOT EXISTS ix_requests_unit ON requests(workspace_id,property_id,unit);
CREATE INDEX IF NOT EXISTS ix_requests_vendor ON requests(workspace_id,assigned_vendor_id,state);
CREATE TABLE IF NOT EXISTS events (
 workspace_id TEXT NOT NULL, request_id TEXT NOT NULL, id TEXT NOT NULL, type TEXT NOT NULL,
 label TEXT NOT NULL, detail TEXT NOT NULL, at TEXT NOT NULL, actor TEXT, PRIMARY KEY(workspace_id,id),
 FOREIGN KEY(workspace_id,request_id) REFERENCES requests(workspace_id,id)
);
CREATE TABLE IF NOT EXISTS estimates (
 workspace_id TEXT NOT NULL, request_id TEXT NOT NULL, id TEXT NOT NULL, version INTEGER NOT NULL CHECK(version > 0),
 scope TEXT NOT NULL, labor NUMERIC(14,2) NOT NULL CHECK(labor >= 0), parts NUMERIC(14,2) NOT NULL CHECK(parts >= 0),
 tax NUMERIC(14,2) NOT NULL CHECK(tax >= 0), total NUMERIC(14,2) NOT NULL CHECK(ROUND(total,2) = ROUND(labor + parts + tax,2)),
 status TEXT NOT NULL CHECK(status IN ('submitted','approved','changes_requested')), created_at TEXT NOT NULL,
 approved_at TEXT, approved_by TEXT, PRIMARY KEY(workspace_id,id), UNIQUE(workspace_id,request_id,version),
 FOREIGN KEY(workspace_id,request_id) REFERENCES requests(workspace_id,id)
);
CREATE TABLE IF NOT EXISTS appointments (
 workspace_id TEXT NOT NULL, request_id TEXT NOT NULL, id TEXT NOT NULL, starts_at TEXT NOT NULL,
 ends_at TEXT NOT NULL, timezone TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('proposed','confirmed','cancelled')),
 resident_confirmed_at TEXT, vendor_confirmed_at TEXT, created_at TEXT NOT NULL, PRIMARY KEY(workspace_id,id),
 FOREIGN KEY(workspace_id,request_id) REFERENCES requests(workspace_id,id)
);
CREATE TABLE IF NOT EXISTS evidence (
 workspace_id TEXT NOT NULL, request_id TEXT NOT NULL, id TEXT NOT NULL, path TEXT NOT NULL, name TEXT NOT NULL,
 content_type TEXT NOT NULL, size BIGINT NOT NULL CHECK(size > 0 AND size <= 20971520), uploaded_by TEXT NOT NULL,
 created_at TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('uploading','uploaded')), PRIMARY KEY(workspace_id,id),
 UNIQUE(path), FOREIGN KEY(workspace_id,request_id) REFERENCES requests(workspace_id,id)
);
CREATE TABLE IF NOT EXISTS messages (
 workspace_id TEXT NOT NULL, request_id TEXT NOT NULL, id TEXT NOT NULL, sender TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('resident','manager','vendor','system')), body TEXT NOT NULL,
 at TEXT NOT NULL, status TEXT NOT NULL, PRIMARY KEY(workspace_id,id),
 FOREIGN KEY(workspace_id,request_id) REFERENCES requests(workspace_id,id)
);
CREATE TABLE IF NOT EXISTS notifications (
 workspace_id TEXT NOT NULL, id TEXT NOT NULL, title TEXT NOT NULL, detail TEXT NOT NULL, type TEXT NOT NULL,
 read INTEGER NOT NULL DEFAULT 0 CHECK(read IN (0,1)), href TEXT, at TEXT NOT NULL, PRIMARY KEY(workspace_id,id)
);
CREATE INDEX IF NOT EXISTS ix_events_request ON events(workspace_id,request_id,at);
CREATE INDEX IF NOT EXISTS ix_estimates_request ON estimates(workspace_id,request_id,version);
CREATE INDEX IF NOT EXISTS ix_appointments_request ON appointments(workspace_id,request_id,created_at);
CREATE INDEX IF NOT EXISTS ix_evidence_request ON evidence(workspace_id,request_id,created_at);
CREATE INDEX IF NOT EXISTS ix_messages_request ON messages(workspace_id,request_id,at);
CREATE INDEX IF NOT EXISTS ix_notifications_inbox ON notifications(workspace_id,read,at);
