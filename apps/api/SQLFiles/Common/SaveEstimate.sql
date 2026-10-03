INSERT INTO estimates(workspace_id,request_id,id,version,scope,labor,parts,tax,total,status,created_at,approved_at,approved_by,vendor_id,currency)
            VALUES(@workspace,@request,@Id,@Version,@Scope,@Labor,@Parts,@Tax,@Total,@Status,@CreatedAt,@ApprovedAt,@ApprovedBy,@VendorId,@Currency)
            ON CONFLICT(workspace_id,id) DO UPDATE SET status=excluded.status,approved_at=excluded.approved_at,approved_by=excluded.approved_by
