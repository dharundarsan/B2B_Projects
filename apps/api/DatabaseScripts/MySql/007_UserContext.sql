CREATE TABLE IF NOT EXISTS users (
    workspace_id VARCHAR(200) NOT NULL,
    user_id VARCHAR(200) NOT NULL,
    user_context TINYINT NOT NULL DEFAULT 1,
    revision BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (workspace_id,user_id),
    CONSTRAINT users_context_valid CHECK (user_context IN (1,2))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;
