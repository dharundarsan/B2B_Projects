SELECT a.id,r.property_id,p.name AS property_name,r.unit,v.name AS vendor_name,v.trade,
 a.starts_at,a.ends_at,a.timezone,g.arrived_at,g.departed_at,COALESCE(g.revision,0) AS revision,
 a.status AS appointment_status,r.state AS repair_state,r.vendor_decision
FROM appointments a
JOIN requests r ON r.workspace_id=a.workspace_id AND r.id=a.request_id
JOIN properties p ON p.workspace_id=r.workspace_id AND p.id=r.property_id
JOIN vendors v ON v.workspace_id=r.workspace_id AND v.id=r.assigned_vendor_id
LEFT JOIN gate_presence g ON g.workspace_id=a.workspace_id AND g.appointment_id=a.id
WHERE a.workspace_id=@workspace AND ({PropertyScope})
 AND ((p.archived=0 AND a.status='confirmed' AND a.resident_confirmed_at IS NOT NULL AND a.vendor_confirmed_at IS NOT NULL
       AND r.vendor_decision='accepted' AND r.state NOT IN ('verification','completed','closed','cancelled','invoice_review'))
      OR (g.arrived_at IS NOT NULL AND g.departed_at IS NULL))
 {VisitFilter}
ORDER BY a.starts_at,a.id;
