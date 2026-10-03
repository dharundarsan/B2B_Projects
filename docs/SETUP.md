# Setup — C# / Dapper / MySQL

## Local development

Requirements: Node.js 22.6+ with npm, the installed .NET 10 SDK, and MySQL **8.4 LTS** (not MariaDB). This extracted source does not include a private SDK. The API does not read the retired Node .env file.

1. Create an empty database with a MySQL administrator:
   CREATE DATABASE repairledger CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
2. Create a dedicated local database user and grant it migration rights on repairledger only. Do not use a production/root credential as the deployed app account.
3. Copy apps/api/appsettings.MySqlDevelopment.example.json to apps/api/appsettings.Local.json **only if no Local file already exists**. If it exists, edit just its Database settings and preserve your Supabase/CORS settings. Fill in your server, port, database, user and password privately.
4. From the main project root, D:\B2B\RepairLedger-Web-and-Mobile-Final\RepairLedger-app-source, run npm ci, then npm run db:check. Missing configuration/connection errors return exit 1. A new empty database returns exit 2 (not migrated yet).
5. Only for your new empty database or a reviewed existing installation, run npm run db:migrate with the migration credential. Re-run npm run db:check; exit 0 means the metadata/read checks passed. Then run npm run dev.
6. Open http://localhost:5173; API: http://localhost:4000.

Development now defaults to MySql, with no fake/default password. Database:AutoMigrate=true applies the MySQL schema; an empty demo workspace receives synthetic records when Demo:Enabled=true. Data persists in your configured MySQL database.

SslMode=Disabled in the development example is for a local loopback MySQL server only. Use VerifyFull for remote databases. Existing appsettings.Local.json overrides defaults: replace any previous Postgres or implicit SQLite setting intentionally. Your old SQLite file is preserved, not imported automatically.

For explicit SQLite-only offline testing, set Database:Provider=Sqlite and Database:ConnectionString=Data Source=repairledger.local.db;Foreign Keys=True in Development. SQLite is not the default or production provider.

To use real auth locally, set Demo:Enabled=false, configure Supabase in the API, and set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and VITE_REPAIRLEDGER_DEMO_MODE=false in apps/web/.env. The API and frontend must agree about demo mode.

## Production configuration

ASP.NET environment variables use double underscores:

```text
ASPNETCORE_ENVIRONMENT=Production
ASPNETCORE_URLS=http://+:8080
Database__Provider=MySql
Database__ConnectionString=Server=your-mysql-host;Port=3306;Database=repairledger;User ID=repairledger_app;Password=your-secret;SslMode=VerifyFull;Connection Timeout=15;Default Command Timeout=30
Database__AutoMigrate=false
Demo__Enabled=false
Supabase__Url=https://your-project.supabase.co
Supabase__PublicKey=your-publishable-or-anon-key
Supabase__ServiceRoleKey=your-server-only-service-role-key
Supabase__EvidenceBucket=repair-evidence
Cors__Origins__0=https://your-frontend.vercel.app
```

Use a MySQL host of your choice; Supabase remains **Auth + private Storage only**, not the application's MySQL host. No direct Supabase Data API path is used for maintenance records. Keep database credentials/service-role keys on the API host, never in Vite variables or version control.

Use a separate migration account with CREATE/ALTER/INDEX/REFERENCES plus the DML permissions needed for backfill. Runtime needs SELECT on schema_migrations and SELECT/INSERT/UPDATE on application tables; it does not need database-create, DROP, ALTER or DELETE rights. Grant permissions only within the dedicated database.

