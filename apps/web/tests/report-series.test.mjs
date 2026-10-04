import test from "node:test";
import assert from "node:assert/strict";
import { reportSeries } from "../src/features/community/reportSeries.ts";
test("chart values isolate currencies and aggregate cents by calendar month", () => {
  const data = {
    charges: [
      { currency: "INR", dueOn: "2026-10-05", amount: 0.1, verifiedPaid: 0.1 },
      { currency: "INR", dueOn: "2026-10-07", amount: 0.2, verifiedPaid: 0 },
      { currency: "USD", dueOn: "2026-10-01", amount: 900, verifiedPaid: 800 },
    ],
    expenses: [
      {
        currency: "INR",
        incurredOn: "2026-09-01",
        category: "Water",
        amount: 25.5,
      },
      {
        currency: "INR",
        incurredOn: "2026-10-03",
        category: "Water",
        amount: 10.5,
      },
      {
        currency: "USD",
        incurredOn: "2026-10-03",
        category: "Water",
        amount: 40,
      },
    ],
  };
  assert.deepEqual(reportSeries(data, "INR"), {
    months: [
      { month: "2026-09", billed: 0, paid: 0, expenses: 25.5 },
      { month: "2026-10", billed: 0.3, paid: 0.1, expenses: 10.5 },
    ],
    categories: [{ category: "Water", amount: 36 }],
  });
  assert.equal(reportSeries(data, "USD").months[0].paid, 800);
});
test("charts display the latest 12 recorded months in chronological order", () => {
  const data = {
    charges: Array.from({ length: 15 }, (_, i) => ({
      currency: "INR",
      dueOn: new Date(Date.UTC(2025, i, 5)).toISOString().slice(0, 10),
      amount: 1,
      verifiedPaid: 0,
    })).reverse(),
    expenses: [],
  };
  const series = reportSeries(data, "INR").months;
  assert.equal(series.length, 12);
  assert.equal(series[0].month, "2025-04");
  assert.equal(series.at(-1).month, "2026-03");
  assert.deepEqual(reportSeries({ charges: [], expenses: [] }, "INR"), {
    months: [],
    categories: [],
  });
});
