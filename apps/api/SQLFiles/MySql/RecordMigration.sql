INSERT INTO schema_migrations(version,applied_at,completed,checksum) VALUES(@version,@at,1,@checksum) ON DUPLICATE KEY UPDATE applied_at=@at,completed=1
