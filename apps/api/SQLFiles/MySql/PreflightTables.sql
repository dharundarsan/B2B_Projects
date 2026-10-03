SELECT TABLE_NAME AS Name, ENGINE AS Engine, TABLE_TYPE AS TableType
FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN @names
