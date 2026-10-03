SELECT i.*,p.name AS property_name FROM common_area_issues i
 JOIN properties p ON p.workspace_id=i.workspace_id AND p.id=i.property_id
 WHERE i.workspace_id=@workspace AND ({PropertyScope}) {IssueFilter} ORDER BY i.created_at DESC,i.id;
