# Apartment community implementation

The existing maintenance application now has a Community portal at `/community` and a native Community tab. Records persist in MySQL, with SQLite available for isolated tests. The API is under `/api/community`; controllers retain the existing `{ data }` response envelope and verified Supabase authentication.

## Workflows

| Area | Implemented behavior |
| --- | --- |
| Ownership | People or companies bound to accounts; unit ownership, income and expense percentages with effective dates; multiple owners per unit; overlapping totals cannot exceed 100%. Separate owners can own separate flats. A floor lease selects multiple registered units. |
| Rentals | Direct lease or owner-to-operator master lease; operator-to-resident subleases confined to the parent's units, dates and currency. Each contract has its own rent, deposit and due day. Parent leases cannot end before their children. End dates are exclusive. |
| Rent | Generate a month explicitly and idempotently; partial months prorate by calendar days. Deposits remain separate from rent. Report partial payments with references; creditor or manager verifies or rejects them. A pending report does not mark a charge paid. Overpayment and stale revisions are rejected. |
| Expenses | Community, individual unit and operator scopes; currencies remain separate. Custom party allocations must equal the expense total. Unit expenses default to the expense shares effective on that date when those shares total 100%. Paid/unpaid state, private receipt upload/download and audit events. |
| Commerce | Shops inside the apartment and resident/home-kitchen sellers. Manager approval precedes product listing. Food listings require ingredients and allergen declarations. Orders reserve stock and retain the price at purchase. Seller acceptance, ready, handover and payment acknowledgment are separate actions. Cancellation releases stock once; paid cancellations record refund due until the seller acknowledges refund. |
| Group buys | Seller chooses a locked price, minimum/maximum quantity, deadline and pickup plan. Members can amend or withdraw before the deadline. Seller/manager finalizes after the deadline. Quantity and stock checks run in one transaction; successful groups create individual unpaid orders. Failed/cancelled groups create no orders or payments. |
| Watchman | Scoped visitor/delivery/contractor registration, resident or manager approval, arrival and departure. Parcel desk acceptance and resident receipt have separate timestamps. Shift notes and assigned/common rounds. Existing confirmed repair-visit and shared-area reporting features continue. |
| Facilities | Capacity, slot duration, fee and rules; atomic overlap checks; future booking cancellation; manager can pause/reopen a facility. |
| Community | Notices visible to members; shift handover and staff rounds scoped to assigned watchmen. |
| Building map | Admin draws rectangles or polygon outlines on a snapped grid, labels spaces and links flats/shops to stable unit IDs. Move with dragging or arrow keys, undo, trace a temporary local blueprint, duplicate a floor with fresh shape IDs and cleared unit links. Save a versioned draft, then publish. Members see published shapes. Lazy-loaded Three.js extrudes floors and supports orbit, zoom and picking; 2D remains available without WebGL. |

Each catalog item is ordered separately from its seller. This version records payment and refund acknowledgments; it does not transfer money or connect to a payment gateway. Group finalization and monthly billing are explicit actions, with no background scheduler. Deposits have separate received balances; deposit refund accounting, lease amendment/credit-note accounting, shareholder payout transfers, and automated distributions are future extensions. Published geometry is an illustrative building map; dimensions and heights are not a surveyed CAD model. The uploaded blueprint is only a local tracing guide and is not stored or published.

The web and native app provide separate Admin and User views. An administrator can switch between persisted context **1 (User)** and **2 (Admin)**; permissions still come from verified account roles and building relationships. See [the access and view guide](ADMIN-AND-USER-VIEWS.md).

Both clients provide setup, ownership/lease administration, stores and products, groups, rent reporting/verification, expenses, facilities and gate/staff operations. Native admins can create buildings and units, edit rectangular floor spaces, duplicate floors and publish layouts. Freehand polygon editing, interactive Three.js visualization and private receipt attachment use the web portal. Native members see published floor spaces. Native device camera/push and real private Storage transfers were not exercised in this implementation's isolated tests.

## Account provisioning and access

Existing trusted `owner` and `manager` roles retain workspace administration. `unit_owner` is a scoped property owner, and `operator` is the person/company renting from an owner and subletting. These roles do **not** gain the legacy manager's maintenance access. They need trusted Supabase `app_metadata.role` and `workspace_id`, plus an account-bound party and a current ownership/master lease in the database.

1. Manager creates the building and actual unit labels in Properties.
2. Manager creates the owner/operator/resident parties in Community → Rent & expenses → Owners & agreements. Bind each account UUID once per building; unbound company entities can also be recorded.
3. Manager records dated ownership shares and the master/direct lease. Operator can create subleases using existing parties. One direct tenancy or sublease covers one registered unit and binds its trusted occupancy UUID; a master lease can cover up to 100 units.
4. Residents still require the existing dated, trusted property/unit occupancy metadata in [RESIDENT-PRIVACY.md](RESIDENT-PRIVACY.md). The lease's party account, occupancy UUID and stable unit must match that assignment. A subsequent occupant never receives a previous occupancy's ledger merely by sharing the unit label.
5. Watchmen still require trusted `property_ids`. Their response excludes parties, ownerships, agreements, charges, payments, expenses, receipts, orders, catalog and bookings. Gate responses omit resident account and occupancy IDs. Only a bound resident can acknowledge parcel receipt.

