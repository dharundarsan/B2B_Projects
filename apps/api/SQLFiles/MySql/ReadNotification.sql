INSERT INTO notification_reads(workspace_id,notification_id,user_id,read_at)
SELECT n.workspace_id,n.id,@user,@at FROM notifications n WHERE n.workspace_id=@workspace AND n.id=@id
ON DUPLICATE KEY UPDATE read_at=@at
