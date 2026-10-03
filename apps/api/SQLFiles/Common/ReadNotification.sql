INSERT INTO notification_reads(workspace_id,notification_id,user_id,read_at)
SELECT workspace_id,id,@user,@at FROM notifications WHERE workspace_id=@workspace AND id=@id
ON CONFLICT(workspace_id,notification_id,user_id) DO UPDATE SET read_at=excluded.read_at
