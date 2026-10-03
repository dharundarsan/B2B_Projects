UPDATE appointments SET status=@Status,resident_confirmed_at=@ResidentConfirmedAt,vendor_confirmed_at=@VendorConfirmedAt WHERE workspace_id=@workspace AND request_id=@request AND id=@Id
