INSERT INTO request_verifications(workspace_id,id,request_id,revision,status,note,actor_id,recorded_at,legacy_snapshot)
VALUES(@workspace,@Id,@request,@Revision,@Status,@Note,@ActorId,@RecordedAt,@legacy)
