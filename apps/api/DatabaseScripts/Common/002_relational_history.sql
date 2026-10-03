-- Additive migration. Never reset tables or fabricate unknown unit/resident identities.
CREATE TABLE workspaces (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, default_currency TEXT NOT NULL DEFAULT 'USD'
 CHECK(length(default_currency)=3 AND default_currency=UPPER(default_currency)), created_at TEXT NOT NULL
);
INSERT INTO workspaces(id,name,created_at)
 SELECT workspace_id,'Imported workspace',@migrationAt FROM requests GROUP BY workspace_id;
INSERT INTO workspaces(id,name,created_at)
 SELECT workspace_id,'Imported workspace',@migrationAt FROM
 (SELECT workspace_id FROM properties UNION SELECT workspace_id FROM vendors UNION SELECT workspace_id FROM notifications) w
 WHERE NOT EXISTS(SELECT 1 FROM workspaces x WHERE x.id=w.workspace_id);
CREATE TABLE property_units (
 workspace_id TEXT NOT NULL, id TEXT NOT NULL, property_id TEXT NOT NULL, label TEXT NOT NULL CHECK(length(trim(label)) BETWEEN 1 AND 40),
 archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)), created_at TEXT NOT NULL,
 PRIMARY KEY(workspace_id,id), UNIQUE(workspace_id,property_id,label), UNIQUE(workspace_id,id,property_id),
 FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
 FOREIGN KEY(workspace_id,property_id) REFERENCES properties(workspace_id,id)
);
INSERT INTO property_units(workspace_id,id,property_id,label,created_at)
 SELECT workspace_id,'legacy:' || length(property_id) || ':' || property_id || ':' || unit,property_id,unit,MIN(created_at)
 FROM requests GROUP BY workspace_id,property_id,unit;
-- Capacity was previously a declared number, not an inventory. Preserve historical units when reconciling it.
UPDATE properties SET units=(SELECT COUNT(*) FROM property_units u WHERE u.workspace_id=properties.workspace_id AND u.property_id=properties.id)
 WHERE units < (SELECT COUNT(*) FROM property_units u WHERE u.workspace_id=properties.workspace_id AND u.property_id=properties.id);
CREATE UNIQUE INDEX ux_request_property_reference ON requests(workspace_id,id,property_id);
CREATE TABLE request_locations (
 workspace_id TEXT NOT NULL, request_id TEXT NOT NULL, property_id TEXT NOT NULL, unit_id TEXT NOT NULL,
 PRIMARY KEY(workspace_id,request_id),
 FOREIGN KEY(workspace_id,request_id,property_id) REFERENCES requests(workspace_id,id,property_id),
 FOREIGN KEY(workspace_id,unit_id,property_id) REFERENCES property_units(workspace_id,id,property_id)
);
INSERT INTO request_locations(workspace_id,request_id,property_id,unit_id)
 SELECT r.workspace_id,r.id,r.property_id,u.id FROM requests r JOIN property_units u
 ON u.workspace_id=r.workspace_id AND u.property_id=r.property_id AND u.label=r.unit;
CREATE INDEX ix_request_locations_unit ON request_locations(workspace_id,unit_id);
CREATE TABLE vendor_offers (
 workspace_id TEXT NOT NULL, id TEXT NOT NULL, request_id TEXT NOT NULL, vendor_id TEXT NOT NULL,
 sequence INTEGER NOT NULL CHECK(sequence>0), status TEXT NOT NULL CHECK(status IN ('pending','accepted','declined','superseded','cancelled')),
 offered_at TEXT, responded_at TEXT, offered_by TEXT, response_by TEXT, note TEXT, response_note TEXT,
 legacy_snapshot INTEGER NOT NULL DEFAULT 0 CHECK(legacy_snapshot IN (0,1)),
 PRIMARY KEY(workspace_id,id), UNIQUE(workspace_id,request_id,sequence),
 FOREIGN KEY(workspace_id,request_id) REFERENCES requests(workspace_id,id),
 FOREIGN KEY(workspace_id,vendor_id) REFERENCES vendors(workspace_id,id)
);
INSERT INTO vendor_offers(workspace_id,id,request_id,vendor_id,sequence,status,legacy_snapshot)
 SELECT workspace_id,'legacy:' || id,id,assigned_vendor_id,1,COALESCE(vendor_decision,'pending'),1
 FROM requests WHERE assigned_vendor_id IS NOT NULL;
CREATE UNIQUE INDEX ux_vendor_offers_active ON vendor_offers(workspace_id,request_id) WHERE status IN ('pending','accepted');
CREATE INDEX ix_vendor_offers_vendor ON vendor_offers(workspace_id,vendor_id,status);
ALTER TABLE estimates ADD COLUMN vendor_id TEXT;
ALTER TABLE estimates ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD' CHECK(length(currency)=3 AND currency=UPPER(currency));
-- Legacy quote ownership cannot be inferred safely from the current assignment; keep vendor_id NULL.
CREATE TABLE request_verifications (
 workspace_id TEXT NOT NULL, id TEXT NOT NULL, request_id TEXT NOT NULL, revision BIGINT NOT NULL CHECK(revision>=0),
 status TEXT NOT NULL CHECK(status IN ('pending','verified','unresolved')), note TEXT, actor_id TEXT, recorded_at TEXT NOT NULL,
 legacy_snapshot INTEGER NOT NULL DEFAULT 0 CHECK(legacy_snapshot IN (0,1)),
 PRIMARY KEY(workspace_id,id), UNIQUE(workspace_id,request_id,revision),
 FOREIGN KEY(workspace_id,request_id) REFERENCES requests(workspace_id,id)
);
CREATE INDEX ix_request_verifications_request ON request_verifications(workspace_id,request_id,revision);
ALTER TABLE notifications ADD COLUMN request_id TEXT;
UPDATE notifications SET request_id=(SELECT r.id FROM requests r WHERE r.workspace_id=notifications.workspace_id AND notifications.href='/requests/' || r.id);
CREATE TABLE notification_reads (
 workspace_id TEXT NOT NULL, notification_id TEXT NOT NULL, user_id TEXT NOT NULL, read_at TEXT NOT NULL,
 PRIMARY KEY(workspace_id,notification_id,user_id),
 FOREIGN KEY(workspace_id,notification_id) REFERENCES notifications(workspace_id,id)
);
CREATE INDEX ix_notification_reads_user ON notification_reads(workspace_id,user_id);
CREATE INDEX ix_notifications_request ON notifications(workspace_id,request_id,at);
