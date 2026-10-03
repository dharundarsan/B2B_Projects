import test from "node:test";
import assert from "node:assert/strict";
import {
  managerAction,
  residentAction,
  requestStatusLabel,
  matchesFilter,
  sortRequests,
  stageFor,
  nextStep,
  visitConfirmation,
  ageLabel,
  formatDate,
  propertyDateInput,
} from "../src/features/operations.ts";
import {
  approvedQuoteTotals,
  formatMoney,
  quoteCurrency,
} from "../src/features/money.ts";

const repair = (changes = {}) => ({
  id: "RL-test",
  title: "Leak",
  property: "Oak Street",
  propertyId: "oak",
  unit: "3B",
  resident: "Resident",
  category: "Plumbing",
  priority: "routine",
  state: "acknowledged",
  nextAction: "Review",
  dueLabel: "Not a timestamp",
  description: "A reported leak",
  access: "Resident home",
  language: "English",
  createdAt: "2026-10-01T10:00:00Z",
  timezone: "America/New_York",
  ...changes,
});
const estimate = (changes = {}) => ({
  id: "quote-1",
  version: 1,
  scope: "Replace fitting",
  labor: 80,
  parts: 20,
  tax: 0,
  total: 100,
  currency: "USD",
  status: "submitted",
  createdAt: "2026-10-01T10:00:00Z",
  ...changes,
});
const appointment = (changes = {}) => ({
  id: "visit-1",
  startsAt: "2026-10-02T16:00:00Z",
  endsAt: "2026-10-02T17:00:00Z",
  timezone: "America/New_York",
  status: "proposed",
  ...changes,
});

test("resident response list includes verification, not vendor work", () => {
  assert.equal(residentAction(repair({ state: "verification" })), "verify");
  assert.equal(residentAction(repair({ state: "completed" })), null);
  assert.equal(residentAction(repair({ state: "in_progress" })), null);
});
test("resident response list includes only their unconfirmed proposed visit", () => {
  assert.equal(
    residentAction(repair({ state: "scheduled", appointment: appointment() })),
    "confirm_visit",
  );
  assert.equal(
    residentAction(
      repair({
        state: "scheduled",
        appointment: appointment({
          residentConfirmedAt: "2026-10-01T10:00:00Z",
        }),
      }),
    ),
    null,
  );
});
test("confirmed or cancelled visits do not need a resident response", () => {
  for (const status of ["confirmed", "cancelled"])
    assert.equal(
      residentAction(
        repair({ state: "scheduled", appointment: appointment({ status }) }),
      ),
      null,
    );
});
test("terminal repairs exclude stale unconfirmed visits from the resident queue", () => {
  for (const state of ["closed", "cancelled"])
    assert.equal(
      residentAction(repair({ state, appointment: appointment() })),
      null,
    );
});

for (const state of [
  "closed",
  "cancelled",
  "completed",
  "verification",
  "invoice_review",
  "in_progress",
  "draft",
]) {
  test(`${state} never counts as a manager decision, even with an old submitted quote`, () =>
    assert.equal(
      managerAction(
        repair({ state, vendorDecision: "accepted", estimate: estimate() }),
      ),
      null,
    ));
}
for (const state of ["submitted", "urgent"]) {
  test(`${state} requires acknowledgment`, () =>
    assert.equal(managerAction(repair({ state })), "acknowledge"));
}
test("acknowledged repair with no quote needs a vendor", () =>
  assert.equal(managerAction(repair()), "assign"));
test("pending offer is vendor-owned, not a manager decision", () =>
  assert.equal(
    managerAction(
      repair({ vendorDecision: "pending", assignedVendorId: "vendor" }),
    ),
    null,
  ));
test("accepted job awaiting its first quote belongs to vendor", () =>
  assert.equal(
    managerAction(
      repair({ vendorDecision: "accepted", assignedVendorId: "vendor" }),
    ),
    null,
  ));
test("accepted submitted quote needs manager review", () =>
  assert.equal(
    managerAction(repair({ vendorDecision: "accepted", estimate: estimate() })),
    "review_quote",
  ));
test("unaccepted quote never authorizes review or reassignment", () =>
  assert.equal(
    managerAction(repair({ vendorDecision: "declined", estimate: estimate() })),
    null,
  ));
test("returned quote awaits revision, not manager approval", () =>
  assert.equal(
    managerAction(
      repair({
        vendorDecision: "accepted",
        estimate: estimate({ status: "changes_requested" }),
      }),
    ),
    null,
  ));
test("approved quote with no visit needs a proposal", () =>
  assert.equal(
    managerAction(
      repair({
        vendorDecision: "accepted",
        estimate: estimate({ status: "approved" }),
      }),
    ),
    "schedule",
  ));
