# RepairLedger web and mobile source handoff

This source snapshot contains the web application, resident and watchman mobile application, and their shared C# backend. It preserves the current `0.1.0` package versions. It is a verified development handoff, not a production deployment or an app-store release.

## What is included

| Folder | Project |
| --- | --- |
| `apps/web` | React and TypeScript web app for managers, residents and vendors |
| `apps/mobile` | React Native and Expo app for residents and watchmen |
| `apps/api` | ASP.NET Core 10 API with Dapper, raw SQL and MySQL 8.4 |
| `tests` | Backend workflow, database, authorization and migration tests |
| `docs/schema` | Final schema snapshots; use numbered migrations for existing databases |
| `docs/ui-review` and `docs/mobile-ui` | Actual synthetic-data UI screenshots |
| `scripts` | Node checks, API commands, HTTP tests and source packaging |

The ZIP includes source, dependency lockfiles, configuration examples and documentation. It excludes installed dependencies, generated builds, SDKs, local databases, private `.env` files and private Local settings. No existing customer data or credentials are transferred. The C# API uses MySQL; Supabase supplies Auth and private Storage, not the maintenance database.

## Extract and install

Extract the ZIP into a **new directory**, not over your existing project. Enter the extracted `RepairLedger-app-source` directory before running the following commands.

Install Node.js 22.6 or newer, the .NET 10 SDK, and MySQL 8.4 LTS. The working checkout was tested with Node 24. The archive does not include the checkout's `.tools` runtimes: use your installed `dotnet` for direct SDK commands.

```powershell
npm ci
npm --prefix apps/mobile ci
```

The web and mobile dependencies are deliberately installed separately. React 19 in mobile does not upgrade the React 18 web workspace. Neither project requires pnpm.

## Run the web application

Configure a dedicated MySQL database using [the setup guide](docs/SETUP.md). Copy `apps/api/appsettings.MySqlDevelopment.example.json` to `apps/api/appsettings.Local.json` only when no Local file exists, then enter your own credentials privately. Do not point demo configuration at a populated production database.

```powershell
npm run db:check
# Only for a new empty database or an approved, backed-up installation:
npm run db:migrate
npm run db:check
npm run dev
```

An empty, unmigrated database returns exit 2 from the first check. Start only after the final check succeeds. Web: `http://localhost:5173`; API: `http://localhost:4000`. Missing credentials return a setup error; there is no silent fallback to a different database. Development demo mode uses synthetic manager/resident/vendor flows.

For real accounts, disable demo mode in both the API and web configuration and supply the public Supabase settings in `apps/web/.env`. See [setup](docs/SETUP.md) for trusted account metadata and exact CORS origins.

## Preview and run the mobile application

The browser preview works without a running API or credentials:

```powershell
npm run preview:mobile
```

Choose **Preview resident app** or **Preview watchman app** at the address Expo prints. The explicitly marked preview uses temporary sample data; it does not grant backend permissions or upload photos.

For a physical phone, follow [the mobile setup guide](apps/mobile/README.md), configure `apps/mobile/.env` from its example, and provision trusted role/building assignments plus dated resident occupancies. Use your PC's reachable LAN API address, not phone `localhost`, with demo authentication disabled. Apply migrations through **005**. After configuring a compatible Expo Go client or development build:

```powershell
npm --prefix apps/mobile run start:go
# For your installed development client instead:
npm run dev:mobile
```

Watchmen can track confirmed vendor arrival/departure and shared-area reports. They cannot access resident conversations, access notes, repair costs or manager approvals. Recording gate presence does not authorize apartment entry or complete a repair.

## Verification

The original 3 October 2026 source handoff pass completed the following checks, before the privacy increment documented below:

| Check | Result |
| --- | --- |
| Web TypeScript and Vite build | Passed |
| C# Release build | Passed with zero compiler warnings and errors |
| Web policy tests | 52 passed |
| Node command tests | 5 passed |
| Mobile TypeScript and dependency compatibility | Passed |
| Mobile policy, storage and dependency tests | 15 passed |
| Android, iOS and web JavaScript export | Passed; not APK or IPA files |
| Backend regression tests with isolated SQLite | 107 passed |
| Isolated HTTP smoke | 32 checks passed |
| Root web npm dependency audit | Zero findings reported |
| Mobile npm dependency audit | 19 high package findings remain; release blocker described below |

