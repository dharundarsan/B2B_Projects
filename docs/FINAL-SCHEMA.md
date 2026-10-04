# CommunityHub — finalized schema (version 9)

This document describes the schema implemented in the C# API, not a proposed future schema.
Development and Production use MySQL 8.4 LTS / InnoDB. SQLite is an explicit offline/test provider. Supabase is used only for Auth/private Storage.
There are **47 application tables plus `schema_migrations`**. Migration 007 adds `users` for the persisted account view; see [ADMIN-AND-USER-VIEWS.md](ADMIN-AND-USER-VIEWS.md). Migration 008 extends users for managed permissions and adds user_memberships, user_admin_audit, community_services and community_service_requests; see [COMMUNITYHUB-REVAMP.md](COMMUNITYHUB-REVAMP.md). The 20 community tables added by migration 006 are described in [COMMUNITY-PLATFORM.md](COMMUNITY-PLATFORM.md); the maintenance tables below retain their existing shape.

- Full production DDL: [RepairLedger-Final-MySql.sql](schema/RepairLedger-Final-MySql.sql).
- Existing installations: run the embedded migrations under `apps/api/DatabaseScripts`; never run the final-schema snapshot against populated data.
- Architecture and reference-project mapping: [BACKEND-STRUCTURE.md](BACKEND-STRUCTURE.md).
- Startup/deployment configuration: [SETUP.md](SETUP.md).
- Resident provisioning, legacy linking and rollout: [RESIDENT-PRIVACY.md](RESIDENT-PRIVACY.md).

## Ownership and keys

A workspace is the landlord's organization. Properties, units, vendors and all repair records are workspace-scoped.
Supabase owns authentication identities. Actor IDs in audit/read/history records are Supabase user IDs (or the explicit Development demo identity), not password tables. The local account directory stores access configuration and identity references; passwords remain in Auth.

Except for `users` and `user_memberships` (workspace/user and workspace/user/property keys), `workspaces`, `request_locations`, `notification_reads`, `gate_presence` and `schema_migrations`, tables use a composite primary key `(workspace_id,id)`.
IDs are utf8mb4 VARCHAR(200), preserving string identifiers within that bound; new IDs are GUID strings. Legacy-derived unit IDs use VARCHAR(300) and offer/verification IDs VARCHAR(256). Review oversized legacy IDs before import. Composite indexes remain under InnoDB's 3072-byte limit.
Cross-record references include `workspace_id`, so referencing another landlord's property/vendor/repair fails at the database level.
Do not take workspace or actor IDs from request bodies: they come from validated trusted app metadata.

## Table-by-table structure

