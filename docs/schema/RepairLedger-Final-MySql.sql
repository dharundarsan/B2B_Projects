-- RepairLedger final MySQL 8.4 LTS / InnoDB schema: version 4.
-- Reference/bootstrap for an EMPTY database/schema only. Never run against an existing installation.
-- MySQL DDL is not transactionally reversible; back up before schema changes.
-- Existing installations MUST use the embedded 001 -> 002 -> 003 migrations.
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
 state VARCHAR(32) NOT NULL CHECK(state IN ('draft','submitted','urgent','acknowledged','assigned','waiting','scheduled','approved','in_progress','completed','verification','invoice_review','closed','cancelled')),
 next_action VARCHAR(255) NOT NULL, due_label VARCHAR(255) NOT NULL, description TEXT NOT NULL, access TEXT NOT NULL,
 language VARCHAR(100) NOT NULL, timezone VARCHAR(100) NOT NULL, created_at VARCHAR(40) NOT NULL, photo_url TEXT, access_notes TEXT,
 preferred_window TEXT, safety_json JSON NOT NULL DEFAULT (JSON_OBJECT()), assigned_vendor_id VARCHAR(200),
 assigned_vendor_name VARCHAR(160), vendor_decision VARCHAR(32) CHECK(vendor_decision IN ('pending','accepted','declined')),
 verification_json JSON, PRIMARY KEY(workspace_id,id),
 FOREIGN KEY(workspace_id,property_id) REFERENCES properties(workspace_id,id),
 FOREIGN KEY(workspace_id,assigned_vendor_id) REFERENCES vendors(workspace_id,id),
 UNIQUE KEY ux_request_property_reference(workspace_id,id,property_id),
 KEY ix_requests_queue(workspace_id,state,created_at),
 KEY ix_requests_unit(workspace_id,property_id,unit),
 KEY ix_requests_vendor(workspace_id,assigned_vendor_id,state)
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

-- Mark the baseline compatible with the application's four versioned migrations.
INSERT INTO schema_migrations(version,applied_at,completed,checksum) VALUES
 (1,DATE_FORMAT(UTC_TIMESTAMP(6),'%Y-%m-%dT%H:%i:%s.%f+00:00'),1,'B7500B2330F6FA15F9A94594F842432D58A4273445D56191FEF3F2B33BE3FFAD'),
 (2,DATE_FORMAT(UTC_TIMESTAMP(6),'%Y-%m-%dT%H:%i:%s.%f+00:00'),1,'DCFC6886F8C9586B511D122B2018A3959FBD882025E2C0EC737857F169A96CA0'),
 (3,DATE_FORMAT(UTC_TIMESTAMP(6),'%Y-%m-%dT%H:%i:%s.%f+00:00'),1,'6CE00719E7DC7C99A80DCF272FE54632E34F915E6B62225A4DFC52488D86D80E'),
 (4,DATE_FORMAT(UTC_TIMESTAMP(6),'%Y-%m-%dT%H:%i:%s.%f+00:00'),1,'A21F5F1DCC9608B1A442C5EACD3D6741F899EC93AB1FF2043BFE40B486E377E5');

