UPDATE community_parties SET revision=@Revision,name=@Name,kind=@Kind,user_id=@UserId WHERE workspace_id=@WorkspaceId AND property_id=@PropertyId AND id=@Id AND revision=@Revision-1;
