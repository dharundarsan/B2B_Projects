-- Additive migration. Never reset tables or fabricate unknown unit/resident identities.
CREATE TABLE IF NOT EXISTS workspaces (
 id VARCHAR(200) PRIMARY KEY, name VARCHAR(160) NOT NULL, default_currency CHAR(3) NOT NULL DEFAULT 'USD'
 CHECK(CHAR_LENGTH(default_currency)=3 AND default_currency=UPPER(default_currency)), created_at VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;
INSERT INTO workspaces(id,name,created_at)
 SELECT workspace_id,'Imported workspace',@migrationAt FROM requests GROUP BY workspace_id
 ON DUPLICATE KEY UPDATE id=workspaces.id;
INSERT INTO workspaces(id,name,created_at)
 SELECT workspace_id,'Imported workspace',@migrationAt FROM
 (SELECT workspace_id FROM properties UNION SELECT workspace_id FROM vendors UNION SELECT workspace_id FROM notifications) w
 WHERE NOT EXISTS(SELECT 1 FROM workspaces x WHERE x.id=w.workspace_id)
 ON DUPLICATE KEY UPDATE id=workspaces.id;
CREATE TABLE IF NOT EXISTS property_units (
 workspace_id VARCHAR(200) NOT NULL, id VARCHAR(300) NOT NULL, property_id VARCHAR(200) NOT NULL, label VARCHAR(40) NOT NULL CHECK(CHAR_LENGTH(trim(label)) BETWEEN 1 AND 40),
 archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)), created_at VARCHAR(40) NOT NULL,
 PRIMARY KEY(workspace_id,id), UNIQUE(workspace_id,property_id,label), UNIQUE(workspace_id,id,property_id),
 FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
 FOREIGN KEY(workspace_id,property_id) REFERENCES properties(workspace_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;
INSERT INTO property_units(workspace_id,id,property_id,label,created_at)
 SELECT workspace_id,CONCAT('legacy:',CHAR_LENGTH(property_id),':',property_id,':',unit),property_id,unit,MIN(created_at)
 FROM requests GROUP BY workspace_id,property_id,unit
 ON DUPLICATE KEY UPDATE id=property_units.id;
ALTER TABLE requests ADD UNIQUE KEY ux_request_property_reference(workspace_id,id,property_id);
-- Capacity was previously a declared number, not an inventory. Preserve historical units when reconciling it.
UPDATE properties SET units=(SELECT COUNT(*) FROM property_units u WHERE u.workspace_id=properties.workspace_id AND u.property_id=properties.id)
 WHERE units < (SELECT COUNT(*) FROM property_units u WHERE u.workspace_id=properties.workspace_id AND u.property_id=properties.id);

CREATE TABLE IF NOT EXISTS request_locations (
 workspace_id VARCHAR(200) NOT NULL, request_id VARCHAR(200) NOT NULL, property_id VARCHAR(200) NOT NULL, unit_id VARCHAR(300) NOT NULL,
 PRIMARY KEY(workspace_id,request_id),
 FOREIGN KEY(workspace_id,request_id,property_id) REFERENCES requests(workspace_id,id,property_id),
 FOREIGN KEY(workspace_id,unit_id,property_id) REFERENCES property_units(workspace_id,id,property_id),
 KEY ix_request_locations_unit(workspace_id,unit_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;
INSERT INTO request_locations(workspace_id,request_id,property_id,unit_id)
 SELECT r.workspace_id,r.id,r.property_id,u.id FROM requests r JOIN property_units u
 ON u.workspace_id=r.workspace_id AND u.property_id=r.property_id AND u.label=r.unit
 ON DUPLICATE KEY UPDATE request_id=request_locations.request_id;

CREATE TABLE IF NOT EXISTS vendor_offers (
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
INSERT INTO vendor_offers(workspace_id,id,request_id,vendor_id,`sequence`,status,legacy_snapshot)
 SELECT workspace_id,CONCAT('legacy:',id),id,assigned_vendor_id,1,COALESCE(vendor_decision,'pending'),1
 FROM requests WHERE assigned_vendor_id IS NOT NULL
 ON DUPLICATE KEY UPDATE id=vendor_offers.id;

ALTER TABLE estimates ADD COLUMN vendor_id VARCHAR(200);
ALTER TABLE estimates ADD COLUMN currency CHAR(3) NOT NULL DEFAULT 'USD' CHECK(CHAR_LENGTH(currency)=3 AND currency=UPPER(currency));
-- Legacy quote ownership cannot be inferred safely from the current assignment; keep vendor_id NULL.
CREATE TABLE IF NOT EXISTS request_verifications (
 workspace_id VARCHAR(200) NOT NULL, id VARCHAR(256) NOT NULL, request_id VARCHAR(200) NOT NULL, revision BIGINT NOT NULL CHECK(revision>=0),
 status VARCHAR(32) NOT NULL CHECK(status IN ('pending','verified','unresolved')), note TEXT, actor_id VARCHAR(200), recorded_at VARCHAR(40) NOT NULL,
 legacy_snapshot INTEGER NOT NULL DEFAULT 0 CHECK(legacy_snapshot IN (0,1)),
 PRIMARY KEY(workspace_id,id), UNIQUE(workspace_id,request_id,revision),
 FOREIGN KEY(workspace_id,request_id) REFERENCES requests(workspace_id,id),
 KEY ix_request_verifications_request(workspace_id,request_id,revision)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

ALTER TABLE notifications ADD COLUMN request_id VARCHAR(200);
UPDATE notifications SET request_id=(SELECT r.id FROM requests r WHERE r.workspace_id=notifications.workspace_id AND notifications.href=CONCAT('/requests/',r.id));
CREATE TABLE IF NOT EXISTS notification_reads (
 workspace_id VARCHAR(200) NOT NULL, notification_id VARCHAR(200) NOT NULL, user_id VARCHAR(200) NOT NULL, read_at VARCHAR(40) NOT NULL,
 PRIMARY KEY(workspace_id,notification_id,user_id),
 FOREIGN KEY(workspace_id,notification_id) REFERENCES notifications(workspace_id,id),
 KEY ix_notification_reads_user(workspace_id,user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;




