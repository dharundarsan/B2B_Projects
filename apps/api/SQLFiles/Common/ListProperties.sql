SELECT p.*, (SELECT COUNT(*) FROM requests r WHERE r.workspace_id=p.workspace_id AND r.property_id=p.id AND r.state NOT IN ('closed','cancelled')) AS open_requests,
            (SELECT COUNT(*) FROM requests r WHERE r.workspace_id=p.workspace_id AND r.property_id=p.id AND r.priority='urgent' AND r.state NOT IN ('closed','cancelled')) AS urgent_requests
            FROM properties p WHERE {Scope} ORDER BY p.name
