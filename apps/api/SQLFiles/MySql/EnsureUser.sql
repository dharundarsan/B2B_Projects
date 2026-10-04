INSERT INTO users(workspace_id,user_id,user_context,display_name,email,identity_role,allow_admin,allow_seller,created_at)
VALUES (@workspace,@user,@context,@name,@email,@role,@admin,@admin,@at)
ON DUPLICATE KEY UPDATE email=@email,identity_role=@role,display_name=IF(display_name='',@name,display_name);
