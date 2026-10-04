SELECT u.*,CASE WHEN EXISTS(SELECT 1 FROM community_sellers s WHERE s.workspace_id=u.workspace_id AND s.user_id=u.user_id AND s.status!='rejected') THEN 1 ELSE 0 END AS has_store FROM users u WHERE u.workspace_id=@workspace ORDER BY display_name,email;
SELECT m.*,u.label AS unit_label FROM user_memberships m LEFT JOIN property_units u ON u.workspace_id=m.workspace_id AND u.property_id=m.property_id AND u.id=m.unit_id WHERE m.workspace_id=@workspace;
SELECT id,user_id,actor_id,action,created_at FROM user_admin_audit WHERE workspace_id=@workspace ORDER BY created_at DESC LIMIT 50;
