# Architecture
The React frontend communicates with the ASP.NET Core API via the existing `/api/*` contract. Responses remain `{data:...}` and errors `{message,traceId}`. Supabase remains the identity and private-file service. MongoDB and Express are no longer runtime dependencies.

## SQL persistence
The controller/Business/Interfaces/DataAccess/Helpers layout follows the reference project. Raw SQL is cached from embedded SQLFiles resources; versioned DDL lives separately in DatabaseScripts. See [backend structure](BACKEND-STRUCTURE.md) and [final schema](FINAL-SCHEMA.md).

Dapper executes parameterized raw SQL over short-lived connections. MySQL uses a shared thread-safe MySqlConnector data source/pool, never a shared open connection. MySQL 8.4 LTS is the default development and production provider; SQLite is explicit test/offline only.
Properties, vendors, requests, audit events, estimate versions, appointments, evidence, messages and notifications are relational tables. Workspace-scoped composite foreign keys prevent cross-workspace references. Safety-answer and resident-verification subdocuments are small native MySQL JSON values (text in SQLite); repairs/history are not opaque Mongo-like JSON blobs.
Reads hydrate request children in a fixed set of SQL statements rather than one query per repair. Search/filters and authorization scope are applied before hydration.
Tenant predicates bind both property AND exact unit; vendor queries bind the assigned vendor. Every child query carries workspace scope.

## Transactions and conflicts
A repair update, quote/visit/evidence history, audit events and notification commit together.
The request revision is updated with `WHERE revision=@Revision`; conflicting changes roll back and return 409. The client uses optional `If-Match` revisions. Do not silently retry non-idempotent writes after a conflict.
Quote amounts use C# decimal calculations, two-decimal validation and MySQL DECIMAL(14,2). A Dapper decimal handler accommodates SQLite's mixed integer/real affinity in development.
Events and verification history are append-only. Quote revisions are separate immutable scope/amount/vendor/currency rows; only review metadata changes. Vendor offers retain sequence, decisions and response actors/times.
Repairs link to normalized property-unit identities through request_locations, whose composite foreign keys reject cross-property links. Notification read receipts are per actor; legacy global read flags remain only for imported records.
Property archive is a soft delete. Active repairs block archival, and historical repairs retain their foreign keys.

## Workflow
Report -> acknowledge -> vendor offer -> vendor accepts -> quote -> manager approval -> propose visit -> resident AND vendor confirm -> vendor starts -> vendor completes -> resident verifies -> closed.
Unresolved verification reopens approved work. Unapproved quotes cannot authorize work. Obsolete visit proposals cannot be confirmed. Reassignment of already quoted work is intentionally blocked to preserve scope ownership; cancel and create a follow-up repair for now.
The general status endpoint cannot bypass dedicated work or resident-verification actions.
Notifications are an application inbox, not delivered emails/SMS. Vendor invitation currently records contact details; it does not send an invitation email.

## API safety
Typed input contracts, bounded lengths/costs/file sizes, cancellation tokens, exception sanitization, parameterized queries, exact-origin CORS, no-store responses and rate limiting.
Production fails closed if auth/database configuration is missing; demo auth is Development-only. Only Supabase-verified app metadata drives authorization.
OpenAPI is development-only. Health checks are anonymous and contain no secrets.

## Frontend cleanup
Reusable UI components and resource/object-URL hooks replace repetition. Cancellable reads protect major list/detail pages from stale navigation responses. Sample data is not silently shown as real data on API failures. Search uses live records. Work buttons call explicit endpoints rather than inspecting note strings.
Typed inputs replace unknown payloads. Currency formatting reuses an Intl formatter. Selected-file URLs are revoked. Duplicate unused screens were removed. CSV export escapes fields and neutralizes spreadsheet formula prefixes.

## Operational boundaries
The operations UI derives attention from workflow state rather than next-action/due display strings. C# RepairAttentionHelper and TypeScript operations helpers have equivalent manager-decision rules with regression coverage. Proposed visits are not confirmed appointments; vendor completion is not resident verification. Dashboard counters and request filters follow those semantics. Request paging is still client-side, not a server scaling solution.
Resident routes now include `/tenant` for open repairs, response-needed work and history, reusing existing server scoping. Quote formatting preserves currency and portfolio authorization totals are grouped per currency; they are not actual spend. Six navigation language packs and Arabic RTL remain partial localization with an explicit English workflow boundary. See [product/UI review](PRODUCT-AND-UI-REVIEW.md).

SQL migrations/import are separate deployment operations. MySQL schema DDL implicitly commits: a session lock plus checksummed completion tracking supports same-script recovery, not transactional DDL rollback. Repair/import DML still uses InnoDB transactions. Production uses backups, TLS database connections and a least-privileged runtime DB user.
This is not a claim of complete production hardening: there is no email/SMS worker, invoice/payment processing, malware scanner, automatic retention job or full translation service. UI language support remains the existing partial navigation translations.
