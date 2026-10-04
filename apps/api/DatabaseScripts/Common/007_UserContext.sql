CREATE TABLE IF NOT EXISTS users (
    workspace_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_context INTEGER NOT NULL DEFAULT 1 CHECK (user_context IN (1,2)),
    revision INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (workspace_id,user_id)
);
