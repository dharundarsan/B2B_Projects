# CommunityHub mobile app

React Native and TypeScript app for apartment administrators, residents, owners, operators and watchmen, built with Expo SDK 57. Maintenance data stays in the existing C# API and MySQL database. Supabase supplies authentication and private apartment-repair photos; its database is not used for maintenance records.

The **Community** tab supports internal shops, resident selling and group buys, rent payment reporting/verification, owner and operator expenses, facility bookings, visitors, parcels, notices and watchman rounds. Administrators can switch between **User (1)** and **Admin (2)** views; the selected view is saved in the API's users table. Native Admin includes building/unit setup, parties, ownerships, leases, store/facility setup and rectangle-based floor editing/publication. Scoped `unit_owner` and `operator` accounts open Community first. Freehand polygons, Three.js visualization and private receipt attachments use the web portal. Apply migrations through **007** and provision account bindings as described in [the community guide](../../docs/COMMUNITY-PLATFORM.md). See [view permissions](../../docs/ADMIN-AND-USER-VIEWS.md) and [MFE/Vercel feasibility](../../docs/MOBILE-MFE-FEASIBILITY.md). The existing maintenance preview does not fabricate community permissions or financial transactions.

This directory is deliberately separate from the root npm workspace. It uses React 19 without upgrading the existing React 18 web app. Install dependencies inside this directory.

## Run the local browser preview

Use Node.js 22.6 or newer; the source was verified with Node 24. Install Node on your machine and update your terminal's PATH if it still selects an older version. This extracted source does not include a bundled Node runtime.

```powershell
cd D:\B2B\RepairLedger-Web-and-Mobile-Final\RepairLedger-app-source\apps\mobile
npm ci
npm run preview
```

Open the localhost address printed by Expo. Choose **Preview resident app** or **Preview watchman app**. Preview data stays in memory, resets on sign-out/reload, and never grants a server role. Sign out from Account to switch previews. Photo upload requires a real configured account. Production builds hide preview controls even if the public demo flag is set.

The root also provides `npm run preview:mobile` after the mobile dependencies are installed.

## Connect to the real API

1. Configure the existing API's MySQL connection, Supabase URL/public key, and private storage service-role key using [the repository setup guide](../../docs/SETUP.md). Preserve existing local settings. Set `Demo:Enabled=false` for real account testing; the development API otherwise uses a demo-owner identity and is not suitable for testing mobile roles.
2. Back up an existing database and apply numbered migrations through **007** with `npm run db:migrate` from the repository root. Run `npm run db:check` afterwards. Migration 004 adds mobile tables; 005 adds resident bindings; 006 adds community workflows; 007 adds the users view preference. Do not apply the final-schema snapshot to a populated database. Coordinate resident provisioning using [the privacy rollout guide](../../docs/RESIDENT-PRIVACY.md).
3. Copy `.env.example` to `.env` **only if `.env` does not already exist**, then fill in the public API URL and Supabase URL/key. Never put the service-role key, MySQL password or other backend secrets in an `EXPO_PUBLIC_` variable.
4. Have the apartment administrator assign the account metadata described below. Sign in using that provisioned account's email and password. No self-service account creation or role assignment is implemented in the mobile app.
5. Start the API and run `npm start` in this directory. With `expo-dev-client` installed, Expo may default to a development build; use `npm run start:go` to explicitly use a matching Expo Go client. A development build is the intended production-development route.

### Physical phones and emulators

`localhost` on a phone means the phone itself, not your PC. Set the public API URL to your PC's LAN address on the same trusted Wi-Fi network. Android Studio's emulator normally uses `http://10.0.2.2:4000` to reach the host. An iOS simulator on a Mac can use that Mac's localhost; iOS native builds cannot be compiled locally on Windows.

For a physical phone, the API must listen on a reachable interface. Run this manually from the repository root after configuring real authentication:

```powershell
$env:ASPNETCORE_ENVIRONMENT = 'Development'
dotnet run --project apps/api/RepairLedger.Api.csproj --no-launch-profile -- --urls http://0.0.0.0:4000 --Demo:Enabled false
```

This exposes the development API to your local network. Use a trusted private network, keep demo authentication disabled, and stop the process when finished. No firewall changes, public tunnel, production deployment or security-setting changes are performed by this project. Native clients do not use browser CORS; real web-preview testing requires adding its exact localhost origin to the API's `Cors:Origins` setting. Do not use a wildcard.

Use HTTPS for production. Release-mode API requests reject plain HTTP. iOS development builds may require a trusted HTTPS development endpoint rather than weakening transport-security settings.

