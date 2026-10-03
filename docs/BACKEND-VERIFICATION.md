# MySQL migration verification — 2 October 2026

Implemented in D:\B2B\RepairLedger-app-source: MySQL 8.4 LTS replaces PostgreSQL/Npgsql for the C# / Dapper backend. React API contracts and Supabase Auth/private Storage remain intact. MySQL is the development/production default; SQLite is explicit offline/test only.

| Check | Result |
| --- | --- |
| Release C# build | Passed, zero compiler warnings/errors |
| npm run typecheck | Passed TypeScript + C# |
| npm run build | Passed Vite + Release API |
| MySQL integration/unit suite | 38 passed, 0 failed |
| SQLite regression suite | 38 passed, 0 failed; MySQL-only migration cases are conditional no-ops in this run |
| MySQL HTTP smoke | 26 checks passed |
| SQLite HTTP smoke | 26 checks passed |
| MySQL v1 upgrade | Repair IDs/revision/state retained; units/offers/verification backfilled; repeat run idempotent |
| Interrupted MySQL migrations | Partly committed v2 columns/unique key and v3 foreign keys safely resumed |
| Changed migration checksum | Rejected; line-ending normalization tested for Windows/Linux builds |
| Final MySQL schema SQL | Executed in an empty isolated database and used for API reads/writes |
| Native data constraints | Cross-property/workspace links, incorrect money totals, duplicate active offers and duplicate long evidence paths rejected |
| MySQL Unicode / literal search | Emoji/JSON, non-ASCII case folding, percent/underscore search and 254-character actor email passed |
| NuGet vulnerability audit | No vulnerable packages reported by configured nuget.org source |

A separate portable MySQL **8.4.11** server was initialized for testing only, bound to 127.0.0.1:13306, without a Windows service. Tests used generated rl_test_<uuid> databases; HTTP smoke used generated rl_smoke_<uuid> databases. Temporary synthetic databases were removed and the owned test server was stopped. No user database, Supabase deployment, existing SQLite file or private local configuration was migrated/modified.

For local fixture speed only, the temporary server used relaxed log-flush settings during part of the run. Do not copy those settings to production. Recovery tests simulate partially completed DDL; they are not an operating-system/power-loss durability certification.

The suite exercises the repair lifecycle, quote revisions/currency/ownership, vendor decision history, visit confirmations/DST, resident verification/reopen history, workspace/unit/vendor authorization, stale/concurrent revision conflicts, atomic rollback, per-manager read receipts, insert-only import, SQL resource caching, and mocked Supabase identity/storage validation.

HTTP smoke also covers MVC validation, response envelopes/ETags, properties/units/vendors, dashboard/messages, OpenAPI and explicit failure when Storage is unconfigured. It clears Supabase credentials in its child API so tests cannot call a real Storage service.

Run again:

```powershell
cd D:\B2B\RepairLedger-app-source
npm run build
.\.tools\dotnet\dotnet.exe test tests/RepairLedger.Api.Tests/RepairLedger.Api.Tests.csproj -c Release
pwsh -File scripts/test-api.ps1
```

Set REPAIRLEDGER_TEST_MYSQL to an isolated test server connection with permission to create/drop generated test databases for MySQL coverage. Never use production credentials/server. See [setup](SETUP.md) for the optional disposable MySQL HTTP smoke database.

Not verified: real production TLS handshake/credentials, live Supabase Auth/Storage, real PostgreSQL/SQLite/Mongo data transfer, production load, tenant-turnover/lease-period privacy, email/SMS delivery, payments/invoices or full translations. Production TLS policy is configuration-tested, not a claim that your deployment has been connected.


## Setup continuation — 2 October 2026

Added explicit npm db:check / db:migrate commands and a read-only MySQL preflight. Missing configuration is reported with exit 1; a connected but missing/incomplete schema returns 2; successful metadata/SELECT checks return 0. No Local credential file was created.

- C# regression/unit suite: 53 passed (38 original + 15 command/readiness cases).
- Node command-wrapper suite: 5 passed.
- Frontend/API typecheck and production builds: passed; C# compiler had zero warnings/errors.
- HTTP smoke regression: 26 checks passed each against MySQL and SQLite after the command-mode changes.
- Isolated MySQL CLI verification: empty database stayed empty despite AutoMigrate=true; explicit migration created versions 1–3 without demo records; ready/incomplete checks returned 0/2 without changing tracking rows.
- Failed authentication: exit 1 with neither the synthetic username nor password printed to CLI output.
- All temporary synthetic databases were removed and the owned test server was stopped. Existing local SQLite data was unchanged.
- Previous full MySQL 38-test result above remains the baseline for unchanged repair workflows. The additional C# command-policy tests use synthetic configuration; they do not claim your production server was connected.

See SETUP.md for the safe run order and command limitations.

## Competitor-informed operations/UI increment — 2 October 2026

- Added C# attention/confirmed-today semantics and additive dashboard fields without changing SQL, schema, provider, mutation permissions or the full-requests response contract.
- C# Release regression/unit suite: 92 passed, including 39 new queue/count/timezone cases. This local run does not claim a new live MySQL integration run; earlier MySQL baselines above remain separate.
- Frontend operation/money/resident-response suite: 52 passed; command-wrapper suite: five passed.
- Expanded isolated SQLite HTTP smoke: 32 checks passed, including queue transitions through report, offer, quote, visit, verification and closure.
- TypeScript check, frontend build and Release C# build passed. Browser-tested manager, resident and vendor flows with synthetic data; checked responsive layouts at 390px/320px, filter cancel/apply, focus trapping/restoration and Arabic navigation RTL.
- Browser fixture writes used `.tools/repairledger-ui-review.db` only. Existing `apps/api/repairledger.local.db` remained 135,168 bytes with its pre-review timestamp; no private Local configuration was created.
- Production MySQL credentials/TLS, live Supabase, tenant-turnover privacy, delivered email/SMS, full translations and invoice/payment processing remain unverified or unimplemented as described in the [product/UI review](PRODUCT-AND-UI-REVIEW.md).
