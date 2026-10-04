-- Existing properties remain communities. Existing flats and floor plans remain unassigned to a block until an admin organizes them.
CREATE TABLE IF NOT EXISTS community_blocks (
 id VARCHAR(100) NOT NULL, workspace_id VARCHAR(200) NOT NULL, property_id VARCHAR(200) NOT NULL,
 revision BIGINT NOT NULL, created_at VARCHAR(40) NOT NULL, name VARCHAR(200) NOT NULL,
 PRIMARY KEY(workspace_id,id), UNIQUE(workspace_id,property_id,id), UNIQUE(workspace_id,property_id,name),
 FOREIGN KEY(workspace_id,property_id) REFERENCES properties(workspace_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;
CREATE TABLE IF NOT EXISTS community_unit_locations (
 workspace_id VARCHAR(200) NOT NULL, property_id VARCHAR(200) NOT NULL, unit_id VARCHAR(300) NOT NULL, block_id VARCHAR(100) NOT NULL, floor INTEGER NOT NULL,
 PRIMARY KEY(workspace_id,unit_id),
 FOREIGN KEY(workspace_id,property_id,unit_id) REFERENCES property_units(workspace_id,property_id,id),
 FOREIGN KEY(workspace_id,property_id,block_id) REFERENCES community_blocks(workspace_id,property_id,id),
 CHECK(floor BETWEEN -5 AND 150)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;
CREATE TABLE IF NOT EXISTS community_block_layouts (
 id VARCHAR(100) NOT NULL, workspace_id VARCHAR(200) NOT NULL, property_id VARCHAR(200) NOT NULL,
 revision BIGINT NOT NULL, created_at VARCHAR(40) NOT NULL, block_id VARCHAR(100) NOT NULL, floor INTEGER NOT NULL,
 name VARCHAR(200) NOT NULL, draft_json TEXT NOT NULL, published_json TEXT NOT NULL, published_at VARCHAR(40),
 PRIMARY KEY(workspace_id,id), UNIQUE(workspace_id,property_id,id), UNIQUE(workspace_id,property_id,block_id,floor),
 FOREIGN KEY(workspace_id,property_id,block_id) REFERENCES community_blocks(workspace_id,property_id,id),
 CHECK(floor BETWEEN -5 AND 150)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;
CREATE TABLE IF NOT EXISTS community_deliveries (
 id VARCHAR(100) NOT NULL, workspace_id VARCHAR(200) NOT NULL, property_id VARCHAR(200) NOT NULL,
 revision BIGINT NOT NULL, created_at VARCHAR(40) NOT NULL, user_id VARCHAR(200) NOT NULL,
 seller_id VARCHAR(100), unit_id VARCHAR(300), name VARCHAR(200) NOT NULL, reference VARCHAR(200) NOT NULL, notes TEXT NOT NULL,
 packages INTEGER NOT NULL, bulk INTEGER NOT NULL, expected_at VARCHAR(40) NOT NULL,
 approval TEXT NOT NULL, status TEXT NOT NULL, accepted_at VARCHAR(40), received_at VARCHAR(40),
 PRIMARY KEY(workspace_id,id), UNIQUE(workspace_id,property_id,id),
 FOREIGN KEY(workspace_id,property_id) REFERENCES properties(workspace_id,id),
 FOREIGN KEY(workspace_id,property_id,seller_id) REFERENCES community_sellers(workspace_id,property_id,id),
 FOREIGN KEY(workspace_id,property_id,unit_id) REFERENCES property_units(workspace_id,property_id,id),
 CHECK(packages BETWEEN 1 AND 10000), CHECK(bulk IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;
