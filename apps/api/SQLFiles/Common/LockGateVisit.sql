UPDATE requests SET revision=revision WHERE workspace_id=@workspace
 AND id IN (SELECT request_id FROM appointments WHERE workspace_id=@workspace AND id=@id);
