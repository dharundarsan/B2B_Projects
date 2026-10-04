SELECT id,name,address,timezone,units FROM properties WHERE workspace_id=@workspace AND archived=0 ORDER BY name;
SELECT DISTINCT p.property_id FROM community_parties p WHERE p.workspace_id=@workspace AND p.user_id=@user AND
 (EXISTS (SELECT 1 FROM community_ownerships o WHERE o.workspace_id=p.workspace_id AND o.party_id=p.id) OR
 EXISTS (SELECT 1 FROM community_agreements a WHERE a.workspace_id=p.workspace_id AND (a.debtor_party_id=p.id OR a.creditor_party_id=p.id) AND a.status='active'));
