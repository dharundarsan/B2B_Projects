UPDATE community_pledges SET revision=@Revision,group_id=@GroupId,user_id=@UserId,quantity=@Quantity WHERE workspace_id=@WorkspaceId AND property_id=@PropertyId AND id=@Id AND revision=@Revision-1;
