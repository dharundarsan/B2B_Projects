INSERT INTO vendor_offers(workspace_id,id,request_id,vendor_id,sequence,status,offered_at,responded_at,offered_by,response_by,note,response_note,legacy_snapshot)
VALUES(@workspace,@Id,@request,@VendorId,@Sequence,@Status,@OfferedAt,@RespondedAt,@OfferedBy,@ResponseBy,@Note,@ResponseNote,@legacy)
ON CONFLICT(workspace_id,id) DO UPDATE SET status=excluded.status,responded_at=excluded.responded_at,response_by=excluded.response_by,response_note=excluded.response_note
