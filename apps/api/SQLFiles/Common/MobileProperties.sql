SELECT p.id,p.name,p.timezone FROM properties p WHERE p.workspace_id=@workspace AND p.archived=0 AND ({PropertyScope}) ORDER BY p.name;
