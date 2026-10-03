UPDATE requests SET revision=revision+1,state=@State,next_action=@NextAction,due_label=@DueLabel,
             assigned_vendor_id=@AssignedVendorId,assigned_vendor_name=@AssignedVendorName,vendor_decision=@VendorDecision,
             preferred_window=@PreferredWindow,verification_json=@VerificationJson,
             resident_user_id=@ResidentUserId,resident_occupancy_id=@ResidentOccupancyId
            WHERE workspace_id=@WorkspaceId AND id=@Id AND revision=@Revision
