INSERT INTO property_units(workspace_id,id,property_id,label,archived,created_at) VALUES(@workspace,@id,@property,@label,0,@at) ON CONFLICT(workspace_id,property_id,label) DO NOTHING
