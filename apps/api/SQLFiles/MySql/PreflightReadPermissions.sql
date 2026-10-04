-- Validate SELECT privileges without reading a single customer row.
SELECT workspaces.*, properties.*, property_units.*, requests.*, request_locations.*, vendors.*, vendor_offers.*,
 events.*, estimates.*, appointments.*, evidence.*, messages.*, request_verifications.*, notifications.*, notification_reads.*,
 gate_presence.*, common_area_issues.*, common_area_issue_events.*
FROM workspaces, properties, property_units, requests, request_locations, vendors, vendor_offers,
 events, estimates, appointments, evidence, messages, request_verifications, notifications, notification_reads,
 gate_presence, common_area_issues, common_area_issue_events
WHERE 1=0;
-- Community v6
SELECT * FROM users WHERE 1=0;
SELECT * FROM user_memberships WHERE 1=0;
SELECT * FROM user_admin_audit WHERE 1=0;
SELECT * FROM community_services WHERE 1=0;
SELECT * FROM community_service_requests WHERE 1=0;
SELECT * FROM community_parties WHERE 1=0;
SELECT * FROM community_ownerships WHERE 1=0;
SELECT * FROM community_agreements WHERE 1=0;
SELECT * FROM community_charges WHERE 1=0;
SELECT * FROM community_payments WHERE 1=0;
SELECT * FROM community_expenses WHERE 1=0;
SELECT * FROM community_sellers WHERE 1=0;
SELECT * FROM community_products WHERE 1=0;
SELECT * FROM community_orders WHERE 1=0;
SELECT * FROM community_groups WHERE 1=0;
SELECT * FROM community_pledges WHERE 1=0;
SELECT * FROM community_gate_entries WHERE 1=0;
SELECT * FROM community_facilities WHERE 1=0;
SELECT * FROM community_bookings WHERE 1=0;
SELECT * FROM community_notes WHERE 1=0;
SELECT * FROM community_layouts WHERE 1=0;
SELECT * FROM community_audit WHERE 1=0;
SELECT * FROM community_receipts WHERE 1=0;
SELECT * FROM community_agreement_units WHERE 1=0;
SELECT * FROM community_expense_allocations WHERE 1=0;
-- Community structure and expected deliveries v9
SELECT * FROM community_blocks WHERE 1=0;
SELECT * FROM community_unit_locations WHERE 1=0;
SELECT * FROM community_block_layouts WHERE 1=0;
SELECT * FROM community_deliveries WHERE 1=0;
