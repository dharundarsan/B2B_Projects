UPDATE requests SET resident_user_id=@ResidentUserId,resident_occupancy_id=@ResidentOccupancyId
WHERE workspace_id=@WorkspaceId AND id=@Id AND resident_user_id IS NULL AND resident_occupancy_id IS NULL;
