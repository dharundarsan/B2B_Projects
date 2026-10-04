UPDATE community_audit SET revision=@Revision,user_id=@UserId,entity_id=@EntityId,action=@Action WHERE workspace_id=@WorkspaceId AND property_id=@PropertyId AND id=@Id AND revision=@Revision-1;
