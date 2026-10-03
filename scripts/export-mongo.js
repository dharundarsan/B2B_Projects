// Run with mongosh --quiet <connection-string> --file scripts/export-mongo.js
// Output is a canonical, insert-only C# importer snapshot, NOT a mongo Extended JSON dump.
// No database writes occur here.
const properties = db.repairproperties.find({}).toArray();
const vendors = db.repairvendors.find({}).toArray();
const requests = db.repairrequests.find({}).toArray();
const messages = db.repairmessages.find({}).toArray();
const notifications = db.repairnotifications.find({}).toArray();
const all = [...properties, ...vendors, ...requests, ...messages, ...notifications];
if (all.some((row) => !row.workspaceId)) throw new Error("Records without workspaceId require an explicit ownership migration first.");
const clean = (row, key) => {
  const result = { ...row, id: row[key] };
  delete result._id; delete result.__v; delete result.workspaceId; delete result[key]; delete result.updatedAt;
  return result;
};
const iso = (value, fallback) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(fallback).toISOString() : date.toISOString();
};
const workspaces = [...new Set(all.map((row) => row.workspaceId))].map((id) => {
  const ps = properties.filter((p) => p.workspaceId === id).map((p) => clean(p, "propertyId"));
  const rs = requests.filter((r) => r.workspaceId === id).map((r) => {
    const result = clean(r, "requestId");
    result.propertyId = r.propertyId || ps.find((p) => p.name === r.property)?.id;
    if (!result.propertyId) throw new Error(`Repair ${result.id} has no property record. Resolve it before migration.`);
    result.createdAt = iso(r.createdAt, new Date());
    delete result.createdAtLabel;
    result.timezone = r.timezone || ps.find((p) => p.id === result.propertyId).timezone || "UTC";
    result.revision = 0;
    result.estimates = [...new Map([...(r.estimates || []), ...(r.estimate ? [r.estimate] : [])].map((e) => [e.id, { ...e, createdAt: iso(e.createdAt, result.createdAt) }])).values()];
    result.appointments = [...new Map([...(r.appointments || []), ...(r.appointment ? [r.appointment] : [])].map((a, index) => [a.id, { ...a, createdAt: new Date(new Date(result.createdAt).getTime() + index).toISOString() }])).values()];
    // Scope event IDs to their request: old demo events reused "1", "2", etc.
    result.events = (r.events || []).map((e, index) => ({ ...e, id: `${result.id}-${e.id}`, at: iso(e.at, new Date(new Date(result.createdAt).getTime() + index)), detail: `${e.detail || ""}${Number.isNaN(new Date(e.at).getTime()) ? ` [legacy time label: ${e.at}]` : ""}` }));
    delete result.estimate; delete result.appointment;
    return result;
  });
  return { id, properties: ps, vendors: vendors.filter((v) => v.workspaceId === id).map((v) => clean(v, "vendorId")), requests: rs,
    messages: messages.filter((m) => m.workspaceId === id).map((m) => ({ ...clean(m, "messageId"), at: iso(m.at, m.createdAt) })),
    notifications: notifications.filter((n) => n.workspaceId === id).map((n) => ({ ...clean(n, "notificationId"), at: iso(n.at, n.createdAt) })) };
});
print(JSON.stringify({ workspaces }));
