INSERT INTO workspaces(id,name,default_currency,created_at) VALUES(@workspace,'My workspace','USD',@at) ON DUPLICATE KEY UPDATE id=workspaces.id