test("cancelled visit needs rescheduling, not reassignment", () =>
  assert.equal(
    managerAction(
      repair({
        vendorDecision: "accepted",
        estimate: estimate({ status: "approved" }),
        appointment: appointment({ status: "cancelled" }),
      }),
    ),
    "schedule",
  ));
for (const status of ["proposed", "confirmed"]) {
  test(`${status} visit is not another manager schedule action`, () =>
    assert.equal(
      managerAction(
        repair({
          vendorDecision: "accepted",
          estimate: estimate({ status: "approved" }),
          appointment: appointment({ status }),
        }),
      ),
      null,
    ));
}
test("closed urgent repairs are not open emergencies", () =>
  assert.equal(
    matchesFilter(repair({ state: "closed", priority: "urgent" }), "urgent"),
    false,
  ));
test("cancelled urgent repairs are not open emergencies", () =>
  assert.equal(
    matchesFilter(repair({ state: "cancelled", priority: "urgent" }), "urgent"),
    false,
  ));
test("verification queue is distinct from closure", () => {
  for (const state of ["completed", "verification"]) {
    assert.equal(matchesFilter(repair({ state }), "verification"), true);
    assert.equal(matchesFilter(repair({ state }), "completed"), false);
  }
  assert.equal(matchesFilter(repair({ state: "closed" }), "completed"), true);
});
test("awaiting filter uses the same policy as the decision count", () => {
  const record = repair({ vendorDecision: "accepted", estimate: estimate() });
  assert.equal(
    matchesFilter(record, "awaiting"),
    managerAction(record) !== null,
  );
});
test("today's visits use the appointment's local calendar day", () => {
  const now = new Date("2026-10-02T01:00:00Z");
  const record = repair({
    state: "in_progress",
    appointment: appointment({
      status: "confirmed",
      startsAt: "2026-10-01T20:00:00Z",
    }),
  });
  assert.equal(matchesFilter(record, "today", now), true);
  assert.equal(
    matchesFilter(repair({ ...record, state: "closed" }), "today", now),
    false,
  );
});
test("proposed visits never count as confirmed today", () =>
  assert.equal(
    matchesFilter(
      repair({ state: "scheduled", appointment: appointment() }),
      "today",
      new Date("2026-10-02T18:00:00Z"),
    ),
    false,
  ));
test("unknown timezones do not crash the visit filter", () =>
  assert.equal(
    matchesFilter(
      repair({
        state: "scheduled",
        appointment: appointment({ status: "confirmed", timezone: "Bad/Zone" }),
      }),
      "today",
    ),
    false,
  ));
test("risk sorting excludes a terminal emergency and does not mutate source", () => {
  const records = [
    repair({ id: "closed", state: "closed", priority: "urgent" }),
    repair({ id: "routine" }),
    repair({ id: "urgent", priority: "urgent" }),
  ];
  const original = [...records];
  assert.deepEqual(
    sortRequests(records).map((r) => r.id),
    ["urgent", "routine", "closed"],
  );
  assert.deepEqual(records, original);
});
test("a scheduled state does not label a proposed visit as confirmed", () => {
  assert.equal(
    requestStatusLabel(
      repair({ state: "scheduled", appointment: appointment() }),
    ),
    "Visit proposed",
  );
  assert.equal(
    requestStatusLabel(
      repair({
        state: "scheduled",
        appointment: appointment({ status: "confirmed" }),
      }),
    ),
    "Visit confirmed",
  );
});
test("oldest/newest sorts use timestamps, not due text", () => {
  const records = [
    repair({ id: "new", createdAt: "2026-10-02T08:00:00Z" }),
    repair({ id: "old", createdAt: "2026-09-30T08:00:00Z" }),
    repair({ id: "bad", createdAt: "Unknown" }),
  ];
  assert.deepEqual(
    sortRequests(records, "oldest").map((r) => r.id),
    ["old", "new", "bad"],
  );
  assert.deepEqual(
    sortRequests(records, "newest").map((r) => r.id),
    ["new", "old", "bad"],
  );
});
test("unit sorting is numeric within a property", () =>
  assert.deepEqual(
    sortRequests(
      [repair({ id: "ten", unit: "10" }), repair({ id: "two", unit: "2" })],
      "property",
    ).map((r) => r.id),
    ["two", "ten"],
  ));
test("board separates repair work from resident verification", () => {
  assert.equal(stageFor(repair({ state: "in_progress" })), "work");
  assert.equal(stageFor(repair({ state: "verification" })), "verification");
});
test("quote decision deep links to costs", () =>
  assert.equal(
    nextStep(repair({ vendorDecision: "accepted", estimate: estimate() })).href,
    "/requests/RL-test?tab=costs",
  ));
test("next-step route encodes record identifiers", () =>
  assert.equal(
    nextStep(repair({ id: "x/y?z", state: "submitted" })).href,
    "/requests/x%2Fy%3Fz",
  ));
