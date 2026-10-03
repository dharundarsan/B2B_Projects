UPDATE gate_presence SET departed_at=@at,departed_by=@actor,revision=revision+1
 WHERE workspace_id=@workspace AND appointment_id=@id AND revision=@Revision AND arrived_at IS NOT NULL AND departed_at IS NULL;
