# CommunityHub management revamp

Implemented on 2026-10-04 in `D:\B2B projects\Apartment App`.

The public product is **CommunityHub**. Existing C# project/namespace names, migration resources, native signing IDs, URL scheme, storage keys and historical snapshot filenames retain their original technical identifiers for compatibility. The displayed web/native name and npm package names use CommunityHub.

## Views and navigation

| Context | Home | What appears |
| --- | --- | --- |
| User = 1 | `/home` | Apartment shops, resident products/food, group buys and orders; community services/requests; own account-bound rent/owner/operator expenses; facilities; own gate/parcels; notices; published maps. Watchmen see assigned gate, notices, staff rounds and maps. |
| Admin = 2 | `/admin` | Dashboard/action queues, People & access, buildings/units, ownership/direct/master/subleases, billing and expenses, store approvals/catalogue/orders, service catalogue/requests, facilities/bookings, gate operations, staff notes and editable/published maps; linked maintenance administration. |
| Seller / Provider = 3 | `/seller` | Own stores, products/stock, customer orders/payment/handovers/refunds, own group buys, own service catalogue and customer requests. Dashboard counts and recorded payments are scoped to that account. |

`/` and `/community` redirect to the selected view's home. Module navigation lives inside the matching dashboard. A fixed/sticky profile menu at the top right shows only enabled views. Admins have all three. Members can have User, Seller/Provider or both; the Admin option is entirely absent for them. Watchmen use User only. Account creation configures role, enabled views and starting view. A second integer or client route never grants admin rights.

Admins' User/Seller views represent their own account. They do not impersonate neighbours or inherit other sellers' businesses. All routes and mutations still enforce workspace/building scope, actor permissions and revision checks on the API.

## People and access

Admin > People & access on web/mobile includes name/email search, role/view summaries, building assignments, create/edit, suspend/reactivate and recent access audit. The web directory also includes status filtering and account totals.

Creation uses Supabase's server-only Auth Admin endpoint with the backend service-role key, then commits local permissions and memberships. Passwords never enter the application database or API responses. An initial password is entered by the administrator and shared directly with the account owner; this workflow sends no invitation email. If the local transaction fails, the freshly created Auth account is compensated. A cleanup failure reports reconciliation explicitly. Duplicate/Auth failures are sanitized.

Editing existing access happens in the trusted application database and takes effect on the next verified request; it does not depend on token claims being refreshed. Suspension blocks existing sessions from using the application. Revision checks prevent concurrent stale edits. Administrators cannot suspend themselves or remove their own admin access. Account deletion is not exposed; suspension is reversible. Email edits and cross-workspace identity transfers are not exposed.

Building assignments grant community access only. Tenant unit access additionally requires a stable registered unit, a dated occupancy UUID and matching report/lease bindings. Changing the tenant unit creates a new occupancy UUID in the editor. Owner/operator ledgers require actual account-bound ownerships/agreements. The account picker connects People & access to party, lease and store setup. Companies may remain unbound.

The first owner must still be provisioned through trusted Supabase tooling with `role=owner` and the correct `workspace_id`. Public signup is not offered in the app. Missing role metadata now resolves to an unassigned `member`, never an owner. Existing unmanaged accounts retain verified legacy assignments until edited through People & access; managed assignments then replace legacy property/occupancy claims. Refresh/reopen an already-running client after changing permissions from another device.

## Services

An approved seller/provider profile can list, edit or pause services with category, description, price, currency and per-visit/hour/fixed pricing. User view can search services and submit a request with details and a preferred time. Providers accept/decline requests and mark accepted work completed; eligible open requests can be cancelled. Requests snapshot the offered price/name and use a submission UUID for retries. Optimistic revisions guard actions. Active requests prevent building archival. Timing and payment are confirmed directly; there is no automatic appointment or payment gateway.

## Schema and rollout

Migration **008_ManagementViews.sql** is additive to the published migration sequence. Migrations 001–007 are unchanged. Current runtime schema is **8**, with **43 application tables plus schema_migrations**.

| Table/change | Purpose |
| --- | --- |
| users extension | Display name/email, verified identity role, managed role, active/suspended status, User/Admin/Seller permissions, starting/current context 1/2/3, creation time and revision. |
| user_memberships | Workspace/account/building assignment, optional registered unit and dated tenant occupancy. |
| user_admin_audit | Actor, target account, action and server timestamp for access changes. |
| community_services | Building-scoped provider service catalogue. |
| community_service_requests | Scoped requests, price/name snapshot, preferred time, lifecycle status and idempotency key. |

Back up and review the existing database, apply `npm run db:migrate`, run `npm run db:check`, then restart the API and deploy matching clients. Runtime needs SELECT/INSERT/UPDATE plus DELETE specifically on user_memberships for transactional replacement. Keep Supabase:ServiceRoleKey exclusively on the backend. The user's configured database and real Auth accounts were not changed during verification. The localhost preview uses an isolated synthetic SQLite database; account creation there produces demo records without Auth identities.

Web and native screens remain separately compiled against the same API/contracts. Runtime MFE was not introduced. [Mobile MFE and hosting feasibility](MOBILE-MFE-FEASIBILITY.md) covers the Vercel limitations and separate builds. Expo's shared-directory watcher uses the [official Metro configuration](https://docs.expo.dev/guides/customizing-metro/), with no added federation dependency.

## Reference products

The design uses role-scoped dashboards and account administration seen in [MyGate's admin roles](https://adminfaq.mygate.com/articles/130320-what-are-the-different-types-of-admin-roles-available-on-the-dashboard), a unified resident hub inspired by [Buildium's Resident Center](https://www.buildium.com/features/resident-center/), and neighbourhood products/services like [ADDA's community marketplace](https://adda.io/modules/support_tracker_adda_announcements.php). The UI is an original implementation built on this project's existing components.

[Supabase Auth Admin createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser) documents the server-only account creation boundary. Its HTTP transport is covered with mocks, not a real production account creation.

## Verification

For more sample records in an isolated Development demo API, run `pwsh -File scripts/community-preview-expand.ps1 -BaseUrl http://127.0.0.1:4401`. It adds labelled products, services, orders in different states, group buys, facilities/bookings, resident/provider/watchman/owner/operator directory records, a suspended account, joint ownership, rent/payment examples, expenses, notices and gate entries to Oak Street. It preserves existing records and skips the same sample set on subsequent runs. The script requires the demo identity on a loopback API, respects rate limiting and restores the original account view. Demo accounts have no Auth identities and cannot sign in; payments are sample ledger records only.

- All 157 API tests passed on SQLite and isolated MySQL, including managed permissions, request privacy, Auth transport and migration recovery.
- 83 isolated HTTP checks passed, including managed account lifecycle, the third context, service requests and permission denial.
- 60 web tests and 15 mobile tests passed; web/native TypeScript checks passed.
- Configured web production build and Expo Android/iOS/web exports passed. The existing lazy Three.js bundle still reports Vite's size advisory.
- Desktop view switching and responsive browser QA are checked against the synthetic preview. Physical Android/iOS and real Supabase account onboarding require environment/device verification.