| Table | Columns | Key/relationship and purpose |
| --- | --- | --- |
| workspaces | id, name, default_currency, created_at | PK id. Organization root. Created lazily on the first manager property/vendor write, or backfilled by migration. Name/currency are internal defaults; there is no workspace-settings UI/API yet. |
| properties | workspace_id, id, name, address, units, timezone, assets, image_url, archived | FK workspace. units is declared capacity, not the number of registered labels. archived is soft deletion. assets remains the legacy count, not an asset inventory. |
| property_units | workspace_id, id, property_id, label, archived, created_at | FK workspace and property. Unique (workspace,property,label). A stable identity for 3B, 4A, etc. No invented unit labels during migration. Archive column is reserved; no unit-archive endpoint is exposed yet. |
| requests | workspace_id, id, revision, title, property, property_id, unit, resident, category, priority, state, next_action, due_label, description, access, language, timezone, created_at, photo_url, access_notes, preferred_window, safety_json, assigned_vendor_id, assigned_vendor_name, vendor_decision, verification_json, resident_user_id, resident_occupancy_id | FKs property and assigned vendor. revision is optimistic concurrency. Resident identity/occupancy columns are either both NULL or both set. The account is a Supabase user; the occupancy UUID refers to trusted account metadata, not a MySQL lease table. Display names/labels never grant access. |
| request_locations | workspace_id, request_id, property_id, unit_id | PK (workspace,request). FKs (workspace,request,property) and (workspace,unit,property) ensure the linked unit belongs to the request's actual property. One normalized location per repair. |
| vendors | workspace_id, id, name, email, phone, trade, distance, availability, first_visit_fixes, status | FK workspace. Contact directory. The distance/availability/fix fields remain display values, not derived service guarantees. |
| vendor_offers | workspace_id, id, request_id, vendor_id, sequence, status, offered_at, responded_at, offered_by, response_by, note, response_note, legacy_snapshot, active_offer_guard (generated) | FKs request/vendor. Unique sequence per repair; generated active_offer_guard + unique index permits at most one pending/accepted offer; NULL guards allow multiple historical rows. Declines, cancellations and superseded assignments remain visible. |
| events | workspace_id, request_id, id, type, label, detail, at, actor | FK request. Append-only application audit timeline. actor retains the existing display/email snapshot. Offer/verification rows separately retain actor IDs. Not a cryptographically tamper-proof audit system. |
| estimates | workspace_id, request_id, id, version, vendor_id, currency, scope, labor, parts, tax, total, status, created_at, approved_at, approved_by | FKs request/vendor. Unique version per repair. DECIMAL(14,2) money, non-negative components, checked total = labor + parts + tax. New quotes retain vendor and currency; review metadata alone is updated. |
| appointments | workspace_id, request_id, id, starts_at, ends_at, timezone, status, resident_confirmed_at, vendor_confirmed_at, created_at | FK request. Rescheduling cancels the old proposal without deleting it. Both parties must confirm before scheduled work starts. Future-time/DST/duration checks are business-layer rules. |
| evidence | workspace_id, request_id, id, path, name, content_type, size, uploaded_by, created_at, status, path_hash (generated) | FK request. Private object path plus an internal stored SHA-256 path_hash with a unique index; size 1–20 MB. Hashing avoids truncating/indexing long paths. Stores metadata, never file bytes or permanent public URLs. Signed URLs are generated on demand. |
| messages | workspace_id, request_id, id, sender, role, body, at, status | FK request. Scoped repair conversation; role resident/manager/vendor/system. Posting also increments the repair revision, preventing writes after concurrent reassignment. |
| request_verifications | workspace_id, id, request_id, revision, status, note, actor_id, recorded_at, legacy_snapshot | FK request. Unique (workspace,request,revision). Append-only pending/verified/unresolved records preserve each unsuccessful repair attempt and later confirmation. |
| notifications | workspace_id, id, request_id, title, detail, type, read, href, at | FKs workspace and optional request. Shared manager inbox item. read is retained only for imported legacy global read flags. New read actions do not update it. |
| notification_reads | workspace_id, notification_id, user_id, read_at | PK (workspace,notification,user). FK notification. Reading an item no longer marks it read for every manager. |
| gate_presence | workspace_id, appointment_id, arrived_at, arrived_by, departed_at, departed_by, revision | PK (workspace,appointment), FK appointment. Server-stamped watchman arrival/departure audit. Checked paired departure actor/time and ordered timestamps. Presence never changes repair approval, access consent or completion. |
| common_area_issues | workspace_id, id, property_id, location, title, category, description, priority, status, reported_by, submission_id, resolution_note, updated_by, created_at, updated_at, revision | FK property. Reported/in_progress/resolved public building maintenance. Unique (workspace,reporter,submission UUID) makes retries idempotent. No fake residential unit or capacity consumption. |
| common_area_issue_events | workspace_id, id, issue_id, status, note, actor_id, at | FK common-area issue. Append-only application status/update audit; initial report and manager updates commit with the parent. Actor/submission identifiers are not exposed in shared mobile report responses. |
| schema_migrations | version, applied_at, completed, checksum | PK version. MySQL tracks started/completed versions and SHA-256 script checksums. Incomplete migrations block readiness; current completed version is 5. SQLite retains version/applied_at. |

## Supported states and rules

- Repair priority: routine, urgent.
- Repair state: draft, submitted, urgent, acknowledged, assigned, waiting, scheduled, approved, in_progress, completed, verification, invoice_review, closed, cancelled.
  Database values preserve legacy compatibility; a permitted stored value does **not** authorize an arbitrary transition.
- Vendor directory status: preferred, approved, review.
- Offer status: pending, accepted, declined, superseded, cancelled.
- Quote status: submitted, approved, changes_requested.
- Visit status: proposed, confirmed, cancelled.
- Evidence status: uploading, uploaded.
- Resident verification status: pending, verified, unresolved.

General status changes cannot bypass vendor acceptance, quote approval, visit confirmation or resident verification.
Quoted work cannot currently be reassigned: cancel/create a follow-up instead. This is a deliberate current-product restriction, not a completed linked-follow-up feature.

## What changed and why

