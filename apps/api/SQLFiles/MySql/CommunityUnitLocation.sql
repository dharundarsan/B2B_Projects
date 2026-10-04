INSERT INTO community_unit_locations(workspace_id,property_id,unit_id,block_id,floor) VALUES(@workspace,@property,@unit,@block,@floor) ON DUPLICATE KEY UPDATE block_id=@block,floor=@floor;
