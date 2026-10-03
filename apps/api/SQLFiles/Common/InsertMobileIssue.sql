INSERT INTO common_area_issues(workspace_id,id,property_id,location,title,category,description,priority,status,reported_by,submission_id,created_at,updated_at,revision)
 VALUES(@WorkspaceId,@Id,@PropertyId,@Location,@Title,@Category,@Description,@Priority,@Status,@ReportedBy,@SubmissionId,@CreatedAt,@UpdatedAt,0);
