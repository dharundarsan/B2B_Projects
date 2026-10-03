const uuid = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i;
const emptyUuid = "00000000-0000-0000-0000-000000000000";

export function residentLinkPayload(enabled: boolean, userId: string, occupancyId: string) {
  if (!enabled) return {};
  const residentUserId = userId.trim().toLowerCase();
  const residentOccupancyId = occupancyId.trim().toLowerCase();
  if (![residentUserId, residentOccupancyId].every(value => uuid.test(value) && value !== emptyUuid)) {
    throw new Error("Enter both the provisioned resident account UUID and its occupancy UUID. Names and emails cannot link private history.");
  }
  return { residentUserId, residentOccupancyId };
}

export interface ResidentDraft {
  propertyId: string; category: string; description: string; unit: string; resident: string;
  permission: string; availability: string; notes: string; flowing: string; nearElectricity: string; sparks: string; step: number;
}
let draft: { accountId: string; value: ResidentDraft } | null = null;

// One signed-in tab only. Never put private report/access notes in browser persistence.
export function saveResidentDraft(accountId: string, value: ResidentDraft) {
  if (!accountId) throw new Error("Sign in before saving a draft.");
  draft = { accountId, value: structuredClone(value) };
}
export function readResidentDraft(accountId: string): ResidentDraft | null {
  return draft?.accountId === accountId ? structuredClone(draft.value) : null;
}
export function clearResidentDraft() { draft = null; }

export function residentUnitChoice(current: string, propertyId: string, loadedPropertyId: string, units: readonly string[], loading: boolean, error: string) {
  if (!propertyId || propertyId !== loadedPropertyId || loading || error) return current;
  return units.includes(current) ? current : units[0] ?? "";
}