The API enforces MySQL plus SslMode=VerifyFull outside Development. Supply the correct CA via SslCa when your provider requires it. Certificate and hostname validation are documented by [MySqlConnector](https://mysqlconnector.net/connection-options/).

Before serving production, inject the migration credential and run:

```powershell
dotnet run --project apps/api/RepairLedger.Api.csproj --no-launch-profile -- --migrate-only true
```

Then deploy with the runtime credential and AutoMigrate=false. Do not run the application with the migration account indefinitely.

## Migration safety

Current schema version: **5**. Embedded MySQL migrations live under apps/api/DatabaseScripts/MySql. Migration 004 adds gate presence and common-area operations; 005 adds the paired resident account/occupancy binding and access index. Existing repairs are not automatically linked. Coordinate account provisioning and deployment using [the resident privacy guide](RESIDENT-PRIVACY.md). Use new numbered migrations for future changes; never edit an applied migration.

MySQL DDL [implicitly commits](https://dev.mysql.com/doc/refman/8.4/en/implicit-commit.html). The runner therefore takes a database-specific GET_LOCK on one session, records a SHA-256 checksum and completed flag, and completes the version only after every statement succeeds. Interrupted runs remain unready and may retry the **same unchanged** migration: CREATE TABLE IF NOT EXISTS, guarded ALTER statements and insert-only backfills permit recovery. DDL is not rolled back when a later step fails. Back up real data and schedule a maintenance window.

This recovery mechanism is for the owned scripts, not arbitrary SQL or manual drift. Do not hand-edit tables during a failed migration. Investigate the failure; restore from backup when necessary. The statement splitter supports quotes/comments, not DELIMITER or stored procedures.

Database__CommandTimeoutSeconds optionally sets the Dapper timeout (default 30, allowed 1–120). Connections are pooled/reset and disposed per operation; user variables and LOCAL INFILE are disabled. UseAffectedRows=false keeps no-op locking updates distinguishable from missing rows.

## Database setup commands

- npm run db:check — reads server/schema metadata and validates SELECT access with a WHERE 1=0 query. Does not migrate, import, seed, create a SQLite fallback or start HTTP.
- npm run db:migrate — explicitly applies the versioned MySQL migrations and exits before demo seeding/HTTP.
- npm run test:scripts — tests backend command/environment selection without a database.

db:check exit codes:

| Exit | Meaning | Next action |
| --- | --- | --- |
| 0 | Schema version 5, required InnoDB tables, tracking columns, strict mode and SELECT access passed | Start the app; independently verify auth/storage, resident provisioning and runtime write grants. |
| 1 | Configuration, connection, TLS or permission check failed | Fix the settings privately. The command does not print raw connector errors or credentials. |
| 2 | Connected, but schema/server settings are not ready | For a new empty database, apply migrations. For populated/incomplete installations, back up and investigate first. |

Metadata comes from [MySQL INFORMATION_SCHEMA](https://dev.mysql.com/doc/refman/8.4/en/information-schema-tables-table.html). The check expects STRICT_TRANS_TABLES or STRICT_ALL_TABLES; [strict mode](https://dev.mysql.com/doc/refman/8.4/en/faqs-sql-modes.html) controls server-side data validation. It does not change server settings.

This is a setup preflight, not a full schema-integrity/security audit. It does not validate every column/index/FK definition, certify another MySQL version, prove INSERT/UPDATE permissions, inspect customer rows, or connect Supabase. Target runtime remains MySQL 8.4 LTS. Do not infer a real production connection from the isolated tests.

The npm database utilities default to Development only when neither ASPNETCORE_ENVIRONMENT nor DOTNET_ENVIRONMENT is set. They preserve explicit Production/Staging settings. For production, explicitly set ASPNETCORE_ENVIRONMENT=Production and provide VerifyFull TLS credentials before running; the utility does not disable production TLS policy.

Do not combine --check-database with --migrate-only or --import. Conflicting modes fail before connecting. A read-only check forces AutoMigrate=false for that invocation even when Development configuration normally enables migration.

After credentials are configured and the database has been created:

~~~powershell
npm run db:check
# If exit 2 is solely because your NEW database is empty:
npm run db:migrate
npm run db:check
# Start only after checks succeed:
npm run dev
~~~

Never run db:migrate blindly to fix an unknown populated schema. Existing PostgreSQL/SQLite/Mongo data is not transferred by these commands.

## Supabase identity

Tokens are verified through Supabase Auth's user endpoint with bounded HTTP timeouts. Only trusted app_metadata controls authorization:

- role: owner, manager, tenant, vendor, watchman.
- workspace_id: organization ID; defaults to the authenticated user ID.
- vendor_id: assigned-job access for vendors.
- property_ids and property_units: tenants' exact authorized properties/labels.
- resident_occupancies: tenants' dated occupancy UUIDs, property IDs, unit labels, starts_at and optional ends_at. Active occupancy and property/unit permission are both required; use a new UUID per period.
- property_ids: watchmen's assigned buildings; gate/shared-area access only, never full resident repairs. See the mobile guide for account examples.

Set metadata through trusted admin tooling, never editable user_metadata. Unknown roles fail closed. Resident reads additionally require the repair's account/occupancy binding and a report date within that active period. Old property/unit-only accounts fail closed. Manager linking validates UUID format, not account existence; independently verify provisioning before linking. See [RESIDENT-PRIVACY.md](RESIDENT-PRIVACY.md) for metadata, legacy-record handling and turnover tests. No administrator account/lease UI is included.

## Evidence

Use a PRIVATE repair-evidence bucket, with a 20 MB object cap and allowed JPEG/PNG/WebP/GIF/MP4/MOV/PDF types. Browser uploads use server-signed URLs; completion verifies stored size/MIME, and download links expire after 15 minutes. Storage-unconfigured requests fail explicitly.

Metadata is not malware inspection: scanning/file-signature validation and stale-upload retention remain deployment work.

## Deployment

Vercel builds the React frontend only. Set VITE_API_URL to the HTTPS API; Vite variables are build-time settings. Deploy the C# Docker image on Azure Container Apps/App Service or another .NET/container host. MySQL runs separately, preferably over a private network. Do not expose Kestrel's plain HTTP port publicly.

Configure exact CORS origins and ingress rate limits. Health: GET /api/health; database readiness: GET /api/health/ready; development OpenAPI: GET /openapi/v1.json.

## Verification

```powershell
npm run typecheck
npm run build
dotnet test tests/RepairLedger.Api.Tests/RepairLedger.Api.Tests.csproj -c Release
pwsh -File scripts/test-api.ps1
```

Without REPAIRLEDGER_TEST_MYSQL, tests use isolated temporary SQLite files. For MySQL coverage, set REPAIRLEDGER_TEST_MYSQL to an **isolated test server** connection whose user can create/drop generated rl_test_<uuid> databases. Each test creates and removes only its own database. Never use production credentials/server for this suite.

HTTP smoke defaults to an isolated SQLite file. For MySQL, first create an empty disposable rl_smoke_<32-hex-uuid> database and set REPAIRLEDGER_SMOKE_MYSQL to its connection string. The script refuses other names, seeds synthetic demo data, and stops only its own API. It does not create/drop that database; remove it yourself after testing. Never provide a real/user database.

Existing Mongo/PostgreSQL/SQLite records are not copied by changing provider; see [migration](SQL-MIGRATION.md).
