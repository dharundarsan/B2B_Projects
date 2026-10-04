UPDATE community_blocks SET name=@Name,revision=@Revision WHERE workspace_id=@WorkspaceId AND property_id=@PropertyId AND id=@Id AND revision=@Revision-1;
