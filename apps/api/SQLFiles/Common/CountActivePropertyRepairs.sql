SELECT
 (SELECT COUNT(*) FROM requests WHERE workspace_id=@workspace AND property_id=@id AND state NOT IN ('closed','cancelled'))
 + (SELECT COUNT(*) FROM common_area_issues WHERE workspace_id=@workspace AND property_id=@id AND status<>'resolved')
 + (SELECT COUNT(*) FROM gate_presence g JOIN appointments a ON a.workspace_id=g.workspace_id AND a.id=g.appointment_id
     JOIN requests r ON r.workspace_id=a.workspace_id AND r.id=a.request_id
     WHERE g.workspace_id=@workspace AND r.property_id=@id AND g.departed_at IS NULL)
 + (SELECT COUNT(*) FROM community_agreements WHERE workspace_id=@workspace AND property_id=@id AND status='active' AND ends_on>@today)
 + (SELECT COUNT(*) FROM community_charges c WHERE c.workspace_id=@workspace AND c.property_id=@id
     AND c.amount>COALESCE((SELECT SUM(p.amount) FROM community_payments p WHERE p.workspace_id=c.workspace_id AND p.charge_id=c.id AND p.status='verified'),0))
 + (SELECT COUNT(*) FROM community_expenses WHERE workspace_id=@workspace AND property_id=@id AND paid_status='unpaid')
 + (SELECT COUNT(*) FROM community_orders WHERE workspace_id=@workspace AND property_id=@id AND (status NOT IN ('handed_over','cancelled') OR payment_status='refund_due'))
 + (SELECT COUNT(*) FROM community_service_requests WHERE workspace_id=@workspace AND property_id=@id AND status IN ('requested','accepted'))
 + (SELECT COUNT(*) FROM community_groups WHERE workspace_id=@workspace AND property_id=@id AND status='open')
 + (SELECT COUNT(*) FROM community_gate_entries WHERE workspace_id=@workspace AND property_id=@id AND (status IN ('arrived','accepted') OR (status='expected' AND approval<>'denied' AND expected_at>@now)))
 + (SELECT COUNT(*) FROM community_deliveries WHERE workspace_id=@workspace AND property_id=@id AND (status='accepted' OR status='expected' AND approval<>'denied'))
 + (SELECT COUNT(*) FROM community_bookings WHERE workspace_id=@workspace AND property_id=@id AND status='confirmed' AND ends_at>@now);
