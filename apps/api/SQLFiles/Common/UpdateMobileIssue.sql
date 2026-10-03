UPDATE common_area_issues SET status=@Status,resolution_note=@Note,updated_by=@actor,updated_at=@at,revision=revision+1
 WHERE workspace_id=@workspace AND id=@id AND revision=@Revision AND status<>'resolved';