test("proposed confirmation names the party still pending", () => {
  const result = visitConfirmation(
    appointment({ residentConfirmedAt: "2026-10-01T08:00:00Z" }),
  );
  assert.equal(result.label, "Proposed · not booked");
  assert.match(result.summary, /vendor confirmation/);
  assert.equal(result.resident, "Confirmed");
  assert.equal(result.vendor, "Awaiting response");
});
test("proposed visit owner is only the vendor after the resident confirms", () => {
  assert.equal(
    nextStep(
      repair({
        state: "scheduled",
        vendorDecision: "accepted",
        appointment: appointment({
          residentConfirmedAt: "2026-10-01T08:00:00Z",
        }),
      }),
    ).owner,
    "Vendor",
  );
});
test("proposed visit owner is only the resident after the vendor confirms", () => {
  assert.equal(
    nextStep(
      repair({
        state: "scheduled",
        vendorDecision: "accepted",
        appointment: appointment({ vendorConfirmedAt: "2026-10-01T08:00:00Z" }),
      }),
    ).owner,
    "Resident",
  );
});
test("two recorded responses do not invent another confirmation action", () => {
  const step = nextStep(
    repair({
      state: "scheduled",
      vendorDecision: "accepted",
      appointment: appointment({
        vendorConfirmedAt: "2026-10-01T08:00:00Z",
        residentConfirmedAt: "2026-10-01T08:00:00Z",
      }),
    }),
  );
  assert.equal(step.owner, "None");
  assert.equal(step.title, "Refresh visit confirmation");
});
test("legacy completed work does not invite a resident write the API cannot accept", () => {
  const step = nextStep(repair({ state: "completed" }));
  assert.equal(step.owner, "Manager");
  assert.equal(step.title, "Prepare resident verification");
});
test("unresolved approved work has a specific vendor follow-up handoff", () => {
  assert.equal(
    nextStep(
      repair({
        state: "in_progress",
        residentVerification: { status: "unresolved", note: "Still leaking" },
      }),
    ).title,
    "Follow up on the unresolved issue",
  );
});
test("cancelled visit never shows current confirmation success", () => {
  const result = visitConfirmation(
    appointment({
      status: "cancelled",
      vendorConfirmedAt: "old",
      residentConfirmedAt: "old",
    }),
  );
  assert.equal(result.tone, "cancelled");
  assert.match(result.summary, /no longer booked/);
});
test("age is clamped for clock skew and handles missing dates", () => {
  assert.equal(
    ageLabel("2026-10-03T00:00:00Z", Date.parse("2026-10-02T00:00:00Z")),
    "Reported today",
  );
  assert.equal(ageLabel("Not a date"), "Date unavailable");
});
test("property date input follows the local date, not UTC", () =>
  assert.equal(
    propertyDateInput("America/New_York", new Date("2026-10-02T01:00:00Z")),
    "2026-10-01",
  ));
test("invalid display timezone falls back to explicitly labeled UTC", () =>
  assert.match(formatDate("2026-10-01T10:00:00Z", "Bad/Zone"), /UTC$/));
test("empty quotes do not throw or invent an amount", () =>
  assert.deepEqual(approvedQuoteTotals([repair({ estimates: [] })]), []));
test("approved totals keep currencies separate", () => {
  const records = [
    repair({
      estimate: estimate({ status: "approved", total: 100, currency: "USD" }),
    }),
    repair({
      estimate: estimate({ status: "approved", total: 5000, currency: "INR" }),
    }),
  ];
  assert.deepEqual(approvedQuoteTotals(records), [
    { currency: "INR", amount: 5000 },
    { currency: "USD", amount: 100 },
  ]);
});
test("only latest authorization counts; cancelled quote values are excluded", () => {
  const previous = estimate({ version: 1, total: 100, status: "approved" });
  const latest = estimate({
    id: "v2",
    version: 2,
    total: 150,
    status: "approved",
  });
  assert.deepEqual(
    approvedQuoteTotals([
      repair({ estimates: [previous, latest] }),
      repair({ state: "cancelled", estimate: previous }),
    ]),
    [{ currency: "USD", amount: 150 }],
  );
});
test("quote totals sum integer cents rather than floating point residue", () =>
  assert.equal(
    approvedQuoteTotals([
      repair({ estimate: estimate({ total: 0.1, status: "approved" }) }),
      repair({ estimate: estimate({ total: 0.2, status: "approved" }) }),
    ])[0].amount,
    0.3,
  ));
test("currency formatting preserves a provided code and supports legacy USD", () => {
  assert.equal(quoteCurrency(undefined), "USD");
  assert.equal(quoteCurrency("INR"), "INR");
  assert.match(formatMoney(100, "INR"), /₹/);
  assert.equal(formatMoney(100), "$100.00");
});
