SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='schema_migrations'
