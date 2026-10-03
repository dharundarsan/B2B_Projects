# Move existing MongoDB records to SQL
The backend migration does not delete your Mongo database or copy it without your approval/configuration. Preserve a Mongo backup before cutover.

1. Pause writes to the OLD API and back up MongoDB. Keep the old deployment available for rollback until verification finishes.
2. Install MongoDB's `mongosh` client. From this repository export the existing Mongoose collections with the read-only script:
   `mongosh --quiet "$env:MONGODB_URI" --file scripts/export-mongo.js | Out-File -Encoding utf8 migration-export.json`
   This file contains personal data: keep it outside version control and shared artifacts.
3. Inspect the export. Records without workspace IDs, unmatched properties, duplicate quote versions, missing vendors or incompatible states must be resolved deliberately. The exporter refuses missing ownership/property references. It never guesses an owner or creates a placeholder property.
4. Configure a NEW empty MySQL 8.4 LTS database in the C# API configuration. Run `dotnet run --project apps/api/RepairLedger.Api.csproj --no-launch-profile -- --migrate-only true` with a schema-owner credential.
5. Import using a database write credential:
   `dotnet run --project apps/api/RepairLedger.Api.csproj --no-launch-profile -- --import D:\secure-backups\migration-export.json`
   Use Production configuration, Demo disabled. Import is one transaction across the complete snapshot, insert-only. A duplicate or broken foreign key aborts all writes. It does not merge or overwrite existing records. Do not point it at the seeded local demo DB.
6. Compare per-workspace counts, request/quote totals, histories, vendor links, resident unit permissions and storage links with the original. Test owner, tenant and vendor accounts before cutover. The importer exits without serving HTTP.
7. Point `VITE_API_URL` at the new HTTPS API, rebuild/deploy the frontend, and switch the runtime to a least-privileged DB credential. Monitor errors and readiness.

Export assumptions: Mongoose collection names are `repairproperties`, `repairvendors`, `repairrequests`, `repairmessages`, `repairnotifications`. Adapt the script if your old Mongo deployment renamed them. Missing property IDs are resolved only by exact matching names within the same workspace; missing records stop export/import.

The exporter combines the old latest quote/visit fields with their history arrays and scopes reused demo event IDs by repair. Human-readable legacy event times cannot reliably recover an exact timestamp: their original label is retained in the detail and the record's stored creation time is used for deterministic ordering. Review these records during migration. Supabase object paths are preserved; files are not copied or deleted.

Rollback: restore the old API endpoint and frontend deployment while investigating. Any writes accepted by the new API after cutover must be reconciled before switching back; never assume two databases synchronize automatically.

Schema version 3 also creates a workspace root, normalized unit/request links, vendor-offer snapshots, verification history and actor-specific inbox reads during import. Units are registered only from actual repair labels; fix inconsistent property capacity in the export if import rejects it. Unknown historical offer actors/times and quote vendor ownership are not invented. Review legacy quote currency, which defaults to USD, before financial use. See [the final schema](FINAL-SCHEMA.md).


## Existing PostgreSQL or SQLite data

Changing Database:Provider does not copy records or convert a PostgreSQL SQL dump to MySQL. Existing databases/files are untouched. Do not run MySQL DDL against another provider or point the insert-only importer at seeded data.

For populated PostgreSQL/SQLite installations: back up the source, freeze writes, export a reviewed canonical MigrationSnapshot (workspaces/properties/vendors/repairs/messages/notifications), validate IDs/UTF-8 text lengths, quote currencies/ownership, ISO timestamps, JSON and history, then import into an empty migrated MySQL database with the existing --import command. Compare counts, money totals, actor/unit permissions and evidence paths before switching the API. A source exporter for PostgreSQL/SQLite is not implemented in this change; do not claim automatic cutover. Keep source backups for rollback and reconcile any writes made after cutover.
