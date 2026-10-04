# CommunityHub workspace redesign — 4 October 2026

## Design references

The user supplied Disprz desktop screenshots and a 54-second recording. They inform the persistent white header, dark collapsible navigation, pastel admin module cards and sectioned account creation flow. The apartment product keeps its own branding, modules, permissions and data.

Official product references reviewed:

- [Disprz](https://disprz.ai/): enterprise learning platform context for the supplied reference.
- [MyGate society dashboard](https://mygate.com/blog/feature-in-focus/society-dashboard/) and [apartment management](https://mygate.com/apartment-management-system/): community operations, financial records, amenities and management workflows.
- [Buildium property owner portal](https://www.buildium.com/features/property-owner-portal/): owner-facing financial visibility and a connected property workspace.

## Implemented experience

One WorkspaceShell surrounds admin, resident, seller, buildings, maintenance, repair requests, repair costs and language settings. It owns apartment context, scoped community records, navigation, search and the sticky profile menu. Repair vendor job pages retain their specialized portal.

- Admin opens an Admin center with working module cards. Dashboard and Action center are separate destinations.
- Authorized views appear in one profile dropdown on every workspace page. Ordinary users have no administrator navigation; Admin is absent from their available contexts. Administrators retain User, Admin and Seller / Provider access.
- Grouped navigation collapses to labelled icons on desktop. On phones it becomes a focus-managed drawer containing an apartment picker. The profile and search remain available in the header.
- Workspace search finds authorized modules and actual products/services in the selected building. Selecting a product or service opens its filtered catalogue.
- Dashboard shortcuts and action queue rows open the appropriate module, including the Orders tab. Watchmen see gate and rounds shortcuts; sellers see their scoped business records.
- Financial reports show billed charges, verified collections, outstanding amounts, spending and tenancy occupancy. Money is summed in cents, and currencies stay separate. Reports export CSV. Billed charges include deposits.
- People & access has name/email search, role and status filters, pagination and recent access activity.
- Creating or editing a member uses one dedicated page with Identity & role, Views & permissions and Building assignments. The starting view follows enabled permissions. Admin roles include all views automatically. Resident occupancy uses local date/time controls that serialize UTC instants.
- Suspension/reactivation uses a named confirmation dialog with focus management. Administrators cannot suspend their own account.
- Generic community forms expose expanded state and a Cancel action. Existing backend revision checks, scoped permissions and duplicate submission handling remain in use.
- Existing repair notifications remain available to administrators through the header inbox.
- Profile-only account updates preserve unchanged building assignments instead of deleting and reinserting them. This fixes ordinary account edits for a local runtime lacking assignment-delete permissions.

## Boundaries and local setup

This is a web workspace redesign, including responsive phone layouts. The separate Expo application and its existing admin views were not redesigned in this pass. No runtime microfrontend dependency was introduced.

The current preview uses the local demonstration configuration. Sample accounts are useful for directory and permission demonstrations, but cannot sign in until live authentication is configured. Account membership removal/replacement still needs the documented DELETE permission on user_memberships; profile-only edits do not need it.

## Validation

- Production web build passed with explicit API/authentication build configuration, ensuring the application routes are included.
- 68 web tests passed: existing repair/privacy policies plus navigation scope, URL encoding, report currencies/cents and occupancy date round-tripping.
- 158 API tests passed using an isolated SQLite test database. The added regression test denies membership deletion, proves a profile-only update succeeds, and proves a rejected assignment removal rolls back.
- Browser verification on port 5173: shared buildings navigation, module hub, account role/view setup, resident unit/time controls, sample account save, product search, User/Seller/Admin switching with apartment preserved, notification inbox, action queue and financial reports.
- Responsive validation at 390 × 844: no page overflow, one profile trigger, mobile navigation/apartment picker, Escape closing with focus restored.

Preview: http://127.0.0.1:5173/admin?property=oak-street

The in-app browser did not report a completed download event during CSV testing. The native download link and its currency-separated CSV content were verified; download completion in a regular browser remains a manual check.
## View responsibilities

The account role grants available views; the selected view controls current actions. An administrator using User or Seller view does not carry apartment administration controls into that view.

| View | Allowed work | Scope |
| --- | --- | --- |
| Admin (2) | Create users and administrators, manage access/buildings, configure facilities and layouts, moderate stores, oversee finance and community operations | Current workspace; selected building for apartment records |
| User (1) | Buy products, join group buys, request services, book facilities, read notices and published maps | Own orders, requests, reservations, resident occupancy and financial records; owners/operators manage their own units/agreements |
| Seller / Provider (3) | Register own store, edit own products/services, fulfill customer orders, organize own group buys | Own business only; no personal buying/bookings or apartment settings |
| Watchman (User view) | Gate, parcels, shift notes, assigned rounds and published map | Assigned buildings and rounds |

Use **People & access → Create account → Administrator role** to create another administrator. This selects the Administrator role, enables all three views and starts in Admin view. The same server permission checks apply to web and mobile. Real sign-in requires the already documented backend Supabase account administration configuration; local demonstration accounts remain samples.

After the permission changes: 160 API tests, 68 web tests and 15 mobile tests passed. Production web build and web/mobile type checks passed. The added API regressions exercise wrong-view commerce denial and delegated administrator creation. Existing tests now explicitly switch into User or Seller view when exercising those workflows.

## Community hierarchy: implemented 5 October 2026; administrator delegation deferred

Recorded from the user's voice discussion on 5 October 2026. The initial voice request deferred this work. The subsequent written request authorized implementing the community/block/floor/flat hierarchy.

One management account may oversee multiple apartment communities at different locations. Within each community, model blocks/towers, floors and individual flats separately:

**Management account → Community at a location → Block / Tower → Floor → Flat**

For example, Prestige at Whitefield contains Block A and Block B, with flats A-101 and A-102 in Block A. Prestige at Electronic City is a separate community under the same management account, not another block of the Whitefield community.

Administrators need to be organized around the communities they manage. Before implementation, define whether each administrator has account-wide, community-specific or block-specific access, and how other administrators are assigned. Do not assume every administrator automatically manages every community.

Migration 009 now treats existing properties as location-specific communities and adds blocks plus flat/floor assignments. Existing flats and maps remain unassigned until organized. Rent and resident links keep their existing IDs; services, sellers, facilities and deliveries belong to a community. Block maps are separate per floor. Per-community/block administrator delegation remains deferred; current administrators have workspace-wide access.


## UX improvements — 5 October 2026

- Clickable breadcrumbs throughout the shared Admin, User and Seller workspace, with community and repair detail parents. Module navigation resets page scroll to the top.
- Community setup uses a visible four-step hierarchy, block registration/rename, batch flat registration, floor grouping, search and existing-flat location assignment. Previous maps remain accessible. The map has block/floor selection, a starter grid based on registered flats, draft/publish steps, and block-specific 3D preview.
- One **Create account** button offers Resident, Member, Owner, Operator, Watchman, Seller/Provider and Administrator presets. The seller preset stores a member role with Seller access and starting view 3; permissions remain enforced by the API.
- Services and marketplace share provider registration. Admins select an active seller account assigned to the community; admin-created profiles are approved immediately. Seller-created profiles require approval. Sellers manage their own offerings, admins oversee all, and users purchase/request help. Users without Seller access get an actionable explanation; eligible users can open Seller view directly.
- Residents request expected deliveries with carrier, reference, package count and optional destination flat. Sellers request stock, mark bulk and supply handling instructions. Admins review bulk; watchmen accept approved deliveries; recipients confirm receipt. A user request can use community gate pickup without a tenancy.
- Reports show occupancy, order activity, monthly billed/verified collections/expenses, and category spending, with separate currencies and accessible numeric tables. Charts use existing SVG/browser controls; no chart dependency was added. Native mobile adds block/floor setup, provider registration, a unified account flow, incoming deliveries and financial/category bars. Native rendering is typechecked; device behavior needs a device run.

References: [MyGate visitor management](https://mygate.com/visitor-management/) informed gate routing and approval responsibilities; [MyGate apartment management](https://mygate.com/apartment-management-system/) informed module organization; [Buildium property analytics](https://www.buildium.com/features/property-management-analytics/) informed financial and occupancy reporting. User-supplied Disprz screenshots continue to inform the shared shell.

Local migration 009 applied to MySQL. API tests cover atomic flat batches, block/floor map scoping, provider ownership/account eligibility, wrong-view delivery restrictions, bulk approval, expected-day acceptance and recipient-only receipt. Chart tests cover currency isolation, cent arithmetic and chronological month limits.

Browser checks also verified adding Block A (Demo) and flats A-101/A-102 to Oak Street, creating and publishing a demo starter floor, and saving a personal delivery request. The full isolated MySQL test run could not create its temporary rl_test databases with the configured runtime account; it needs a separate test connection with isolated database create/drop rights. No runtime permissions were broadened.
