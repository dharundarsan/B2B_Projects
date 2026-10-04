-- Existing properties remain communities. Existing flats and floor plans remain unassigned to a block until an admin organizes them.
CREATE TABLE IF NOT EXISTS community_blocks (
 id TEXT NOT NULL, workspace_id TEXT NOT NULL, property_id TEXT NOT NULL,
 revision INTEGER NOT NULL, created_at TEXT NOT NULL, name TEXT NOT NULL,
 PRIMARY KEY(workspace_id,id), UNIQUE(workspace_id,property_id,id), UNIQUE(workspace_id,property_id,name),
 FOREIGN KEY(workspace_id,property_id) REFERENCES properties(workspace_id,id)
);
CREATE TABLE IF NOT EXISTS community_unit_locations (
 workspace_id TEXT NOT NULL, property_id TEXT NOT NULL, unit_id TEXT NOT NULL, block_id TEXT NOT NULL, floor INTEGER NOT NULL,
 PRIMARY KEY(workspace_id,unit_id),
 FOREIGN KEY(workspace_id,property_id,unit_id) REFERENCES property_units(workspace_id,property_id,id),
 FOREIGN KEY(workspace_id,property_id,block_id) REFERENCES community_blocks(workspace_id,property_id,id),
 CHECK(floor BETWEEN -5 AND 150)
);
CREATE TABLE IF NOT EXISTS community_block_layouts (
 id TEXT NOT NULL, workspace_id TEXT NOT NULL, property_id TEXT NOT NULL,
 revision INTEGER NOT NULL, created_at TEXT NOT NULL, block_id TEXT NOT NULL, floor INTEGER NOT NULL,
 name TEXT NOT NULL, draft_json TEXT NOT NULL, published_json TEXT NOT NULL, published_at TEXT,
 PRIMARY KEY(workspace_id,id), UNIQUE(workspace_id,property_id,id), UNIQUE(workspace_id,property_id,block_id,floor),
 FOREIGN KEY(workspace_id,property_id,block_id) REFERENCES community_blocks(workspace_id,property_id,id),
 CHECK(floor BETWEEN -5 AND 150)
);
CREATE TABLE IF NOT EXISTS community_deliveries (
 id TEXT NOT NULL, workspace_id TEXT NOT NULL, property_id TEXT NOT NULL,
 revision INTEGER NOT NULL, created_at TEXT NOT NULL, user_id TEXT NOT NULL,
 seller_id TEXT, unit_id TEXT, name TEXT NOT NULL, reference TEXT NOT NULL, notes TEXT NOT NULL,
 packages INTEGER NOT NULL, bulk INTEGER NOT NULL, expected_at TEXT NOT NULL,
 approval TEXT NOT NULL, status TEXT NOT NULL, accepted_at TEXT, received_at TEXT,
 PRIMARY KEY(workspace_id,id), UNIQUE(workspace_id,property_id,id),
 FOREIGN KEY(workspace_id,property_id) REFERENCES properties(workspace_id,id),
 FOREIGN KEY(workspace_id,property_id,seller_id) REFERENCES community_sellers(workspace_id,property_id,id),
 FOREIGN KEY(workspace_id,property_id,unit_id) REFERENCES property_units(workspace_id,property_id,id),
 CHECK(packages BETWEEN 1 AND 10000), CHECK(bulk IN (0,1))
);
