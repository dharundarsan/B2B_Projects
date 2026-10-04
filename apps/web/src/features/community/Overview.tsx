import {
  ArrowUpRight,
  ShoppingBasket,
  Wallet,
  CalendarDays,
  ShieldCheck,
  Users,
  Store,
  Wrench,
  Map,
  Megaphone,
  Building2,
} from "lucide-react";
import type { CommunityData } from "../../../../../shared/community";
import { financialSummary } from "./management";
import { Card, None, Status, amount } from "./ui";
export function Overview({
  data: d,
  mode,
  change,
}: {
  data: CommunityData;
  mode: 1 | 2 | 3;
  change: (section: string, tab?: string) => void;
}) {
  const admin = mode === 2,
    seller = mode === 3,
    guard = d.role === "watchman";
  const activeOrders = d.orders.filter(
    (o) => !["handed_over", "cancelled"].includes(o.status),
  );
  const requests = d.serviceRequests.filter((r) =>
    ["requested", "accepted"].includes(r.status),
  );
  const outstanding = d.charges.filter((c) => c.verifiedPaid < c.amount);
  const waiting = d.gateEntries.filter(
    (g) => g.status === "expected" && g.approval === "pending",
  );
  const cards = guard
    ? [
        {
          title: "Expected entries",
          value: d.gateEntries.filter((g) => g.status === "expected").length,
          icon: ShieldCheck,
          section: "gate",
        },
        {
          title: "Inside now",
          value: d.gateEntries.filter((g) => g.status === "inside").length,
          icon: Users,
          section: "gate",
        },
        {
          title: "Open rounds",
          value: d.notes.filter(
            (n) => n.kind === "round" && n.status === "open",
          ).length,
          icon: Wrench,
          section: "community",
        },
        {
          title: "Building units",
          value: d.units.length,
          icon: Building2,
          section: "map",
        },
      ]
    : seller
      ? [
          {
            title: "My products",
            value: d.products.length,
            icon: Store,
            section: "market",
          },
          {
            title: "Open orders",
            value: activeOrders.length,
            icon: ShoppingBasket,
            section: "orders",
          },
          {
            title: "Service requests",
            value: requests.length,
            icon: Wrench,
            section: "services",
          },
          {
            title: "Active group buys",
            value: d.groups.filter((g) => g.status === "open").length,
            icon: Users,
            section: "groups",
          },
        ]
      : [
          {
            title: admin ? "Registered units" : "Available shops",
            value: admin
              ? d.units.length
              : d.sellers.filter((s) => s.status === "approved").length,
            icon: admin ? Users : Store,
            section: admin ? "buildings" : "market",
          },
          {
            title: "Open orders",
            value: activeOrders.length,
            icon: ShoppingBasket,
            section: "market",
          },
          {
            title: "Open rent charges",
            value: outstanding.length,
            icon: Wallet,
            section: "finance",
          },
          {
            title: "Upcoming bookings",
            value: d.bookings.filter(
              (b) =>
                b.status === "confirmed" && new Date(b.endsAt) > new Date(),
            ).length,
            icon: CalendarDays,
            section: "facilities",
          },
        ];
  const quick = guard
    ? [
        {
          label: "Manage the gate",
          detail: "Check visitors and parcel handovers",
          section: "gate",
          icon: ShieldCheck,
        },
        {
          label: "Shifts & rounds",
          detail: "Review assignments and record progress",
          section: "community",
          icon: Wrench,
        },
        {
          label: "Find a space",
          detail: "Explore the apartment building map",
          section: "map",
          icon: Map,
        },
      ]
    : seller
      ? [
          {
            label: "Add products",
            detail: "Manage stock and availability",
            section: "market",
            icon: Store,
          },
          {
            label: "Offer a service",
            detail: "Help neighbours with your skills",
            section: "services",
            icon: Wrench,
          },
          {
            label: "Start a group buy",
            detail: "Bring the community together",
            section: "groups",
            icon: Users,
          },
        ]
      : admin
        ? [
            {
              label: "Manage people",
              detail: "Accounts, roles and view access",
              section: "people",
              icon: Users,
            },
            {
              label: "Rent & expenses",
              detail: "Collections and building costs",
              section: "finance",
              icon: Wallet,
            },
            {
              label: "Building map",
              detail: "Sketch and explore your spaces",
              section: "map",
              icon: Map,
            },
          ]
        : [
            {
              label: "Shop your apartment",
              detail: "Groceries, food and neighbour products",
              section: "market",
              icon: ShoppingBasket,
            },
            {
              label: "Book a facility",
              detail: "Make room for your plans",
              section: "facilities",
              icon: CalendarDays,
            },
            {
              label: "Find a service",
              detail: "Skills from your own community",
              section: "services",
              icon: Wrench,
            },
          ];
  return (
    <div className="community-stack">
      <section className="ch-welcome">
        <div>
          <span className="ch-eyebrow">
            {guard
              ? "YOUR DAILY OPERATIONS"
              : seller
                ? "GROW WITH YOUR COMMUNITY"
                : admin
                  ? "YOUR COMMUNITY AT A GLANCE"
                  : "WELCOME TO YOUR COMMUNITY"}
          </span>
          <h2>
            {guard
              ? "Keep your community moving"
              : seller
                ? "Your neighbourhood business"
                : admin
                  ? "A better place to manage it all"
                  : "Everyday living, made easier"}
          </h2>
          <p>
            {guard
              ? "Manage visitor entry, parcel handovers and assigned rounds in one place."
              : seller
                ? "Your products, services and customer requests in one workspace."
                : admin
                  ? "Stay on top of your people, building finances and daily operations."
                  : "Find something local, book your space and stay connected with your neighbours."}
          </p>
        </div>
        <span className="ch-welcome-icon">
          {seller ? <Store size={44} /> : <Users size={46} />}
        </span>
      </section>
      <div className="ch-metrics">
        {cards.map((c) => (
          <button
            key={c.title}
            onClick={() =>
              change(
                c.section,
                c.title === "Open orders" && !seller ? "orders" : undefined,
              )
            }
          >
            <c.icon size={19} />
            <strong>{c.value}</strong>
            <span>{c.title}</span>
            <ArrowUpRight size={15} className="ch-metric-arrow" />
          </button>
        ))}
      </div>
      <div className="ch-quick-grid">
        {quick.map((q) => (
          <button key={q.label} onClick={() => change(q.section)}>
            <q.icon size={23} />
            <div>
              <strong>{q.label}</strong>
              <span>{q.detail}</span>
            </div>
            <ArrowUpRight size={17} />
          </button>
        ))}
      </div>
      {admin && financialSummary(d).length > 0 && (
        <Card
          title="Rent collections"
          detail="Verified payments against recorded charges, including deposits."
        >
          <div className="ch-report-grid">
            {financialSummary(d).map((r) => (
              <div key={r.currency}>
                <small>Outstanding · {r.currency}</small>
                <strong>{amount(r.outstanding, r.currency)}</strong>
                <span>{amount(r.paid, r.currency)} collected</span>
              </div>
            ))}
          </div>
          <button className="ch-text-link" onClick={() => change("reports")}>
            View financial reports <ArrowUpRight size={15} />
          </button>
        </Card>
      )}
      <div className="community-grid">
        <Card
          title={seller ? "Your action list" : "Needs attention"}
          detail="Live updates from this building."
        >
          <div className="ch-task-list">
            {admin &&
              d.sellers
                .filter((s) => s.status === "pending")
                .map((s) => (
                  <button key={s.id} onClick={() => change("market")}>
                    <Store size={19} />
                    <span>
                      <strong>{s.name}</strong>
                      <small>Store application awaiting approval</small>
                    </span>
                    <Status value="pending" />
                  </button>
                ))}
            {activeOrders.slice(0, 4).map((o) => (
              <button
                key={o.id}
                onClick={() =>
                  change(
                    seller ? "orders" : "market",
                    seller ? undefined : "orders",
                  )
                }
              >
                <ShoppingBasket size={19} />
                <span>
                  <strong>
                    {d.products.find((p) => p.id === o.productId)?.name ??
                      "Product order"}{" "}
                    × {o.quantity}
                  </strong>
                  <small>{amount(o.unitPrice * o.quantity, o.currency)}</small>
                </span>
                <Status value={o.status} />
              </button>
            ))}
            {requests.slice(0, 3).map((r) => (
              <button key={r.id} onClick={() => change("services")}>
                <Wrench size={19} />
                <span>
                  <strong>{r.serviceName}</strong>
                  <small>{new Date(r.preferredAt).toLocaleString()}</small>
                </span>
                <Status value={r.status} />
              </button>
            ))}
            {!seller && waiting.length > 0 && (
              <button onClick={() => change("gate")}>
                <ShieldCheck size={19} />
                <span>
                  <strong>{waiting.length} gate approvals</strong>
                  <small>Check expected visitors and deliveries</small>
                </span>
                <ArrowUpRight size={17} />
              </button>
            )}
            {!activeOrders.length &&
              !requests.length &&
              (seller ||
                (!waiting.length &&
                  !d.sellers.some((s) => admin && s.status === "pending"))) && (
                <None>
                  You're all caught up. New requests will appear here.
                </None>
              )}
          </div>
        </Card>
        {seller ? (
          <Card
            title="Business summary"
            detail="Payments and handovers are recorded by you; settlement happens directly."
          >
            {Array.from(new Set(d.orders.map((o) => o.currency))).map(
              (currency) => (
                <div className="ch-total" key={currency}>
                  <span>Recorded paid orders · {currency}</span>
                  <strong>
                    {amount(
                      d.orders
                        .filter(
                          (o) =>
                            o.currency === currency &&
                            o.paymentStatus === "paid" &&
                            o.status !== "cancelled",
                        )
                        .reduce((sum, o) => sum + o.unitPrice * o.quantity, 0),
                      currency,
                    )}
                  </strong>
                </div>
              ),
            )}
            {!d.orders.length && (
              <None>
                Register your store and add your first product or service to
                begin.
              </None>
            )}
          </Card>
        ) : (
          <Card
            title={guard ? "Assigned shifts & rounds" : "Community noticeboard"}
          >
            <div className="ch-activity">
              {d.notes
                .filter((n) =>
                  guard ? n.kind !== "notice" : n.kind === "notice",
                )
                .slice(-4)
                .reverse()
                .map((n) => (
                  <div key={n.id}>
                    <Megaphone size={18} />
                    <div>
                      <strong>{n.title}</strong>
                      <p>{n.body}</p>
                      <small>
                        {new Date(n.createdAt).toLocaleDateString()}
                      </small>
                    </div>
                  </div>
                ))}
              {!d.notes.length && (
                <None>Your building announcements will appear here.</None>
              )}
            </div>
            <button
              className="ch-text-link"
              onClick={() => change("community")}
            >
              {guard ? "Open shifts & rounds" : "Open noticeboard"}{" "}
              <ArrowUpRight size={15} />
            </button>
          </Card>
        )}
      </div>
    </div>
  );
}
