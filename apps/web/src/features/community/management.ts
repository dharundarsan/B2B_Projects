import type { CommunityData } from "../../../../../shared/community";
export type ManagementView = 1 | 2 | 3;
export interface ManagementModule {
  id: string;
  title: string;
  description: string;
  group: string;
  icon: string;
  color: string;
  path?: string;
}
const module = (
  id: string,
  title: string,
  description: string,
  group: string,
  icon: string,
  color = "violet",
  path?: string,
): ManagementModule => ({ id, title, description, group, icon, color, path });
export function managementModules(
  view: ManagementView,
  role: string,
): ManagementModule[] {
  const common = [
    module(
      "overview",
      "Dashboard",
      "Your building at a glance.",
      "Workspace",
      "dashboard",
    ),
    module(
      "actions",
      "Action center",
      "Requests and approvals that need attention.",
      "Workspace",
      "actions",
      "amber",
    ),
  ];
  if (view === 3)
    return [
      ...common,
      module(
        "market",
        "My store & products",
        "List products and keep stock up to date.",
        "My business",
        "store",
        "mint",
      ),
      module(
        "orders",
        "Customer orders",
        "Prepare and hand over your orders.",
        "My business",
        "basket",
        "blue",
      ),
      module(
        "services",
        "Services & requests",
        "Offer your skills and manage requests.",
        "My business",
        "wrench",
        "rose",
      ),
      module(
        "gate",
        "Incoming deliveries",
        "Request personal or bulk stock deliveries to your store.",
        "My business",
        "shield",
        "blue",
      ),
      module(
        "groups",
        "My group buys",
        "Organize community purchases.",
        "My business",
        "users",
        "amber",
      ),
    ];
  if (role === "watchman")
    return [
      ...common,
      module(
        "gate",
        "Gate & parcels",
        "Visitor entry, deliveries and parcel handovers.",
        "Daily operations",
        "shield",
        "blue",
      ),
      module(
        "community",
        "Shifts & rounds",
        "Your assigned rounds and shift notes.",
        "Daily operations",
        "notice",
        "mint",
      ),
      module(
        "map",
        "Building map",
        "Find units and common spaces.",
        "Community",
        "map",
      ),
    ];
  const admin = view === 2;
  return [
    ...common,
    ...(admin
      ? [
          module(
            "admin-center",
            "Admin center",
            "Manage your apartment from one place.",
            "Workspace",
            "grid",
          ),
          module(
            "people",
            "People & access",
            "Create accounts, assign buildings and enable views.",
            "Administration",
            "users",
            "amber",
          ),
          module(
            "buildings",
            "Communities & flats",
            "Set up communities, blocks, floors and flats.",
            "Administration",
            "building",
            "mint",
            "/properties",
          ),
        ]
      : []),
    module(
      "finance",
      admin ? "Rent & expenses" : "My rent & expenses",
      admin
        ? "Leases, rent collections and apartment costs."
        : "Your rent, payments and records for units you own or operate.",
      "Finance",
      "wallet",
      "blue",
    ),
    ...(admin
      ? [
          module(
            "reports",
            "Reports & insights",
            "Review collections, spending and occupancy.",
            "Finance",
            "chart",
            "violet",
          ),
        ]
      : []),
    module(
      "market",
      admin ? "Marketplace management" : "Apartment market",
      "Groceries, homemade food and neighbour products.",
      "Community",
      "basket",
      "mint",
    ),
    module(
      "services",
      admin ? "Service management" : "Community services",
      "Skills and services from your neighbours.",
      "Community",
      "wrench",
      "rose",
    ),
    module(
      "facilities",
      admin ? "Facilities & bookings" : "Facility bookings",
      admin
        ? "Manage shared spaces and reservations."
        : "Reserve a shared space and manage your own bookings.",
      "Daily operations",
      "calendar",
      "amber",
    ),
    module(
      "gate",
      "Gate & parcels",
      "Visitors, deliveries and parcel handovers.",
      "Daily operations",
      "shield",
      "blue",
    ),
    module(
      "community",
      "Announcements",
      admin
        ? "Community notices, watchman shifts and rounds."
        : "Read published notices for your building.",
      "Daily operations",
      "notice",
      "rose",
    ),
    module(
      "map",
      "Building map",
      admin
        ? "Sketch floors and visualize apartment spaces."
        : "Explore your building's published floors and common spaces.",
      "Community",
      "map",
      "violet",
    ),
    ...(admin
      ? [
          module(
            "maintenance",
            "Maintenance overview",
            "Track repair progress across your buildings.",
            "Maintenance",
            "wrench",
            "blue",
            "/maintenance",
          ),
          module(
            "requests",
            "Repair requests",
            "Review issues, quotes and scheduled visits.",
            "Maintenance",
            "actions",
            "amber",
            "/requests",
          ),
          module(
            "vendors",
            "Repair vendors",
            "Manage the specialists who handle repairs.",
            "Maintenance",
            "store",
            "mint",
            "/vendors",
          ),
          module(
            "costs",
            "Repair costs",
            "Review approved quotes and invoices.",
            "Finance",
            "wallet",
            "rose",
            "/costs",
          ),
          module(
            "settings",
            "Language settings",
            "Configure the languages used by your community.",
            "Administration",
            "settings",
            "violet",
            "/settings/languages",
          ),
        ]
      : role === "tenant"
        ? [
            module(
              "my-repairs",
              "My repairs",
              "Report an issue and track its progress.",
              "Daily operations",
              "wrench",
              "blue",
              "/tenant",
            ),
          ]
        : []),
  ];
}
export function moduleUrl(
  item: ManagementModule,
  view: ManagementView,
  property: string,
  query?: string,
) {
  const params = new URLSearchParams();
  if (property) params.set("property", property);
  if (!item.path) params.set("section", item.id);
  if (query) params.set("query", query);
  return (
    (item.path ?? (view === 2 ? "/admin" : view === 3 ? "/seller" : "/home")) +
    (params.size ? "?" + params : "")
  );
}
export function defaultSection(view: ManagementView) {
  return view === 2 ? "admin-center" : "overview";
}
export function financialSummary(data: CommunityData) {
  const sumMoney = (values: number[]) =>
    values.reduce((sum, value) => sum + Math.round(value * 100), 0) / 100;
  const currencies = [
    ...new Set([
      ...data.charges.map((c) => c.currency),
      ...data.expenses.map((e) => e.currency),
    ]),
  ];
  return currencies.map((currency) => {
    const charges = data.charges.filter((c) => c.currency === currency);
    const expenses = data.expenses.filter((e) => e.currency === currency);
    const billed = sumMoney(charges.map((c) => c.amount));
    const paid = sumMoney(charges.map((c) => c.verifiedPaid));
    return {
      currency,
      billed,
      paid,
      outstanding: Math.round((billed - paid) * 100) / 100,
      expenses: sumMoney(expenses.map((e) => e.amount)),
      unpaidExpenses: sumMoney(
        expenses.filter((e) => e.paidStatus === "unpaid").map((e) => e.amount),
      ),
    };
  });
}
export function localDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function dateTimeInstant(value: string) {
  return value ? new Date(value).toISOString() : null;
}

export function financialCsv(data: CommunityData) {
  return [
    [
      "Currency",
      "Billed including deposits",
      "Verified collections",
      "Outstanding",
      "Expenses",
      "Unpaid expenses",
    ],
    ...financialSummary(data).map((r) => [
      r.currency,
      r.billed,
      r.paid,
      r.outstanding,
      r.expenses,
      r.unpaidExpenses,
    ]),
  ]
    .map((row) => row.join(","))
    .join("\r\n");
}

export function deliveryTasks(data: CommunityData, now = new Date()) {
  const day = (instant: Date) => new Intl.DateTimeFormat("en-CA",{timeZone:data.property.timezone,year:"numeric",month:"2-digit",day:"2-digit"}).format(instant);
  return (data.deliveries ?? []).filter(r => data.canManage && r.status === "expected" && r.approval === "pending" || data.canGate && r.status === "expected" && r.approval === "approved" && day(new Date(r.expectedAt)) === day(now) || !data.canGate && r.userId === data.userId && r.status === "accepted");
}
