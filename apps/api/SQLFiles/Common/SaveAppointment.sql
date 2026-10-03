INSERT INTO appointments(workspace_id,request_id,id,starts_at,ends_at,timezone,status,resident_confirmed_at,vendor_confirmed_at,created_at)
            VALUES(@workspace,@request,@Id,@StartsAt,@EndsAt,@Timezone,@Status,@ResidentConfirmedAt,@VendorConfirmedAt,@CreatedAt)
            ON CONFLICT(workspace_id,id) DO UPDATE SET status=excluded.status,resident_confirmed_at=excluded.resident_confirmed_at,vendor_confirmed_at=excluded.vendor_confirmed_at
