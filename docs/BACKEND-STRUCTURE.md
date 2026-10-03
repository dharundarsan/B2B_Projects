# Backend structure — adapted from DisprzEvaluations

RepairLedger adopts the **structural conventions** of the reference repository, not its private product logic, CoreLibrary, credentials, dependencies or company-specific APIs.
The reference checkout is read-only and retains all pre-existing changes.

## Layer layout

```text
apps/api/
  Controllers/                 thin REST controllers + response/If-Match handling
  Business/
    Interfaces/                IRepairBL, IEvidenceBL
    RepairBL.cs                workflow/authorization/input rules and dashboard
    EvidenceBL.cs              signed-upload/completion/download orchestration
  DataAccess/
    Interfaces/IRepairDAL.cs
    RepairDAL*.cs              bound queries, scoped hydration, transactions
  Models/
    Inputs/                    one request contract per file
    Repair.cs, Property.cs ...  one response/persistence model per file
  Enums/                       DatabaseConnectionType
  Helpers/
    Interfaces/                IConnectionHelper, IDapperHelper
    DbConnectionHelper.cs      provider validation + pooled connections
    DapperHelper.cs             async commands, cancellation, finite timeouts
    CommonHelper.cs             pure timezone/currency primitives
    ValidatorHelper.cs          bounded text validation
    DatabasePreflightHelper.cs metadata/permission-only CLI check
    DatabaseMigrationHelper.cs provider-aware versioned migrations
    SqlScriptHelper.cs          MySQL statement splitting for safe DDL recovery
    StartupHelper.cs            mutually exclusive check/migration/import orchestration
    DemoSeed.cs                 Development-only bootstrap
  Utils/
    Interfaces/ISqlFileQueryHelper.cs
    SqlFileQueryHelper.cs      cached embedded SQL; provider/Common resolution
  SQLFiles/
    Common/*.sql               named portable operation queries
    MySql/*.sql                JSON/search/upsert/locking dialect overrides
  DatabaseScripts/
    Common/001_initial.sql     preserved original SQLite v1 schema
    Common/002_*.sql           additive units/history migration
    MySql/001_*.sql            bounded UTF-8 keys + InnoDB native schema
    MySql/002_*.sql            normalized units/history + recovery-safe backfill
    MySql/003_*.sql            native FKs + JSON verification backfill
    Sqlite/003_*.sql           additive integrity triggers + backfill
  ExternalAPI/                 SupabaseIdentity, EvidenceStorage
  Middleware/                  sanitized failures + trusted actor resolution
  Extensions/                  DI and assembly-resource helpers
  Installers/                  IInstaller, DependenciesInstaller
  Errors/                      ApiException
  Program.cs                   configuration and HTTP pipeline only
```

## Reference-to-RepairLedger mapping

| Reference convention | Implementation |
| --- | --- |
| EvaluationController → IEvaluationBL | Requests/Properties/Vendors/etc. controllers → IRepairBL; evidence → IEvidenceBL |
| EvaluationBL → IEvaluationDAL | RepairBL → IRepairDAL; controllers do not implement workflow SQL |
| SQLFiles/PostgreSql and MsSql | SQLFiles/Common + MySql overrides. MySQL is the application database; SQLite stays an explicit test/offline option. No private CoreLibrary or SQL Server dependency. |
| SqlFileQueryHelper / assembly resources | ISqlFileQueryHelper, AssemblyExtensions.ReadResource, ConcurrentDictionary<string,Lazy<string>> |
| Dapper/config helpers from the private CoreLibrary | Local IDapperHelper + IConnectionHelper with explicit transaction/timeout/cancellation; no private binary dependency |
| ConfigureDependenciesExtensions / installer | ConfigureDependencyInjections + DependenciesInstaller + InstallServicesInAssembly |
| Models / interfaces / errors / enums | Matching folders, small named contracts/models and explicit interfaces |

GetSqlQuery resolves a provider-specific resource first, then Common. ExecuteQuery provides the reference-style callback form; both share the same cache.
Only trusted DAL-built predicate fragments are substituted in query templates. Neither filenames nor SQL fragments are accepted from HTTP callers.

## Practices deliberately improved

- Missing resource errors are explicit; no null-forgiving resource streams.
- HTTP uses bounded async HttpClient calls, not synchronous Result/GetAwaiter blocking.
- System.Text.Json is the single HTTP serializer, with typed record inputs and constructor-parameter DataAnnotations.
- Controllers preserve the frontend's REST URLs and response envelopes instead of copying the reference's product-specific RPC routes.
- Scoped connections and transaction ownership are explicit. No singleton shared open connection.
- Async commands always retain cancellation and a finite timeout (Database:CommandTimeoutSeconds, default 30, valid 1–120).
- Supabase tokens are verified, and trusted app metadata supplies actor/workspace/role.
- Revision checks, atomic repair/import DML rollback and database-enforced workspace/property relationships remain intact. MySQL DDL commits independently and uses guarded/checksummed recovery.
- SQL and migrations are embedded in the compiled API, so Docker/publish output does not depend on source-directory paths.
- Repair mutations persist only newly appended/changed child records, instead of re-upserting all historical events, quotes, visits and evidence on each action.
- Production does not auto-migrate by default; startup/readiness checks the expected schema version.
- No unnecessary AutoMapper, EF, company caching framework or SQL Server dependency was added.

Read [FINAL-SCHEMA.md](FINAL-SCHEMA.md) for the complete implemented table dictionary and limitations.
