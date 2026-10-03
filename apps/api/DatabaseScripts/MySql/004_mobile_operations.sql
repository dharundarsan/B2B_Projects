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
