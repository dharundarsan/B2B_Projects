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
