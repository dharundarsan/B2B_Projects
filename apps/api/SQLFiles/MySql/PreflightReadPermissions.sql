-- Validate SELECT privileges without reading a single customer row.
SELECT workspaces.*, properties.*, property_units.*, requests.*, request_locations.*, vendors.*, vendor_offers.*,
 events.*, estimates.*, appointments.*, evidence.*, messages.*, request_verifications.*, notifications.*, notification_reads.*,
 gate_presence.*, common_area_issues.*, common_area_issue_events.*
FROM workspaces, properties, property_units, requests, request_locations, vendors, vendor_offers,
 events, estimates, appointments, evidence, messages, request_verifications, notifications, notification_reads,
 gate_presence, common_area_issues, common_area_issue_events
WHERE 1=0
