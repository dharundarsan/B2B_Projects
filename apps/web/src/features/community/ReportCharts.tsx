import { useState } from "react";
import type { CommunityData } from "../../../../../shared/community";
import { Card, None, amount } from "./ui";
import { reportSeries } from "./reportSeries";
export function ReportCharts({
  data,
  occupied,
}: {
  data: CommunityData;
  occupied: number;
}) {
  const currencies = [
    ...new Set([
      ...data.charges.map((c) => c.currency),
      ...data.expenses.map((e) => e.currency),
    ]),
  ];
  const [chosen, setChosen] = useState(currencies[0] ?? "INR");
  const currency = currencies.includes(chosen)
    ? chosen
    : (currencies[0] ?? "INR");
  const { months, categories } = reportSeries(data, currency);
  const max = Math.max(
    1,
    ...months.flatMap((m) => [m.billed, m.paid, m.expenses]),
  );
  const total = data.units.length,
    used = Math.min(total, occupied),
    percent = total ? Math.round((used / total) * 100) : 0;
  return (
    <>
      <div className="ch-chart-grid">
        <Card
          title="Flat occupancy"
          detail="Based on current active tenancies, including sublets. Each flat is counted once."
        >
          <div className="ch-donut-layout">
            <svg
              viewBox="0 0 160 160"
              role="img"
              aria-label={`${used} of ${total} registered flats have active tenancies`}
            >
              <circle
                cx="80"
                cy="80"
                r="58"
                fill="none"
                stroke="#eeeaf7"
                strokeWidth="18"
              />
              <circle
                cx="80"
                cy="80"
                r="58"
                fill="none"
                stroke="#7154db"
                strokeWidth="18"
                pathLength="100"
                strokeDasharray={`${percent} ${100 - percent}`}
                transform="rotate(-90 80 80)"
              />
              <text x="80" y="78" textAnchor="middle">
                {percent}%
              </text>
              <text
                className="ch-chart-small"
                x="80"
                y="98"
                textAnchor="middle"
              >
                occupied
              </text>
            </svg>
            <div>
              <p>
                <i className="ch-dot violet" />
                {used} with active tenancy
              </p>
              <p>
                <i className="ch-dot neutral" />
                {Math.max(0, total - used)} without active tenancy
              </p>
              <small>
                Vacant and owner-occupied flats may both lack a tenancy.
              </small>
            </div>
          </div>
        </Card>
        <Card
          title="Marketplace activity"
          detail="Orders and service requests across this community."
        >
          <div className="ch-horizontal-bars">
            {["placed", "accepted", "ready", "handed_over", "cancelled"].map(
              (status) => {
                const count = data.orders.filter(
                  (o) => o.status === status,
                ).length;
                return (
                  <div key={status}>
                    <span>{status.replaceAll("_", " ")}</span>
                    <progress
                      aria-label={`${status} orders`}
                      max={Math.max(1, data.orders.length)}
                      value={count}
                    />
                    <b>{count}</b>
                  </div>
                );
              },
            )}
          </div>
          <p>
            {
              data.serviceRequests.filter((r) => r.status === "requested")
                .length
            }{" "}
            service requests await response
          </p>
        </Card>
      </div>
      <Card
        title="Collections & spending"
        detail="Charges are grouped by due month, verified collections against those charges, and expenses by incurred month. Deposits are included; this is not a cash flow statement."
      >
        <label className="ch-chart-filter">
          Report currency
          <select value={currency} onChange={(e) => setChosen(e.target.value)}>
            {(currencies.length ? currencies : ["INR"]).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        {months.length ? (
          <>
            <div className="ch-chart-legend">
              <span>
                <i className="ch-dot violet" />
                Billed
              </span>
              <span>
                <i className="ch-dot mint" />
                Verified collections
              </span>
              <span>
                <i className="ch-dot amber" />
                Expenses
              </span>
            </div>
            <svg
              className="ch-bar-chart"
              viewBox="0 0 720 280"
              role="img"
              aria-label={`Monthly financial comparison in ${currency}. Exact values in the table below.`}
            >
              <text x="12" y="20" className="ch-chart-small">
                {amount(max, currency)}
              </text>
              {[0, 1, 2, 3].map((i) => (
                <line
                  key={i}
                  x1="65"
                  x2="710"
                  y1={35 + i * 60}
                  y2={35 + i * 60}
                  stroke="#eeeaf7"
                />
              ))}
              {months.map((m, i) => {
                const step = 635 / months.length;
                return (
                  <g key={m.month}>
                    {[m.billed, m.paid, m.expenses].map((n, j) => (
                      <rect
                        key={j}
                        x={70 + i * step + j * (step * 0.22)}
                        y={215 - (n / max) * 180}
                        height={(n / max) * 180}
                        width={step * 0.18}
                        rx="3"
                        fill={["#7154db", "#30ad8c", "#e5aa45"][j]}
                      >
                        <title>{`${m.month}: ${["Billed", "Verified collections", "Expenses"][j]} ${amount(n, currency)}`}</title>
                      </rect>
                    ))}
                    <text
                      x={70 + i * step + step * 0.25}
                      y="240"
                      textAnchor="middle"
                      className="ch-chart-small"
                    >
                      {m.month.slice(2)}
                    </text>
                  </g>
                );
              })}
            </svg>
            <details className="ch-chart-table">
              <summary>View exact monthly values</summary>
              <div className="ch-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Billed</th>
                      <th>Verified collections</th>
                      <th>Expenses</th>
                    </tr>
                  </thead>
                  <tbody>
                    {months.map((m) => (
                      <tr key={m.month}>
                        <th>{m.month}</th>
                        <td>{amount(m.billed, currency)}</td>
                        <td>{amount(m.paid, currency)}</td>
                        <td>{amount(m.expenses, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        ) : (
          <None>Add financial records to see monthly trends.</None>
        )}
        <h3>Expenses by category · {currency}</h3>
        <div className="ch-horizontal-bars">
          {categories.map((c) => (
            <div key={c.category}>
              <span>{c.category}</span>
              <progress
                aria-label={`${c.category} spending`}
                max={Math.max(1, ...categories.map((x) => x.amount))}
                value={c.amount}
              />
              <b>{amount(c.amount, currency)}</b>
            </div>
          ))}
        </div>
        {!categories.length && <None>No expenses for this currency.</None>}
      </Card>
    </>
  );
}
