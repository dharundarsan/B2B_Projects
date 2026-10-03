import test from "node:test";
import assert from "node:assert/strict";
import { residentLinkPayload, readResidentDraft, saveResidentDraft, clearResidentDraft, residentUnitChoice } from "../src/features/residentPrivacy.ts";

const user = "11111111-1111-4111-8111-111111111111", occupancy = "22222222-2222-4222-8222-222222222222";
const draft = { propertyId: "p", category: "Plumbing", description: "Private report", unit: "204", resident: "Resident",
  permission: "Contact first", availability: "Flexible", notes: "Private access note", flowing: "No", nearElectricity: "No", sparks: "No", step: 2 };
test("unlinked intake omits previously entered account identifiers", () => {
  assert.deepEqual(residentLinkPayload(false, user, occupancy), {});
});
test("explicit linkage requires both non-empty UUIDs, never a name or email", () => {
  for (const [account, period] of [[user, ""], ["", occupancy], ["resident@example.test", occupancy], [user, "00000000-0000-0000-0000-000000000000"]])
    assert.throws(() => residentLinkPayload(true, account, period));
  assert.deepEqual(residentLinkPayload(true, ` ${user.toUpperCase()} `, occupancy), { residentUserId: user, residentOccupancyId: occupancy });
});
test("drafts belong only to the signed-in account", () => {
  clearResidentDraft(); saveResidentDraft(user, draft);
  assert.equal(readResidentDraft("another-resident"), null);
  assert.equal(readResidentDraft(user).notes, draft.notes);
  clearResidentDraft(); assert.equal(readResidentDraft(user), null);
});
test("saving and reading drafts cannot share mutable objects", () => {
  clearResidentDraft(); const source = { ...draft }; saveResidentDraft(user, source);
  source.notes = "Changed outside cache"; const loaded = readResidentDraft(user);
  assert.equal(loaded.notes, draft.notes); loaded.notes = "Changed after loading";
  assert.equal(readResidentDraft(user).notes, draft.notes); clearResidentDraft();
});
test("anonymous callers cannot save a draft", () => assert.throws(() => saveResidentDraft("", draft)));

test("apartment loading preserves a restored draft and never substitutes another building's units", () => {
  assert.equal(residentUnitChoice("4A", "", "", [], false, ""), "4A");
  assert.equal(residentUnitChoice("4A", "p1", "", [], false, ""), "4A");
  assert.equal(residentUnitChoice("4A", "p1", "p1", [], true, ""), "4A");
  assert.equal(residentUnitChoice("4A", "p1", "p1", ["3B", "4A"], false, ""), "4A");
  assert.equal(residentUnitChoice("", "p2", "p1", ["3B"], false, ""), "");
  assert.equal(residentUnitChoice("4A", "p1", "p1", [], false, "Network error"), "4A");
  assert.equal(residentUnitChoice("4A", "p1", "p1", [], false, ""), "");
});