The preceding mobile implementation also passed all 107 backend tests against an isolated MySQL 8.4.11 server. That MySQL run is separate from this handoff's SQLite regression run; no production MySQL connection or live Supabase service is claimed. The earlier browser walkthrough used synthetic data and verified reporting, resident responses, conversations, language selection and watchman gate actions.

### Current Git-checkout privacy increment — 3 October 2026

The main checkout now contains schema **005**: account/occupancy-specific private repair access, resident response allowlisting, revision-checked immutable manager linking, shared server-authorized web/native apartment choices and account-scoped memory-only web drafts. Missing or expired assignments get an explicit setup notice. Existing records are retained without automatic resident links. Follow [the provisioning and rollout guide](docs/RESIDENT-PRIVACY.md) before using real accounts.

| Check | Completed result |
| --- | --- |
| Latest backend regression suite, isolated SQLite | 129 passed |
| Privacy/migration/workflow suite, isolated MySQL 8.4.11 | 128 passed; fresh generated test schemas, no existing service/customer database |
| Web policy tests | 60 passed |
| Root command tests | 5 passed |
| Web TypeScript and production builds | Passed with synthetic build-only public configuration and with the unconfigured setup gate |
| Mobile TypeScript and policy/storage tests | Passed; 15 tests |
| Latest isolated HTTP workflow | 38 checks passed, including link validation, revisions, immutability and OpenAPI |

The additional first-report-specific regression and the final safe approval-status presentation checks ran after the MySQL run; they passed in the latest SQLite/web suites, not as additional MySQL tests. Supabase verification uses a test HTTP handler for authorization cases, not a live account. No new native binary/export, production load test or real Supabase/storage/device validation was performed for this increment. A local browser-preview launch was blocked by the host, so the new screens have compile/policy coverage and source review, **not** a completed visual walkthrough.

These changes are in the Git working copy only. Previously generated source ZIPs are not refreshed. No changes are committed/pushed automatically, no configured database was migrated and no account metadata was edited. The existing lease/account-administration, file retention, notifications, pagination, dependency-audit and device-testing limitations still apply.

To repeat checks from the extracted root:

```powershell
npm run build
npm run test:web
npm run test:scripts
npm run typecheck:mobile
npm run test:mobile
dotnet test tests/RepairLedger.Api.Tests/RepairLedger.Api.Tests.csproj -c Release
pwsh -File scripts/test-api.ps1
npm --prefix apps/mobile run check
npm --prefix apps/mobile run export
```

`pwsh` is PowerShell 7. The HTTP test uses an isolated synthetic database, not your Local database. MySQL integration tests require their own isolated test-server configuration; see [setup](docs/SETUP.md).

## Deployment and remaining work

Vercel configuration is provided for the web frontend. Build it with your public production API/Supabase settings. Host the C# API separately using its Dockerfile or a .NET host, with a MySQL service and private backend secrets. This handoff does not create accounts, deploy services, apply migrations to your data, or sign native binaries.

Before using real tenants, apply schema 005 and provision/test the implemented account/occupancy-period policy using [the privacy rollout guide](docs/RESIDENT-PRIVACY.md). Property/unit-only resident metadata is no longer sufficient. Existing repairs stay unlinked until a manager independently verifies an eligible account/period and explicitly links them. Complete real Supabase, private-photo and physical-device testing; define photo retention and staff assignment/revocation. A full lease/account-management UI and household sharing are not included.

The fresh mobile audit reports 19 high package findings propagated from [`braces`](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) and [`node-forge`](https://github.com/advisories/GHSA-86w9-cpqp-85rv) through the Expo/Metro/React Native dependency graph. Both advisory pages currently list no patched release. These are unresolved release checks, not 19 independently confirmed application exploits or a clean audit. Keep the development toolchain on a trusted network; reassess with compatible upstream fixes before rollout. Do not force incompatible framework downgrades to silence npm audit.

English is complete. Mobile Hindi and Tamil cover navigation/key actions, not every help paragraph or user message. Shared-area reporting is text-only. Push notifications, offline write queues, visitor registration, parcels, society dues and payments are not implemented. These are documented limitations, not working features hidden behind placeholders.

For the full screen/workflow descriptions, read [the mobile guide](apps/mobile/README.md), [product and UI review](docs/PRODUCT-AND-UI-REVIEW.md), and [schema documentation](docs/FINAL-SCHEMA.md).
