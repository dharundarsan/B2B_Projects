INSERT INTO vendor_offers(workspace_id,id,request_id,vendor_id,`sequence`,status,offered_at,responded_at,offered_by,response_by,note,response_note,legacy_snapshot)
VALUES(@workspace,@Id,@request,@VendorId,@Sequence,@Status,@OfferedAt,@RespondedAt,@OfferedBy,@ResponseBy,@Note,@ResponseNote,@legacy)
