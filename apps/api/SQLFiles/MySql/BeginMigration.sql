INSERT INTO schema_migrations(version,applied_at,completed,checksum) VALUES(@version,@at,0,@checksum) ON DUPLICATE KEY UPDATE completed=0