Seller status is an additional building relationship; residents keep their resident role. Clients cannot bind themselves to other accounts, approve stores, become managers or grant ownership. Creating a party record does not modify Supabase metadata or create/sign in an account.

Property membership is rechecked on every request. Building-local dates determine current ownership and lease access. Every mutation locks the property row before checking stock, shares, balances, bookings or relationships; workspace/property foreign keys provide a second boundary. Mutable records require their current revision. Audit events are append-only through this module, rather than a tamper-proof financial journal. Active contracts, unpaid charges/expenses, orders/refunds, group buys, entries and future bookings block property archival.

## Schema and code

Migration **006_Community.sql** adds these tables without changing numbered migrations 001–005:

| Tables | Purpose |
| --- | --- |
| community_parties, community_ownerships | Account-bound persons/companies and dated unit shares |
| community_agreements, community_agreement_units | Linked contracts and normalized stable unit coverage |
| community_charges, community_payments | Rent/deposit obligations and reported/verified payment receipts |
| community_expenses, community_expense_allocations, community_receipts | Expenses, party allocations and private attachment metadata |
| community_sellers, community_products, community_orders | Approved internal commerce and stock-reserving item orders |
| community_groups, community_pledges | Group-buy terms and participant commitments |
| community_gate_entries | Approved arrival/departure and parcel handover |
| community_facilities, community_bookings | Capacity-limited reservations |
| community_notes | Community notices, watchman handover and rounds |
| community_layouts, community_audit | Draft/published geometry and mutation history |

Community row IDs are VARCHAR(100), workspace/property IDs retain VARCHAR(200), unit references retain VARCHAR(300). The added unit index supports `(workspace_id,property_id,id)` foreign keys. MySQL uses exact DECIMAL(14,2) for money and shares. Geometry alone uses bounded JSON. Other relationships use foreign keys/normalized join tables.

`CommunityController` → `CommunityBL` partial files → `CommunityDAL` → embedded, parameterized SQL. The module reuses existing connection, query, Dapper, identity, Storage, rate-limiting and error helpers. `shared/community.ts` holds the web/native response contracts. Web code is modular under `apps/web/src/features/community`; native is in `MobileCommunity.tsx`.

Migration **007_UserContext.sql** adds the `users` table with workspace/account-scoped context and revision. It does not change migration 006 or create authentication credentials. `scripts/generate-community-schema.cjs` generates the **unreleased v6** community DDL, bound query resources, preflight SELECT checks and final-schema snapshots through v7. Regeneration is deterministic. Freeze numbered migrations once deployed; subsequent schema changes need a new migration. The current serialization boundary is one building per transaction; if large buildings create contention, measure that boundary before introducing finer locks or pagination.

## Enable in an existing installation

From `D:\B2B projects\Apartment App`:

```powershell
npm ci
npm --prefix apps/mobile ci
npm run build:api
npm run db:migrate
npm run db:check
npm run dev
```

The configured MySQL deployment must receive migrations through **007**, and a running API must restart to load the new controllers. This work used only synthetic disposable databases; existing private configuration and user databases were not migrated. Final DDL snapshots are for empty databases, not upgrades. Continue using the existing deployment backup/DDL procedure. See [mobile MFE and Vercel feasibility](MOBILE-MFE-FEASIBILITY.md) for the separately compiled frontend decision and prepared hosting configurations.

Keep Supabase's evidence bucket private and configure backend-only Storage credentials for receipts. Mobile requires a real configured session for Community; the existing sample maintenance preview deliberately does not manufacture financial or membership data. A clean native install now anchors the existing patched URI decoder as a direct local dependency, fixing its previous broken relative link.

## Verification (2026-10-04)

- API Release build: zero warnings/errors.
- SQLite backend: 147 passing tests, including 16 community/access regressions and migration 007 recovery coverage.
- MySQL 26.7 disposable loopback server: 147 passing tests. Test databases are generated and discarded.
- SQLite HTTP smoke: 68 passing checks including typed community controller paths, persisted view switching, permission enforcement and the mobile admin context.
- Web: 60 existing tests, TypeScript and production compilation, including a configuration that retains authenticated application routes. Three.js is downloaded only when the 3D view is opened.
- Native: clean `npm ci`, TypeScript, 15 tests and Expo Android/iOS/web bundle export. Native device behavior still needs device testing. The existing mobile dependency audit reports 19 high vulnerabilities from its earlier dependency tree; no broad SDK/security upgrade was performed as part of these features.
- Browser: synthetic order creation reduced stock and appeared in the seller queue. Keyboard movement, labels, draft saving, publication, duplication, multi-floor 3D rendering and picking were checked against a separate SQLite preview. No bank/payment/real lease action was performed.
- Admin/User browser checks: context switching preserves the selected building, survives reload, hides buying in Admin, hides facility/map administration in User, and redirects management routes in User. Saved screenshots are in `.tools/user-view-preview.png` and `.tools/admin-view-preview.png`.
