SELECT n.workspace_id,n.id,n.title,n.detail,n.type,n.href,n.at,
CASE WHEN n.`read`=1 OR EXISTS(SELECT 1 FROM notification_reads nr WHERE nr.workspace_id=n.workspace_id AND nr.notification_id=n.id AND nr.user_id=@user) THEN 1 ELSE 0 END AS `read`
FROM notifications n WHERE n.workspace_id=@workspace AND n.id=@id
