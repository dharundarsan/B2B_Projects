INSERT INTO users(workspace_id,user_id,user_context,display_name,email,identity_role,allow_admin,allow_seller,created_at)
VALUES (@workspace,@user,@context,@name,@email,@role,@admin,@admin,@at)
ON CONFLICT(workspace_id,user_id) DO UPDATE SET email=excluded.email,identity_role=excluded.identity_role,display_name=CASE WHEN users.display_name='' THEN excluded.display_name ELSE users.display_name END;
