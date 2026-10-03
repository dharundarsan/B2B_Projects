-- Connections always enable foreign_keys. Triggers extend v1 without rebuilding live tables.
CREATE TRIGGER fk_properties_workspace_insert BEFORE INSERT ON properties
WHEN NOT EXISTS(SELECT 1 FROM workspaces WHERE id=NEW.workspace_id)
BEGIN SELECT RAISE(ABORT,'Unknown workspace'); END;
CREATE TRIGGER fk_properties_workspace_update BEFORE UPDATE OF workspace_id ON properties
WHEN NOT EXISTS(SELECT 1 FROM workspaces WHERE id=NEW.workspace_id)
BEGIN SELECT RAISE(ABORT,'Unknown workspace'); END;
CREATE TRIGGER fk_workspaces_properties_delete BEFORE DELETE ON workspaces
WHEN EXISTS(SELECT 1 FROM properties WHERE workspace_id=OLD.id)
BEGIN SELECT RAISE(ABORT,'Workspace still referenced'); END;
CREATE TRIGGER fk_workspaces_properties_update BEFORE UPDATE OF id ON workspaces
WHEN OLD.id<>NEW.id AND EXISTS(SELECT 1 FROM properties WHERE workspace_id=OLD.id)
BEGIN SELECT RAISE(ABORT,'Workspace still referenced'); END;
CREATE TRIGGER fk_vendors_workspace_insert BEFORE INSERT ON vendors
WHEN NOT EXISTS(SELECT 1 FROM workspaces WHERE id=NEW.workspace_id)
BEGIN SELECT RAISE(ABORT,'Unknown workspace'); END;
CREATE TRIGGER fk_vendors_workspace_update BEFORE UPDATE OF workspace_id ON vendors
WHEN NOT EXISTS(SELECT 1 FROM workspaces WHERE id=NEW.workspace_id)
BEGIN SELECT RAISE(ABORT,'Unknown workspace'); END;
CREATE TRIGGER fk_workspaces_vendors_delete BEFORE DELETE ON workspaces
WHEN EXISTS(SELECT 1 FROM vendors WHERE workspace_id=OLD.id)
BEGIN SELECT RAISE(ABORT,'Workspace still referenced'); END;
CREATE TRIGGER fk_workspaces_vendors_update BEFORE UPDATE OF id ON workspaces
WHEN OLD.id<>NEW.id AND EXISTS(SELECT 1 FROM vendors WHERE workspace_id=OLD.id)
BEGIN SELECT RAISE(ABORT,'Workspace still referenced'); END;
CREATE TRIGGER fk_notifications_workspace_insert BEFORE INSERT ON notifications
WHEN NOT EXISTS(SELECT 1 FROM workspaces WHERE id=NEW.workspace_id)
BEGIN SELECT RAISE(ABORT,'Unknown workspace'); END;
CREATE TRIGGER fk_notifications_workspace_update BEFORE UPDATE OF workspace_id ON notifications
WHEN NOT EXISTS(SELECT 1 FROM workspaces WHERE id=NEW.workspace_id)
BEGIN SELECT RAISE(ABORT,'Unknown workspace'); END;
CREATE TRIGGER fk_workspaces_notifications_delete BEFORE DELETE ON workspaces
WHEN EXISTS(SELECT 1 FROM notifications WHERE workspace_id=OLD.id)
BEGIN SELECT RAISE(ABORT,'Workspace still referenced'); END;
CREATE TRIGGER fk_workspaces_notifications_update BEFORE UPDATE OF id ON workspaces
WHEN OLD.id<>NEW.id AND EXISTS(SELECT 1 FROM notifications WHERE workspace_id=OLD.id)
BEGIN SELECT RAISE(ABORT,'Workspace still referenced'); END;
CREATE TRIGGER fk_notifications_request_id_insert BEFORE INSERT ON notifications
WHEN NEW.request_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM requests WHERE workspace_id=NEW.workspace_id AND id=NEW.request_id)
BEGIN SELECT RAISE(ABORT,'Invalid request_id reference'); END;
CREATE TRIGGER fk_notifications_request_id_update BEFORE UPDATE OF workspace_id,request_id ON notifications
WHEN NEW.request_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM requests WHERE workspace_id=NEW.workspace_id AND id=NEW.request_id)
BEGIN SELECT RAISE(ABORT,'Invalid request_id reference'); END;
CREATE TRIGGER fk_requests_notifications_delete BEFORE DELETE ON requests
WHEN EXISTS(SELECT 1 FROM notifications WHERE workspace_id=OLD.workspace_id AND request_id=OLD.id)
BEGIN SELECT RAISE(ABORT,'Record still referenced'); END;
CREATE TRIGGER fk_requests_notifications_update BEFORE UPDATE OF workspace_id,id ON requests
WHEN (OLD.id<>NEW.id OR OLD.workspace_id<>NEW.workspace_id) AND EXISTS(SELECT 1 FROM notifications WHERE workspace_id=OLD.workspace_id AND request_id=OLD.id)
BEGIN SELECT RAISE(ABORT,'Record still referenced'); END;
CREATE TRIGGER fk_estimates_vendor_id_insert BEFORE INSERT ON estimates
WHEN NEW.vendor_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM vendors WHERE workspace_id=NEW.workspace_id AND id=NEW.vendor_id)
BEGIN SELECT RAISE(ABORT,'Invalid vendor_id reference'); END;
CREATE TRIGGER fk_estimates_vendor_id_update BEFORE UPDATE OF workspace_id,vendor_id ON estimates
WHEN NEW.vendor_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM vendors WHERE workspace_id=NEW.workspace_id AND id=NEW.vendor_id)
BEGIN SELECT RAISE(ABORT,'Invalid vendor_id reference'); END;
CREATE TRIGGER fk_vendors_estimates_delete BEFORE DELETE ON vendors
WHEN EXISTS(SELECT 1 FROM estimates WHERE workspace_id=OLD.workspace_id AND vendor_id=OLD.id)
BEGIN SELECT RAISE(ABORT,'Record still referenced'); END;
CREATE TRIGGER fk_vendors_estimates_update BEFORE UPDATE OF workspace_id,id ON vendors
WHEN (OLD.id<>NEW.id OR OLD.workspace_id<>NEW.workspace_id) AND EXISTS(SELECT 1 FROM estimates WHERE workspace_id=OLD.workspace_id AND vendor_id=OLD.id)
BEGIN SELECT RAISE(ABORT,'Record still referenced'); END;
INSERT INTO request_verifications(workspace_id,id,request_id,revision,status,note,recorded_at,legacy_snapshot)
 SELECT workspace_id,'legacy:' || id,id,revision,json_extract(verification_json,'$.Status'),json_extract(verification_json,'$.Note'),
 COALESCE(json_extract(verification_json,'$.UpdatedAt'),created_at),1 FROM requests WHERE verification_json IS NOT NULL;