1. **Organization ownership is enforced.** MySQL has native workspace FKs. SQLite uses equivalent insert/update/delete-reference triggers for v1 tables that cannot receive composite FKs through additive ALTER; new tables use ordinary FKs.
2. **Unit identity is normalized.** Reports for the same property + label reuse one unit ID. Creating a report auto-registers its authorized label when capacity permits. Managers can pre-register labels; tenants can list only their assigned labels.
3. **Assignment history is retained.** A new offer supersedes previous live offers. Responses retain decision, reason, actor and time.
4. **Financial ownership is explicit.** New estimates store the assigned vendor and currency. API-supported currencies: USD, INR, EUR, GBP, CAD, AUD, SGD. Revisions must retain the original currency. No currency conversion, payment or invoicing is implemented.
5. **Resident verification is auditable.** An unresolved result no longer disappears when the vendor completes another attempt.
6. **Inbox state is personal.** Managers share inbox items, not read receipts.
7. **Resident history is account- and period-specific.** Migration 005 adds a paired account/occupancy binding without guessing legacy identities. Current trusted permissions, active dates and the report date must match. The database pair check prevents half-bindings; the API enforces identity/date access. Managers can explicitly bind only unlinked repairs with revision checks and an audit event.

## MySQL representation

All tables use InnoDB and utf8mb4_0900_as_cs: workspace IDs, unit labels and constrained states are case/accent-sensitive. read and sequence are quoted SQL identifiers. The database enforces money totals, foreign keys and status checks. MySQL duplicate-key updates are limited to deliberate workspace/read-receipt operations; child inserts fail on conflicting identities or alternate unique keys instead of overwriting unrelated history.

## Transactions and indexing

Repair state, revision, child histories, audit event and inbox item commit in one transaction.
Updates use `WHERE workspace_id=@WorkspaceId AND id=@Id AND revision=@Revision`; a stale revision rolls back the entire mutation.
Property writes lock the property row before capacity checks, unit registration and archive checks.

Queue indexes cover workspace/state/time, property/unit and assigned vendor/state.
History indexes cover workspace/request/time or version.
Additional indexes cover unit-to-repair lookup, vendor offers, notification request lookup, per-user read receipts and `(workspace_id,resident_user_id,resident_occupancy_id)` resident scope.
Search remains parameterized literal substring search, not a full-text search index. List endpoints remain unpaginated; add cursor pagination before growing to large portfolios.

No request body is interpolated into SQL. The only SQL template replacements are server-built authorization/filter predicates; every value is bound via Dapper parameters.

## Compatibility and migration caveats

- Original migrations 001–004 are unchanged. MySQL has its own complete 001 → 002 → 003 → 004 → 005 migration chain; 002 adds normalized/history tables, 003 adds integrity/verification backfill, 004 adds gate presence/common-area operations, and 005 adds resident binding/privacy. Changing a provider does not transfer data from another database.
- Existing repair IDs, revisions, status, histories and display snapshots are retained. No reset/drop/rebuild of customer tables.
- Existing labels are discovered from actual repairs. If that count exceeds a property's old declared capacity, migration raises capacity to preserve its historical units; it never discards them.
- Old assignment records become `legacy_snapshot=true`. Unknown offer/response actors and timestamps remain NULL. These are snapshots, not reconstructed event histories.
- Existing quote vendor ownership remains NULL because the current assignment cannot prove who authored an old quote. Legacy currency defaults to USD, matching the old UI convention; verify it before real financial use. Mongo imports also need explicit currency review.
- A stored resident-verification snapshot is backfilled once with `legacy_snapshot=true`; original UpdatedAt is retained when present, otherwise repair creation time is the deterministic fallback. It cannot recover unrecorded previous attempts.
- Old notification read=1 flags remain globally read for compatibility. All subsequent reads are per-user.
- UTC timestamps use ISO-8601 VARCHAR(40) for API/import compatibility, not native DATETIME arithmetic. New server-generated values use UTC round-trip formatting. Safety/verification projections use validated native MySQL JSON; SQLite stores JSON text. Normalize legacy timestamp offsets during a separately verified import.
- verification_json remains the current-response projection; request_verifications is the history. They are written atomically together.
- Resident names are display snapshots. Resident access requires the repair's Supabase account ID and occupancy UUID, matching active app_metadata resident_occupancies, property_ids + property_units and report time within that period. Unit records do not grant access. Missing/expired/future/ambiguous assignments fail closed.
- Legacy repairs remain unlinked and unavailable to residents until a manager verifies and explicitly links an eligible account/period. Metadata is provisioned by trusted administrators; no normalized lease table, account lookup, correction/transfer UI or automatic household sharing is implemented. Previously issued file URLs expire normally; downloaded files cannot be recalled.
- There is no user directory, lease billing, real asset registry, delivery outbox/SMS worker, invoice/payment module or full translation service hidden behind these tables.

