SELECT i.*,p.name AS property_name FROM common_area_issues i
 JOIN properties p ON p.workspace_id=i.workspace_id AND p.id=i.property_id
 WHERE i.workspace_id=@WorkspaceId AND i.reported_by=@ReportedBy AND i.submission_id=@SubmissionId;
