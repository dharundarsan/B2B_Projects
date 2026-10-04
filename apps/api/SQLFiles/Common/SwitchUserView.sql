UPDATE users SET user_context=@context,revision=revision+1
WHERE workspace_id=@workspace AND user_id=@user AND revision=@revision;
