# RepairLedger
One B2B apartment-maintenance project with a React + TypeScript web app, a React Native resident/watchman app, and a shared ASP.NET Core 10 API. The backend uses Dapper raw SQL and MySQL 8.4; Supabase provides Auth and private Storage.

This is the main working copy under `D:\B2B\RepairLedger-Web-and-Mobile-Final\RepairLedger-app-source`. Run root commands here, not from the older source copies or the parent extraction folder.

```text
RepairLedger-app-source/
├── apps/
│   ├── web/         React web application
│   ├── mobile/      React Native and Expo application
│   └── api/         C# API, Dapper queries and migrations
├── tests/           Backend regression tests
├── scripts/         Development, database and packaging commands
└── docs/            Setup, schema, product review and UI screenshots
```

For the combined web/mobile source snapshot, installation order, verification results and release limitations, start with [the final handoff guide](FINAL-HANDOFF.md).

A separate [React Native mobile app](apps/mobile/README.md) now supports apartment residents and watchmen. Install its dependencies in `apps/mobile`; it does not replace or upgrade the web app's React workspace. Run `npm run preview:mobile` for local sample-data previews or `npm run dev:mobile` for the configured app. Apply migrations through **005** for live operations (004 adds mobile tables; 005 adds resident privacy).

Resident access now requires an account-specific, dated occupancy assignment, not just a unit label. Existing repairs remain unlinked until a manager explicitly links an eligible account and period. Read [the resident provisioning and rollout guide](docs/RESIDENT-PRIVACY.md) before enabling real resident accounts; property/unit-only metadata is no longer sufficient.

## Run on Windows
Requirements: Node.js 22.6+ with npm (Node 24 was tested), the .NET 10 SDK, and MySQL 8.4 LTS. Install the SDK on your machine; this extracted source does not contain `.tools`. The npm scripts use an optional private `.tools/dotnet` SDK only when present, otherwise your installed `dotnet`.

```powershell
cd D:\B2B\RepairLedger-Web-and-Mobile-Final\RepairLedger-app-source
npm ci
npm --prefix apps/mobile ci
# Configure MySQL privately using docs/SETUP.md, then:
npm run db:check
# Only for a new empty database or an approved backed-up installation:
npm run db:migrate
npm run db:check
npm run dev
```
Open http://localhost:5173. The API runs on http://localhost:4000.
Development and Production use MySQL. Create a database and configure `apps/api/appsettings.Local.json` from [the MySQL development example](apps/api/appsettings.MySqlDevelopment.example.json) before running. Existing Local settings override defaults; preserve your other settings. See [setup](docs/SETUP.md). SQLite remains an explicit test/offline option; existing local files are preserved.

## Preview the mobile app

After installing the separate mobile dependencies, run `npm run preview:mobile` from the root. Choose the resident or watchman preview at the address Expo prints; sample-data preview does not require a configured API. For real accounts and phone access, follow [the mobile setup guide](apps/mobile/README.md).

## Git and GitHub

This working copy has repository-local personal commit identity and a separate Git Credential Manager namespace. Global work settings and GitHub CLI sign-in have not been changed. Commit identity is separate from the GitHub account used to push; account/remote setup is described in [the Git setup guide](docs/GIT-SETUP.md). Local Git settings are not committed and do not automatically transfer to a fresh clone.

## Commands

- `npm run db:check` — non-mutating MySQL connection/schema/SELECT preflight (exit 0 ready, 1 error, 2 not ready).
- `npm run db:migrate` — explicitly apply MySQL migrations; no demo seeding or HTTP server.
- `npm run test:scripts` — command-wrapper tests.
- `npm run test:web` — frontend queue, visit, resident-response and money policy tests (Node 22.6+; verified with Node 24).
- `npm run dev:web` — Vite frontend.
- `npm run dev:api` — C# API with hot reload.
- `npm run build` — frontend and Release API build.
- `npm run typecheck` — TypeScript check and C# compilation.
- `dotnet test tests/RepairLedger.Api.Tests/RepairLedger.Api.Tests.csproj` — workflow/database tests.
- `npm start` — built frontend preview + API (requires production database/auth configuration).

For a local demo of the Release API, set `$env:ASPNETCORE_ENVIRONMENT="Development"` before `npm start`.

## Structure

- `apps/api/Controllers` — REST endpoints and response/ETag handling.
- `apps/api/Business` and `Interfaces` — workflow, authorization and validation rules.
- `apps/api/DataAccess` and `Interfaces` — scoped Dapper queries and transactions.
- `apps/api/SQLFiles` — cached embedded SQL operation resources.
- `apps/api/DatabaseScripts` — additive provider-aware schema migrations.
- `apps/api/Models` and `Inputs` — individual models and request DTOs.
- `apps/api/Helpers`, `Utils`, `Installers`, `Extensions` — connection/Dapper/resource helpers and DI.
- `apps/api/ExternalAPI` and `Middleware` — Supabase clients, authentication and sanitized errors.
- `apps/web/src/components`, `hooks`, `api.ts` — reusable UI, cancellable reads, typed API boundary.
- `tests/RepairLedger.Api.Tests` — transaction, access-control, workflow and migration coverage.

## Production

Use MySQL 8.4 LTS. Supabase is used for Auth and private Storage, not MySQL hosting. Configure secrets in environment variables or .NET user-secrets, never Vite variables. See [setup](docs/SETUP.md).
Deploy the frontend to Vercel with `VITE_API_URL=https://your-api-host`. Deploy the C# API separately on a container/.NET host. The old Node Vercel function has been removed: there is no official Vercel ASP.NET Core runtime.
Build the backend container from the repository root:
`docker build -f apps/api/Dockerfile -t repairledger-api .`

Existing MongoDB data is NOT deleted or automatically changed. See [SQL migration](docs/SQL-MIGRATION.md) before switching a populated production installation.

The backend follows the controller/BL/DAL/helper conventions of the referenced DisprzEvaluations project.
See [backend structure](docs/BACKEND-STRUCTURE.md), [finalized schema](docs/FINAL-SCHEMA.md) and [full MySQL DDL](docs/schema/RepairLedger-Final-MySql.sql).
See [product and UI review](docs/PRODUCT-AND-UI-REVIEW.md) for competitor evidence, implemented screens, actual screenshots and the prioritized pilot roadmap.
After a Release build, `pwsh -File scripts/test-api.ps1` tests the HTTP flow with an isolated temporary database.
