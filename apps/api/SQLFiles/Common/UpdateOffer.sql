UPDATE vendor_offers SET status=@Status,responded_at=@RespondedAt,response_by=@ResponseBy,response_note=@ResponseNote WHERE workspace_id=@workspace AND request_id=@request AND id=@Id
