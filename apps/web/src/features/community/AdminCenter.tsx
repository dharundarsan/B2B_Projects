import { ReportCharts } from "./ReportCharts";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Search,
  Users,
  Building2,
  ShieldCheck,
} from "lucide-react";
import { useWorkspace } from "./WorkspaceContext";
import { ModuleIcon } from "./ModuleIcon";
import {
  moduleUrl,
  financialSummary,
  financialCsv,
  deliveryTasks,
} from "./management";
import { amount, Card, None, Status } from "./ui";
import type { CommunityData } from "../../../../../shared/community";
export function AdminCenter({ data }: { data: CommunityData }) {
  const { modules, selected } = useWorkspace();
  const [search, setSearch] = useState("");
  const tiles = modules.filter(
    (m) =>
      !["overview", "actions", "admin-center"].includes(m.id) &&
      `${m.title} ${m.description}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <div className="community-stack">
      <section className="ch-admin-banner">
        <div>
          <span className="ch-eyebrow">COMMUNITY ADMINISTRATION</span>
          <h2>Everything your apartment needs.</h2>
          <p>
            Set up your community, manage access and keep daily operations
            moving.
          </p>
        </div>
        <div className="ch-banner-stat">
          <Building2 size={21} />
          <strong>{data.units.length}</strong>
          <span>registered units</span>
        </div>
        <div className="ch-banner-stat">
          <ShieldCheck size={21} />
          <strong>
            {data.sellers.filter((s) => s.status === "approved").length}
          </strong>
          <span>approved stores</span>
        </div>
      </section>
      <div className="ch-section-heading">
        <div>
          <h2>Administration modules</h2>
          <p>Select a module to get started.</p>
        </div>
        <label className="ch-inline-search">
          <Search size={17} />
          <input
            aria-label="Filter administration modules"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a module…"
          />
        </label>
      </div>
      <div className="ch-module-grid">
        {tiles.map((m) => (
          <Link
            key={m.id}
            className="ch-module-card"
            to={moduleUrl(m, 2, selected)}
          >
            <div className={`ch-module-art ch-${m.color}`}>
              <ModuleIcon name={m.icon} size={46} />
              <span />
              <span />
            </div>
            <div className="ch-module-body">
              <span>{m.group}</span>
              <h3>
                {m.title}
                <ArrowUpRight size={17} />
              </h3>
              <p>{m.description}</p>
              <strong>
                Open module <ArrowUpRight size={14} />
              </strong>
            </div>
          </Link>
        ))}
      </div>
      {!tiles.length && <None>No modules match your search.</None>}
      <section className="ch-admin-footnote">
        <Users size={20} />
        <p>
          Accounts can have User and Seller views. Administrators have all three
          views. Manage access under{" "}
          <Link
            to={moduleUrl(modules.find((m) => m.id === "people")!, 2, selected)}
          >
            People & access
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
export function ActionCenter({
  data: d,
  mode,
}: {
  data: CommunityData;
  mode: 1 | 2 | 3;
}) {
  const { go } = useWorkspace();
  const [filter, setFilter] = useState("all");
  const tasks = [
    ...d.orders
      .filter((o) => ["placed", "accepted", "ready"].includes(o.status))
      .map((o) => ({
        id: o.id,
        title:
          d.products.find((p) => p.id === o.productId)?.name ?? "Product order",
        detail: `${o.quantity} items · ${amount(o.quantity * o.unitPrice, o.currency)}`,
        status: o.status,
        section: "orders",
        group: "Orders",
      })),
    ...d.serviceRequests
      .filter((r) => ["requested", "accepted"].includes(r.status))
      .map((r) => ({
        id: r.id,
        title: r.serviceName,
        detail: new Date(r.preferredAt).toLocaleString(),
        status: r.status,
        section: "services",
        group: "Services",
      })),
    ...deliveryTasks(d).map((r) => ({
      id: r.id,
      title: r.name,
      detail: `${r.packages} packages · ${r.destination ?? "Community gate"}`,
      status: r.approval === "pending" ? "pending" : r.status,
      section: "gate",
      group: "Deliveries",
    })),
    ...d.gateEntries
      .filter((g) => g.status === "expected" && g.approval === "pending")
      .map((g) => ({
        id: g.id,
        title: g.name,
        detail: g.kind + " · " + new Date(g.expectedAt).toLocaleString(),
        status: g.approval,
        section: "gate",
        group: "Gate",
      })),
    ...(mode === 2
      ? d.sellers
          .filter((s) => s.status === "pending")
          .map((s) => ({
            id: s.id,
            title: s.name,
            detail: "Store application awaiting approval",
            status: "pending",
            section: "market",
            group: "Approvals",
          }))
      : []),
    ...(mode === 2
      ? d.payments
          .filter((p) => p.status === "pending")
          .map((p) => ({
            id: p.id,
            title: "Rent payment to verify",
            detail:
              amount(
                p.amount,
                d.charges.find((c) => c.id === p.chargeId)?.currency ?? "INR",
              ) +
              " · " +
              p.reference,
            status: p.status,
            section: "finance",
            group: "Finance",
          }))
      : []),
    ...d.notes
      .filter((n) => n.kind === "round" && n.status === "open")
      .map((n) => ({
        id: n.id,
        title: n.title,
        detail: n.body,
        status: n.status,
        section: "community",
        group: "Rounds",
      })),
  ];
  const groups = [...new Set(tasks.map((t) => t.group))];
  return (
    <div className="community-stack">
      <div className="ch-action-summary">
        <ListLabel count={tasks.length} />
        <p>
          Your outstanding tasks in this building. Open an item to review and
          take action.
        </p>
      </div>
      <div
        className="ch-filter-tabs"
        role="group"
        aria-label="Action categories"
      >
        {["all", ...groups].map((g) => (
          <button
            key={g}
            className={filter === g ? "active" : ""}
            aria-pressed={filter === g}
            onClick={() => setFilter(g)}
          >
            {g === "all" ? "All tasks" : g}
            <span>
              {g === "all"
                ? tasks.length
                : tasks.filter((t) => t.group === g).length}
            </span>
          </button>
        ))}
      </div>
      <Card title="Your action queue">
        <div className="ch-task-list">
          {tasks
            .filter((t) => filter === "all" || filter === t.group)
            .map((t) => (
              <button
                key={t.id}
                onClick={() =>
                  go(
                    t.section === "orders" && mode !== 3 ? "market" : t.section,
                    t.section === "orders" && mode !== 3 ? "orders" : undefined,
                  )
                }
              >
                <span className="ch-task-category">{t.group.slice(0, 1)}</span>
                <span>
                  <strong>{t.title}</strong>
                  <small>{t.detail}</small>
                </span>
                <Status value={t.status} />
                <ArrowUpRight size={16} />
              </button>
            ))}
          {!tasks.filter((t) => filter === "all" || filter === t.group)
            .length && <None>No outstanding tasks in this category.</None>}
        </div>
      </Card>
    </div>
  );
}
function ListLabel({ count }: { count: number }) {
  return (
    <h2>
      {count} item{count === 1 ? "" : "s"} need attention
    </h2>
  );
}
export function ManagementReports({ data }: { data: CommunityData }) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: data.property.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const rows = financialSummary(data);
  const occupied = new Set(
    data.agreements
      .filter(
        (a) =>
          a.status === "active" &&
          a.kind !== "master" &&
          a.startsOn <= today &&
          a.endsOn > today,
      )
      .flatMap((a) => a.unitIds),
  );
  return (
    <div className="community-stack">
      <div className="ch-section-heading">
        <div>
          <h2>Building performance</h2>
          <p>Current scoped records, with each currency reported separately.</p>
        </div>
        {rows.length ? (
          <a
            className="button secondary"
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(financialCsv(data))}`}
            download="communityhub-financial-summary.csv"
          >
            Export CSV
          </a>
        ) : (
          <button className="button secondary" disabled>
            Export CSV
          </button>
        )}
      </div>
      <div className="ch-metrics">
        <div>
          <strong>{data.units.length}</strong>
          <span>Registered units</span>
        </div>
        <div>
          <strong>{occupied.size}</strong>
          <span>Units with active tenancies</span>
        </div>
        <div>
          <strong>
            {
              data.agreements.filter(
                (a) => a.status === "active" && a.kind === "master",
              ).length
            }
          </strong>
          <span>Master leases</span>
        </div>
        <div>
          <strong>
            {data.expenses.filter((e) => e.paidStatus === "unpaid").length}
          </strong>
          <span>Unpaid expenses</span>
        </div>
      </div>
      <ReportCharts data={data} occupied={occupied.size} />
      {rows.map((r) => (
        <Card
          title={`Financial summary · ${r.currency}`}
          key={r.currency}
          detail="Charges include rent and deposits. Collections reflect verified payments only."
        >
          <div className="ch-report-grid">
            <div>
              <small>Billed</small>
              <strong>{amount(r.billed, r.currency)}</strong>
            </div>
            <div>
              <small>Verified collections</small>
              <strong>{amount(r.paid, r.currency)}</strong>
            </div>
            <div>
              <small>Outstanding</small>
              <strong>{amount(r.outstanding, r.currency)}</strong>
            </div>
            <div>
              <small>Expenses</small>
              <strong>{amount(r.expenses, r.currency)}</strong>
            </div>
          </div>
          <div className="ch-collection-progress">
            <span>Collection progress</span>
            <strong>
              {r.billed ? Math.round((r.paid / r.billed) * 100) : 0}%
            </strong>
            <progress
              aria-label={`Verified collection progress ${r.currency}`}
              max={r.billed || 1}
              value={r.paid}
            />
          </div>
        </Card>
      ))}
      {!rows.length && (
        <Card title="No financial records yet">
          <None>
            Record leases, rent charges or expenses to build your reports.
          </None>
        </Card>
      )}
    </div>
  );
}
