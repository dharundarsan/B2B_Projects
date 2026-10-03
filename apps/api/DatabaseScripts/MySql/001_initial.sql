-- MySQL 8.4 LTS / InnoDB schema version 1. Existing data is never reset.
-- UTC ISO-8601 timestamps preserve the public API; money uses exact DECIMAL.
CREATE TABLE IF NOT EXISTS properties (
 workspace_id VARCHAR(200) NOT NULL, id VARCHAR(200) NOT NULL, name VARCHAR(160) NOT NULL, address TEXT NOT NULL,
 units INTEGER NOT NULL CHECK(units > 0), timezone VARCHAR(100) NOT NULL, assets INTEGER NOT NULL DEFAULT 0,
 image_url TEXT, archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)), PRIMARY KEY(workspace_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;
CREATE TABLE IF NOT EXISTS vendors (
 workspace_id VARCHAR(200) NOT NULL, id VARCHAR(200) NOT NULL, name VARCHAR(160) NOT NULL, email VARCHAR(254), phone VARCHAR(60), trade VARCHAR(100) NOT NULL,
 distance VARCHAR(255) NOT NULL, availability VARCHAR(255) NOT NULL, first_visit_fixes VARCHAR(255) NOT NULL,
 status VARCHAR(32) NOT NULL CHECK(status IN ('preferred','approved','review')), PRIMARY KEY(workspace_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;
CREATE TABLE IF NOT EXISTS requests (
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
 KEY ix_requests_queue(workspace_id,state,created_at),
 KEY ix_requests_unit(workspace_id,property_id,unit),
 KEY ix_requests_vendor(workspace_id,assigned_vendor_id,state)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE IF NOT EXISTS events (
 workspace_id VARCHAR(200) NOT NULL, request_id VARCHAR(200) NOT NULL, id VARCHAR(200) NOT NULL, type VARCHAR(100) NOT NULL,
 label VARCHAR(255) NOT NULL, detail TEXT NOT NULL, at VARCHAR(40) NOT NULL, actor VARCHAR(254), PRIMARY KEY(workspace_id,id),
 FOREIGN KEY(workspace_id,request_id) REFERENCES requests(workspace_id,id),
 KEY ix_events_request(workspace_id,request_id,at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;
CREATE TABLE IF NOT EXISTS estimates (
 workspace_id VARCHAR(200) NOT NULL, request_id VARCHAR(200) NOT NULL, id VARCHAR(200) NOT NULL, version INTEGER NOT NULL CHECK(version > 0),
 scope TEXT NOT NULL, labor DECIMAL(14,2) NOT NULL CHECK(labor >= 0), parts DECIMAL(14,2) NOT NULL CHECK(parts >= 0),
 tax DECIMAL(14,2) NOT NULL CHECK(tax >= 0), total DECIMAL(14,2) NOT NULL,
 CONSTRAINT ck_estimates_total CHECK(ROUND(total,2) = ROUND(labor + parts + tax,2)),
 status VARCHAR(32) NOT NULL CHECK(status IN ('submitted','approved','changes_requested')), created_at VARCHAR(40) NOT NULL,
 approved_at VARCHAR(40), approved_by VARCHAR(200), PRIMARY KEY(workspace_id,id), UNIQUE(workspace_id,request_id,version),
 FOREIGN KEY(workspace_id,request_id) REFERENCES requests(workspace_id,id),
 KEY ix_estimates_request(workspace_id,request_id,version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;
CREATE TABLE IF NOT EXISTS appointments (
 workspace_id VARCHAR(200) NOT NULL, request_id VARCHAR(200) NOT NULL, id VARCHAR(200) NOT NULL, starts_at VARCHAR(40) NOT NULL,
 ends_at VARCHAR(40) NOT NULL, timezone VARCHAR(100) NOT NULL, status VARCHAR(32) NOT NULL CHECK(status IN ('proposed','confirmed','cancelled')),
 resident_confirmed_at VARCHAR(40), vendor_confirmed_at VARCHAR(40), created_at VARCHAR(40) NOT NULL, PRIMARY KEY(workspace_id,id),
 FOREIGN KEY(workspace_id,request_id) REFERENCES requests(workspace_id,id),
 KEY ix_appointments_request(workspace_id,request_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;
CREATE TABLE IF NOT EXISTS evidence (
 workspace_id VARCHAR(200) NOT NULL, request_id VARCHAR(200) NOT NULL, id VARCHAR(200) NOT NULL, path TEXT NOT NULL, name VARCHAR(160) NOT NULL,
 content_type VARCHAR(100) NOT NULL, size BIGINT NOT NULL CHECK(size > 0 AND size <= 20971520), uploaded_by VARCHAR(200) NOT NULL,
 created_at VARCHAR(40) NOT NULL, status VARCHAR(32) NOT NULL CHECK(status IN ('uploading','uploaded')), PRIMARY KEY(workspace_id,id),
 path_hash BINARY(32) GENERATED ALWAYS AS (UNHEX(SHA2(path,256))) STORED,
 UNIQUE(path_hash), FOREIGN KEY(workspace_id,request_id) REFERENCES requests(workspace_id,id),
 KEY ix_evidence_request(workspace_id,request_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;
CREATE TABLE IF NOT EXISTS messages (
 workspace_id VARCHAR(200) NOT NULL, request_id VARCHAR(200) NOT NULL, id VARCHAR(200) NOT NULL, sender VARCHAR(254) NOT NULL,
 role VARCHAR(32) NOT NULL CHECK(role IN ('resident','manager','vendor','system')), body TEXT NOT NULL,
 at VARCHAR(40) NOT NULL, status VARCHAR(32) NOT NULL, PRIMARY KEY(workspace_id,id),
 FOREIGN KEY(workspace_id,request_id) REFERENCES requests(workspace_id,id),
 KEY ix_messages_request(workspace_id,request_id,at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;
CREATE TABLE IF NOT EXISTS notifications (
 workspace_id VARCHAR(200) NOT NULL, id VARCHAR(200) NOT NULL, title VARCHAR(200) NOT NULL, detail TEXT NOT NULL, type VARCHAR(100) NOT NULL,
 `read` INTEGER NOT NULL DEFAULT 0 CHECK(`read` IN (0,1)), href TEXT, at VARCHAR(40) NOT NULL, PRIMARY KEY(workspace_id,id),
 KEY ix_notifications_inbox(workspace_id,`read`,at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;








