import test from "node:test";
import assert from "node:assert/strict";
import {
  managementModules,
  moduleUrl,
  defaultSection,
  financialSummary,
  financialCsv,
  deliveryTasks,
  localDateTime,
  dateTimeInstant,
} from "../src/features/community/management.ts";

test("delivery tasks respect property-local day and recipient responsibilities", () => {
  const data={property:{timezone:"Asia/Kolkata"},userId:"me",canManage:false,canGate:true,deliveries:[
    {id:"today",userId:"other",status:"expected",approval:"approved",expectedAt:"2026-10-04T22:00:00Z"},
    {id:"yesterday",userId:"other",status:"expected",approval:"approved",expectedAt:"2026-10-04T12:00:00Z"},
    {id:"bulk",userId:"other",status:"expected",approval:"pending",expectedAt:"2026-10-04T22:00:00Z"},
    {id:"mine",userId:"me",status:"accepted",approval:"approved"},
    {id:"other",userId:"other",status:"accepted",approval:"approved"}
  ]};
  const now=new Date("2026-10-05T00:00:00Z");
  assert.deepEqual(deliveryTasks(data,now).map(r=>r.id),["today"]);
  assert.deepEqual(deliveryTasks({...data,canManage:true},now).map(r=>r.id),["today","bulk"]);
  assert.deepEqual(deliveryTasks({...data,canGate:false},now).map(r=>r.id),["mine"]);
});

test("admin navigation connects community and maintenance in one workspace", () => {
  const modules = managementModules(2, "manager");
  for (const id of [
    "people",
    "buildings",
    "reports",
    "admin-center",
    "requests",
    "maintenance",
    "vendors",
  ])
    assert.ok(modules.some((m) => m.id === id));
  assert.equal(defaultSection(2), "admin-center");
  assert.equal(
    moduleUrl(
      modules.find((m) => m.id === "buildings"),
      2,
      "oak street",
    ),
    "/properties?property=oak+street",
  );
});
test("resident and member menus omit every administrator module", () => {
  for (const role of [
    "member",
    "tenant",
    "unit_owner",
    "operator",
    "manager",
    "owner",
    "demo",
  ]) {
    const modules = managementModules(1, role);
    assert.ok(modules.some((m) => m.id === "market"));
    for (const id of [
      "people",
      "admin-center",
      "reports",
      "buildings",
      "settings",
      "requests",
    ])
      assert.ok(!modules.some((m) => m.id === id));
    assert.ok(
      modules.every((m) => !moduleUrl(m, 1, "oak").startsWith("/admin")),
    );
  }
  assert.ok(managementModules(1, "tenant").some((m) => m.path === "/tenant"));
});
test("seller and watchman navigation reflects their scoped work", () => {
  assert.deepEqual(
    managementModules(3, "manager").map((m) => m.id),
    ["overview", "actions", "market", "orders", "services", "gate", "groups"],
  );
  assert.deepEqual(
    managementModules(1, "watchman").map((m) => m.id),
    ["overview", "actions", "gate", "community", "map"],
  );
});
test("module links preserve the building and encode product searches", () => {
  const market = managementModules(1, "member").find((m) => m.id === "market");
  const link = new URL(
    moduleUrl(market, 1, "oak&west", "Rice & grains"),
    "http://localhost",
  );
  assert.equal(link.pathname, "/home");
  assert.equal(link.searchParams.get("property"), "oak&west");
  assert.equal(link.searchParams.get("section"), "market");
  assert.equal(link.searchParams.get("query"), "Rice & grains");
});
test("financial reports isolate currencies and use verified collections", () => {
  const data = {
    charges: [
      { currency: "INR", amount: 1000, verifiedPaid: 300 },
      { currency: "INR", amount: 500, verifiedPaid: 0 },
      { currency: "USD", amount: 200, verifiedPaid: 200 },
    ],
    expenses: [
      { currency: "INR", amount: 125, paidStatus: "unpaid" },
      { currency: "INR", amount: 75, paidStatus: "paid" },
      { currency: "EUR", amount: 20, paidStatus: "unpaid" },
    ],
  };
  assert.deepEqual(financialSummary(data), [
    {
      currency: "INR",
      billed: 1500,
      paid: 300,
      outstanding: 1200,
      expenses: 200,
      unpaidExpenses: 125,
    },
    {
      currency: "USD",
      billed: 200,
      paid: 200,
      outstanding: 0,
      expenses: 0,
      unpaidExpenses: 0,
    },
    {
      currency: "EUR",
      billed: 0,
      paid: 0,
      outstanding: 0,
      expenses: 20,
      unpaidExpenses: 20,
    },
  ]);
  assert.deepEqual(financialSummary({ charges: [], expenses: [] }), []);
});
test("occupancy controls retain the correct instant across timezone conversion", () => {
  const instant = "2026-10-05T09:30:00.000Z";
  assert.equal(dateTimeInstant(localDateTime(instant)), instant);
  assert.equal(localDateTime(null), "");
  assert.equal(localDateTime("bad date"), "");
  assert.equal(dateTimeInstant(""), null);
});
test("financial report totals do not retain fractional cent residue", () => {
  assert.deepEqual(
    financialSummary({
      charges: [
        { currency: "INR", amount: 0.1, verifiedPaid: 0.1 },
        { currency: "INR", amount: 0.2, verifiedPaid: 0 },
      ],
      expenses: [],
    })[0],
    {
      currency: "INR",
      billed: 0.3,
      paid: 0.1,
      outstanding: 0.2,
      expenses: 0,
      unpaidExpenses: 0,
    },
  );
});

test("CSV exports use the same currency-separated financial totals", () => {
  const csv = financialCsv({
    charges: [{ currency: "INR", amount: 1500, verifiedPaid: 300 }],
    expenses: [{ currency: "USD", amount: 20, paidStatus: "unpaid" }],
  });
  assert.deepEqual(csv.split("\r\n"), [
    "Currency,Billed including deposits,Verified collections,Outstanding,Expenses,Unpaid expenses",
    "INR,1500,300,1200,0,0",
    "USD,0,0,0,20,20",
  ]);
});