## New/additive API fields

All existing URLs and the `{data:...}` envelope remain compatible.

- GET /api/properties/{id}/units — managers: registered property units; tenants: only registered labels allowed by current occupancy.
- GET /api/mobile/context — shared by native and web resident pickers: existing authorized buildings and active assignment labels, including an apartment's first report before its unit row is registered. The repair transaction registers that authorized label subject to capacity.
- POST /api/properties/{id}/units — manager registers `{"label":"3B"}`.
- Manager/vendor repair response: unitId, offers[], verificationHistory[], residentLinked. Resident responses allowlist safe repair/progress/visit/evidence/verification fields, excluding quote amounts/scopes, offers, internal audit details/actors and storage paths. Safe quoteStatus and vendorAssigned fields preserve workflow ownership without money or vendor IDs. Private account/occupancy IDs are never serialized in repair responses.
- POST /api/requests — managers may supply residentUserId + residentOccupancyId together. Resident-created reports derive both from verified identity and active assignment, not the body.
- POST /api/requests/{id}/resident-link — manager-only, current If-Match revision required, only unlinked repairs, immutable after linking, audited atomically.
- Estimate response: vendorId, currency.
- POST estimate accepts optional currency; existing clients that omit it use USD.
- Notification read response remains read=true/false but is now actor-specific.
- Web intake and repair workspaces include explicit resident-link controls. The resident web report uses server-authorized unit choices and account-scoped memory-only drafts. Existing clients need the new occupancy metadata; a unit-wide authorization fallback is deliberately not supported.

## Run the migration

### Database and Supabase boundary

Maintenance records live in a dedicated MySQL database accessed only by the server API. Supabase provides verified identities and private files; its database/Data API is not used for these records. Give the MySQL runtime account only the required database/table permissions; workspace scope is enforced in the API and composite foreign keys.

Back up a real database before deployment. Use the schema-owner credential, not the runtime user:

```powershell
cd D:\B2B\RepairLedger-Web-and-Mobile-Final\RepairLedger-app-source
dotnet run --project apps/api/RepairLedger.Api.csproj --no-launch-profile -- --migrate-only true
```

The command uses your configured MySQL connection and exits without serving HTTP. MySQL 8.4 LTS is the development/production default; credentials are required. MySQL DDL implicitly commits; session locks, completed flags and checksums permit recovery of unchanged scripts. Backups remain essential.
Keep Database:AutoMigrate=false for the Production runtime.
Grant runtime SELECT on schema_migrations and SELECT/INSERT/UPDATE on application tables; no schema-alter/delete permissions are needed.

## Verification

- Workflow/unit/security tests run against isolated SQLite files or generated isolated MySQL databases.
- Migration test starts with a real version-1 schema, upgrades it twice, and checks preservation/backfill/idempotency.
- HTTP smoke: `pwsh -File scripts/test-api.ps1` after a Release build. It launches its own loopback port and temporary database and stops only its own process.
- Full financial, live Supabase/storage and Production load verification still require your deployment credentials and infrastructure.

## Community structure and delivery migration 009

Existing properties represent communities at individual locations. `community_blocks` contains their named towers/blocks. `community_unit_locations` assigns an existing flat ID to a block and integer floor; old flats remain unassigned until organized. Stable flat IDs and community-wide unique labels preserve resident and finance links. Use A-101 and B-101 when different blocks share a flat number.

`community_block_layouts` stores independent draft/published plans for each block and floor. Existing `community_layouts` remain available as previous/unassigned plans. Moving a linked flat requires unlinking and publishing its old map first.

`community_deliveries` tracks personal and seller stock deliveries, package count, handling instructions, approval and gate/recipient handover. Personal deliveries are restricted to the requesting user and up to 20 packages; larger seller deliveries must be bulk. Bulk requires admin approval. Gate acceptance is restricted to approved deliveries expected that day; only the intended recipient in the matching view confirms receipt. Pending/accepted deliveries prevent community archival.

Migrations are additive; applied scripts 001–008 remain intact. Run `npm run db:migrate` before restarting an existing API. Administrator permissions remain workspace-wide; community-specific administrator delegation is a separate deferred decision.
