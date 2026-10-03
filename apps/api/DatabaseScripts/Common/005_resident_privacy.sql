-- Never infer authenticated identities from legacy resident names or unit labels.
-- Existing records stay manager-only for resident audiences; managers retain their history.
ALTER TABLE requests ADD COLUMN resident_user_id TEXT;
ALTER TABLE requests ADD COLUMN resident_occupancy_id TEXT
 CHECK((resident_user_id IS NULL AND resident_occupancy_id IS NULL) OR (resident_user_id IS NOT NULL AND resident_occupancy_id IS NOT NULL));
CREATE INDEX ix_requests_resident_access ON requests(workspace_id,resident_user_id,resident_occupancy_id);
