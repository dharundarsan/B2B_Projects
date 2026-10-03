SELECT
 (SELECT COUNT(*) FROM requests WHERE workspace_id=@workspace AND property_id=@id AND state NOT IN ('closed','cancelled'))
 + (SELECT COUNT(*) FROM common_area_issues WHERE workspace_id=@workspace AND property_id=@id AND status<>'resolved')
 + (SELECT COUNT(*) FROM gate_presence g JOIN appointments a ON a.workspace_id=g.workspace_id AND a.id=g.appointment_id
     JOIN requests r ON r.workspace_id=a.workspace_id AND r.id=a.request_id
     WHERE g.workspace_id=@workspace AND r.property_id=@id AND g.departed_at IS NULL);
