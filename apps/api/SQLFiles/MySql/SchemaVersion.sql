SELECT CASE WHEN MIN(completed)=0 OR COUNT(*)<>COALESCE(MAX(version),0) THEN -1 ELSE COALESCE(MAX(version),0) END FROM schema_migrations