### Test on a device

```powershell
npm run start:go
# Or after installing your development build:
npm start
```

Use an Expo Go version compatible with SDK 57, or build/install a development client. `expo-dev-client` and EAS build profiles are included; configure your own Expo project, application identifiers and signing credentials before building. No APK, IPA, EAS cloud build or store submission was produced here. See [Expo's development-build guide](https://docs.expo.dev/develop/development-builds/introduction/).

## Assign resident and watchman accounts

Permissions come from server-managed **Supabase app_metadata** after the C# API validates the bearer token with Supabase Auth. The client does not assign roles. Never use editable `user_metadata` for authorization and never place an admin/service-role key in the app.

For a resident, the administrator sets metadata like:

```json
{
  "role": "tenant",
  "workspace_id": "actual_landlord_workspace_id",
  "property_ids": ["actual_mysql_property_id"],
  "property_units": { "actual_mysql_property_id": ["A-204"] },
  "resident_occupancies": [
    {
      "id": "b3a24db4-72d1-4f10-93b6-83e211f2e758",
      "property_id": "actual_mysql_property_id",
      "unit": "A-204",
      "starts_at": "2026-10-01T00:00:00Z",
      "ends_at": "2027-10-01T00:00:00Z"
    }
  ]
}
```

For a watchman:

```json
{
  "role": "watchman",
  "workspace_id": "actual_landlord_workspace_id",
  "property_ids": ["actual_mysql_property_id"]
}
```

Replace examples with exact IDs and unit labels used by the landlord's API. IDs and labels are case-sensitive. A property's name is not its ID. The workspace ID must match the property's MySQL workspace. Unassigned accounts see a setup notice and cannot report into an arbitrary building. Owners/managers can use the native Community Admin and User views; vendors use the web app. Watchmen use their assigned gate/notices/map view on web or mobile.

For residents, use a **new occupancy UUID for every period**, with actual start/end instants and explicit timezone offsets. Both the dated assignment and property/unit permissions are required. Missing, expired, future or ambiguous assignments fail closed. Private repairs require the same account, occupancy and report-date window; a matching unit never reveals a previous occupant's history. The illustrative dates/UUID above are not a provisioned account. See [the full provisioning/linking rules](../../docs/RESIDENT-PRIVACY.md). Watchmen do not need resident occupancy entries.

No new administrator account-management UI is included. Assign metadata through your already-authorized Supabase administrator workflow.

## Screens and workflows

| Role | Screen | Behaviour |
| --- | --- | --- |
| Both | Sign in | Provisioned-account sign-in, setup/error states, explicit development previews |
| Resident | Home | Open repairs, required responses, upcoming visit, quick report |
| Resident | Repairs | Apartment/shared-area switch, open/history/all filters, search |
| Resident | Report | Assigned building/apartment, problem details, hazard/priority, access arrangement, optional private photo, review and receipt |
| Resident | Repair details | Next action, both-party visit confirmation, decline, resolved/unresolved verification with a note |
| Resident | Conversation | Scoped repair messages shared with manager/assigned vendor |
| Resident | Repair history | Restricted resident-facing progress timeline; no internal audit details or actor identifiers |
| Resident | Photos | Camera/library selection, private upload, signed image viewing |
| Watchman | Visits | Confirmed visits for each building's local day, expected/on-site/left filters |
| Watchman | Gate confirmation | Manual identity-check reminder, arrival/departure confirmation, actor/time audit and revision conflict handling |
| Watchman | Shared areas | Scoped shared-area reports, search, open/history/all filters |
| Watchman | Report | Shared location, problem, severity, review and receipt; text-only in this version |
| Both | Shared report details | Status and the manager's latest public update |
| Both | Account | Assigned buildings, permission explanation, language, refresh and sign-out |
| Manager web | Property profile | Shared-area queue and revision-checked public progress/resolution updates |

Gate presence **does not authorize apartment entry**, start work, approve money, or complete repairs. Vendor identity is checked manually; there is no automated identity/visitor verification. An open gate record can be checked out even if its repair is subsequently cancelled. Only confirmed, accepted, active visits can be checked in on the appointment's building-local day.

Shared-area reports use their own table, not a fake residential unit, and do not consume apartment capacity. Residents/watchmen in assigned buildings see these reports and public manager updates; do not include private names, apartment details, key codes or documents. Only managers can change shared-area status. Full vendor/quote/attachment workflows for shared-area reports are not implemented yet.

## Language and connection behaviour

English is complete. Hindi and Tamil cover navigation and key actions; longer help text falls back to English. Dates/times use the selected locale. Reports, messages, categories and server errors are not automatically translated. Translations need native-speaker review before release. Arabic/RTL is not implemented in this mobile version.

Reads refresh on focus, pull-to-refresh, and foreground return. Writes require a connection. There is no offline write queue, background automatic retry, realtime subscription or push delivery. Common-area submissions use a UUID to avoid duplicate retries. Apartment-report timeouts require checking the list before submitting again. Failed photo uploads do not create a second repair; retry the attachment from the saved repair's details.

Native sessions use encrypted SecureStore chunks with an atomic manifest and serialized refresh/logout operations. Browser-preview sign-in is memory-only. Language preference alone is stored in AsyncStorage. Conversations, access notes, credentials and report drafts are not persisted there. Photo selection creates compressed JPEG cache files; secure device-cache lifecycle/retention testing is still required before deployment.

## Source structure

```text
src/app/                 Expo Router routes and protected navigation
src/screens/             Resident and watchman home screens
src/components/          Accessible UI, cards, confirmations and photo picker
src/providers/           Authentication and verified mobile context
src/hooks/               Cancellable reads and foreground refresh
src/lib/                 API, permissions, previews, photos, localization and secure storage
tests/                   Policy, storage, preview and dependency tests
vendor/                  Licensed URI decoder security backport
```

The backend follows the repository's Controllers → Business → DataAccess → SQLFiles structure. See [the current schema](../../docs/FINAL-SCHEMA.md) for mobile tables in migration 004 and account/occupancy binding in 005.

## Verify changes

```powershell
npm run typecheck
npm test
npm run check
npm run export
```

`export` generates web assets and Android/iOS JavaScript/Hermes bundles, not native binaries or proof of device behaviour. Backend tests are in `tests/RepairLedger.Api.Tests/MobileTests.cs`; the existing `REPAIRLEDGER_TEST_MYSQL` test connection exercises isolated generated MySQL databases.

## Before a real rollout

- Provision and test the new **account/occupancy-period authorization** before rollout. Property/unit-only accounts no longer qualify; legacy repairs remain manager/vendor-only until explicitly linked to an eligible account and period. Test turnover, returning residents, revocation and private URLs with real Supabase accounts/devices. This is not a full lease/account-administration system; see [the privacy guide](../../docs/RESIDENT-PRIVACY.md).
- Test real Supabase login/refresh/logout, private storage, camera denial, permission revocation, conflicts, timezones, background transitions, deep links, large text, screen readers and weak networks on physical Android/iOS devices.
- Resolve remaining mobile dependency advisories before rollout. The fresh 3 October 2026 audit reports **19 high package findings**, propagated through Expo/Metro and React Native tooling from two advisories: [`braces` stack exhaustion](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) and [`node-forge` signature verification](https://github.com/advisories/GHSA-86w9-cpqp-85rv). Both advisories currently list no patched version. This replaces the earlier four-finding audit result; package-level propagation does not mean 19 independent vulnerabilities. Do not run `npm audit fix --force`, which proposes incompatible Expo/React Native downgrades. No claim is made that these findings are harmless or resolved. The URI decoder is backported from upstream v0.5.0 in CommonJS format with its MIT license; xcode's UUID dependency uses a compatible patched CJS release. Remove these targeted overrides when an upstream SDK update safely resolves them.
- Define photo retention/cache cleanup, account administration and staff assignment/revocation procedures. Do not store tenant keys/codes in report text.
- Add server pagination and virtualized large histories before scaling beyond a small-portfolio pilot. Add common-area photos/full work orders, notifications and offline handling with explicit privacy/delivery policies.
- Visitor registration, parcels, resident directory, society dues, emergency dispatch, push notifications and billing are future modules, not hidden implementations in this app.

This setup guide is kept beside the source. No external Page, account or cloud project was created.

## Management views and accounts

User (1), Admin (2) and Seller / Provider (3) are selected in the fixed top-right profile menu. Ordinary members never receive an Admin option. Admins can create/edit/suspend accounts and assign buildings, tenant units and dated occupancies under People & access. Sellers manage their own products, orders, group buys and services; residents request services through User view.

`metro.config.js` extends Expo defaults to watch framework-free shared contracts; native React 19 remains separate from web React 18. Keep repository-level `shared` source available to Expo/Vercel/EAS builds. Native bundle exports passed; live-device sign-in/keyboard/accessibility still need device verification. See [the revamp and rollout](../../docs/COMMUNITYHUB-REVAMP.md).
