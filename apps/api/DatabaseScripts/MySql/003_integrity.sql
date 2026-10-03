-- MySQL native integrity and legacy verification snapshot. DDL commits independently.
ALTER TABLE properties ADD CONSTRAINT fk_properties_workspace FOREIGN KEY(workspace_id) REFERENCES workspaces(id);
ALTER TABLE vendors ADD CONSTRAINT fk_vendors_workspace FOREIGN KEY(workspace_id) REFERENCES workspaces(id);
ALTER TABLE notifications ADD CONSTRAINT fk_notifications_workspace FOREIGN KEY(workspace_id) REFERENCES workspaces(id);
ALTER TABLE notifications ADD CONSTRAINT fk_notifications_request FOREIGN KEY(workspace_id,request_id) REFERENCES requests(workspace_id,id);
ALTER TABLE estimates ADD CONSTRAINT fk_estimates_vendor FOREIGN KEY(workspace_id,vendor_id) REFERENCES vendors(workspace_id,id);
ALTER TABLE notifications ADD KEY ix_notifications_request(workspace_id,request_id,at);
INSERT INTO request_verifications(workspace_id,id,request_id,revision,status,note,recorded_at,legacy_snapshot)
 SELECT workspace_id,CONCAT('legacy:',id),id,revision,JSON_UNQUOTE(JSON_EXTRACT(verification_json,'$.Status')),
 NULLIF(JSON_UNQUOTE(JSON_EXTRACT(verification_json,'$.Note')),'null'),
 COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(verification_json,'$.UpdatedAt')),'null'),created_at),1
 FROM requests WHERE verification_json IS NOT NULL
 ON DUPLICATE KEY UPDATE id=request_verifications.id;

