SELECT r.*, l.unit_id FROM requests r LEFT JOIN request_locations l ON l.workspace_id=r.workspace_id AND l.request_id=r.id WHERE {Scope} ORDER BY r.created_at DESC,r.id;
SELECT * FROM events WHERE {ChildScope} ORDER BY at,id;
SELECT * FROM estimates WHERE {ChildScope} ORDER BY version;
SELECT * FROM appointments WHERE {ChildScope} ORDER BY created_at,id;
SELECT * FROM evidence WHERE {ChildScope} ORDER BY created_at,id;
SELECT * FROM vendor_offers WHERE {ChildScope} ORDER BY sequence;
SELECT * FROM request_verifications WHERE {ChildScope} ORDER BY revision;
