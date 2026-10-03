import type { api } from './api';
import type { ApartmentInput, CommonInput, CommonIssue, GateVisit, Message, MobileContext, MobileRole, Repair } from '../types';
function copyRepair(value: Repair): Repair { return JSON.parse(JSON.stringify(value)); }

export function createPreviewClient(role: MobileRole): typeof api {
  let sequence = 10;
  const now = () => new Date().toISOString();
  const id = () => 'preview-' + (++sequence);
  const start = new Date(Date.now() + 30 * 60000);
  if (role === 'watchman' && start.toDateString() !== new Date().toDateString()) start.setTime(Date.now());
  const end = new Date(start.getTime() + 3600000).toISOString();
  const context: MobileContext = { role, email: role === 'tenant' ? 'resident@example.test' : 'watchman@example.test',
    properties: [{ id: 'p1', name: 'Maple Residency', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, units: role === 'tenant' ? ['A-204'] : [] }] };
  const base: Repair = { id: 'r1', revision: 0, title: 'Kitchen tap is leaking', property: 'Maple Residency', propertyId: 'p1', unit: 'A-204', category: 'Plumbing', priority: 'routine',
    state: 'scheduled', description: 'Water drips even when the kitchen tap is turned off.', createdAt: now(), nextAction: 'Confirm the proposed visit', timezone: context.properties[0]!.timezone,
    access: 'Resident must be home', appointments: [{ id: 'a1', startsAt: start.toISOString(), endsAt: end, timezone: context.properties[0]!.timezone, status: 'proposed', vendorConfirmedAt: now() }], evidence: [],
    events: [{ id: 'e1', label: 'Report received', detail: 'Your manager is coordinating the repair.', at: now() }] };
  const repairs: Repair[] = [base,
    { ...copyRepair(base), id: 'r2', title: 'Bedroom switch not working', description: 'The bedroom light switch does not respond.', category: 'Electrical', state: 'verification', nextAction: 'Resident verifies repair', appointments: [], residentVerification: { status: 'pending' } },
    { ...copyRepair(base), id: 'r3', title: 'Bathroom drain cleared', description: 'The bathroom drain was blocked. The repair has been verified.', state: 'closed', nextAction: 'No further action', appointments: [], residentVerification: { status: 'verified' } }];
  const visits: GateVisit[] = [{ id: 'v1', propertyId: 'p1', propertyName: 'Maple Residency', unit: 'A-204', vendorName: 'ClearFlow Services', trade: 'Plumbing', startsAt: start.toISOString(), endsAt: end, timezone: base.timezone, revision: 0 },
    { id: 'v2', propertyId: 'p1', propertyName: 'Maple Residency', unit: 'B-105', vendorName: 'Bright Electric', trade: 'Electrical', startsAt: start.toISOString(), endsAt: end, timezone: base.timezone, arrivedAt: now(), revision: 1 }];
  const issues: CommonIssue[] = [{ id: 'i1', propertyId: 'p1', propertyName: 'Maple Residency', title: 'Corridor light is flickering', location: 'Block A · second-floor corridor', category: 'Electrical', description: 'The light near the stairs flickers at night.', priority: 'routine', status: 'in_progress', resolutionNote: 'Electrician assigned. Please use the lift lobby route until the light is fixed.', createdAt: now(), updatedAt: now(), revision: 1 }];
  const messages: Record<string, Message[]> = { r1: [{ id: 'm1', sender: 'Apartment manager', role: 'manager', body: 'A plumber visit has been proposed. Please confirm if you will be home at the time shown on the visit card.', at: now() }] };
  const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
  const event = (r: Repair, label: string, detail: string) => r.events.push({ id: id(), label, detail, at: now() });
  const requireResident = () => { if (role !== 'tenant') throw new Error('Resident access required.'); };
  const repair = (key: string) => { requireResident(); const value = repairs.find(r => r.id === key); if (!value) throw new Error('Repair not found.'); return value; };
  return {
    context: async () => copy(context), repairs: async () => { requireResident(); return copy(repairs); }, repair: async key => copy(repair(key)),
    create: async (input: ApartmentInput) => { requireResident(); const value = { ...copy(base), ...input, id: id(), revision: 0, state: input.priority === 'urgent' ? 'urgent' : 'submitted', appointments: [], evidence: [], nextAction: 'Manager reviews your report', createdAt: now(), events: [{ id: id(), label: 'Report received', detail: 'Local preview only', at: now() }] }; repairs.unshift(value); return copy(value); },
    confirm: async (value, key, confirmed) => { const r = repair(value.id); if (r.revision !== value.revision) throw new Error('Repair changed. Refresh first.'); const a = r.appointments.find(a => a.id === key); if (!a || a.status !== 'proposed' || a.residentConfirmedAt) throw new Error('This visit cannot be confirmed again.'); if (!confirmed) { a.status = 'cancelled'; r.state = 'assigned'; r.nextAction = 'Manager proposes another visit'; } else { a.residentConfirmedAt = now(); if (a.vendorConfirmedAt) a.status = 'confirmed'; r.nextAction = 'Vendor attends confirmed visit'; } event(r, confirmed ? 'Resident confirmed visit' : 'Resident declined visit', a.startsAt); r.revision++; return copy(r); },
    verify: async (value, fixed, note) => { const r = repair(value.id); if (r.state !== 'verification' || r.revision !== value.revision) throw new Error('Refresh before verifying.'); r.state = fixed ? 'closed' : 'in_progress'; r.residentVerification = { status: fixed ? 'verified' : 'unresolved', note }; r.nextAction = fixed ? 'No further action' : 'Vendor follows up on unresolved issue'; event(r, fixed ? 'Resident verified repair' : 'Resident reported unresolved issue', note); r.revision++; return copy(r); },
    messages: async key => { repair(key); return copy(messages[key] ?? []); },
    send: async (key, body) => { const r = repair(key); const m: Message = { id: id(), sender: context.email, role: 'resident', body, at: now() }; (messages[key] ??= []).push(m); r.revision++; return copy(m); },
    visits: async () => { if (role !== 'watchman') throw new Error('Watchman access required.'); return copy(visits); },
    presence: async (value, action) => { if (role !== 'watchman') throw new Error('Watchman access required.'); const v = visits.find(v => v.id === value.id); if (!v || v.revision !== value.revision) throw new Error('Visit changed. Refresh first.'); if (action === 'arrive' && !v.arrivedAt) v.arrivedAt = now(); else if (action === 'depart' && v.arrivedAt && !v.departedAt) v.departedAt = now(); else throw new Error('Invalid gate action.'); v.revision++; return copy(v); },
    issues: async () => copy(issues),
    reportCommon: async (input: CommonInput) => { const value: CommonIssue = { ...input, id: id(), propertyName: 'Maple Residency', status: 'reported', createdAt: now(), updatedAt: now(), revision: 0 }; issues.unshift(value); return copy(value); },
    uploadUrl: async () => { throw new Error('Private uploads need a configured account.'); }, completeUpload: async () => { throw new Error('Not available in local preview.'); }, evidenceUrl: async () => { throw new Error('No uploaded photos in local preview.'); }
  };
}
