INSERT INTO appointments(workspace_id,request_id,id,starts_at,ends_at,timezone,status,resident_confirmed_at,vendor_confirmed_at,created_at)
            VALUES(@workspace,@request,@Id,@StartsAt,@EndsAt,@Timezone,@Status,@ResidentConfirmedAt,@VendorConfirmedAt,@CreatedAt)
