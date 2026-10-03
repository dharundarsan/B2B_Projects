-- Additive: never infer authenticated identities from old names, emails or unit labels.
ALTER TABLE requests ADD COLUMN resident_user_id VARCHAR(200);
ALTER TABLE requests ADD COLUMN resident_occupancy_id VARCHAR(36);
ALTER TABLE requests ADD CONSTRAINT ck_requests_resident_binding CHECK(
 (resident_user_id IS NULL AND resident_occupancy_id IS NULL) OR
 (resident_user_id IS NOT NULL AND resident_occupancy_id IS NOT NULL));
ALTER TABLE requests ADD KEY ix_requests_resident_access(workspace_id,resident_user_id,resident_occupancy_id);
