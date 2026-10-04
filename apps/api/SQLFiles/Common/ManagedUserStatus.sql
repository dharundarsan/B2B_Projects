UPDATE users SET status=@status,revision=revision+1 WHERE workspace_id=@workspace AND user_id=@user AND revision=@revision;
