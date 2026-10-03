# Resident account and occupancy privacy

Implemented on 3 October 2026 in the main Git checkout. This is a coordinated authorization change for the web, native app and C# API, not a live deployment. Apply schema **005** and provision resident accounts before enabling real resident access.

## What a resident can access

A private apartment repair is visible only when all these conditions hold:

1. Supabase Auth validates the signed-in account. The repair's workspace and `resident_user_id` match that account's trusted organization and user ID.
2. The account has an active `resident_occupancies` entry with the exact repair occupancy UUID, property ID and unit label.
3. The same property/unit is also allowed by `property_ids` and `property_units`.
4. The repair was reported within that occupancy's dates. The start is inclusive; the end is exclusive. The occupancy must also be active **now**.

A name, email, apartment label or unit record alone grants no access. Missing, malformed, future, expired or revoked assignments deny access. Multiple active assignments for the same property/unit are ambiguous and deny access to that unit. A returning resident needs a new occupancy UUID and does not inherit their earlier occupancy's private repairs. Household members do not automatically share repairs: this version binds one account per repair.

The API applies the same scope to lists, details, messages, resident responses and evidence operations. Unauthorized repairs appear unavailable. Web and native apartment pickers use the same server-verified assignment context; a first report can register its authorized unit when property capacity permits, without requiring older private history. The web home/report screens explain missing assignments rather than implying there are no outstanding repairs. Expired residents also lose the assigned building in mobile context, including shared-area reporting. Watchmen retain their separate assigned-building policy and never receive apartment-repair access.

Resident repair responses omit quote amounts/scopes, vendor-offer history, private binding identifiers, internal audit details/actors and storage paths/uploader identifiers. They include a restricted progress timeline, visit information, outcome verification and safe photo metadata. Only the quote approval status and a vendor-assigned boolean are retained so the next responsible party stays accurate without disclosing financial details or vendor IDs. Repair conversations are intentionally shared with the manager and assigned vendor; never put staff-only notes, other residents' details or key codes in them. This change does not redesign the existing manager/vendor response policy.

## Provision the account through trusted administration

Use your already-authorized Supabase administrator workflow. Do not put administrative credentials in the frontend, mobile app or this document. Set **app_metadata**, never editable `user_metadata`.

Example resident metadata:

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

Replace the workspace/property IDs, unit label, dates and illustrative UUID. Use a freshly generated, nonzero UUID **for every occupancy period**, even when the same person returns to the same apartment. IDs and labels are case-sensitive. Use actual occupancy instants with explicit `Z` or numeric timezone offset and seconds; local dates without offsets are rejected. `ends_at` may be omitted or null for an open-ended assignment; the administrator must then explicitly end or revoke it at turnover. An end must be later than its start. Keep the array small; the parser accepts at most 100 entries.

Supabase distinguishes administrator-managed app metadata from user-editable metadata. Its authenticated user lookup verifies the current account. [Metadata authorization guidance](https://supabase.com/docs/guides/database/postgres/row-level-security), [authenticated user lookup](https://supabase.com/docs/reference/javascript/auth-getuser).

RepairLedger stores maintenance data in **MySQL**. Those references explain the identity boundary, not a PostgreSQL RLS configuration. C# and parameterized Dapper scope enforce maintenance access. The API fetches the user from Supabase Auth on each authenticated request rather than trusting a decoded client token's metadata. Refresh the client after assignment changes to update its displayed navigation. In-flight requests and already downloaded data cannot be recalled.

There is no lease/account-management UI or Supabase account lookup in the link form. Administrators must independently verify the account, correct period and report date. The API validates link UUID format; actual resident access still requires the validated account metadata to match every condition above.

## Report and link flow

| Who | Flow | Result |
| --- | --- | --- |
| Resident, web or native | Pick a server-authorized apartment and report the issue | The API derives account and active occupancy itself; client-supplied identity values cannot impersonate someone else. |
| Manager, new repair | Optionally select **Link this repair to a provisioned resident account** and enter the account and occupancy UUIDs | Creates a bound repair; permission and date checks still govern resident reads. Without this option, the repair remains unlinked. |
| Manager, existing unlinked repair | Open its workspace, use the resident privacy panel and enter the verified provisioning UUIDs | `POST /api/requests/{id}/resident-link` requires the current `If-Match` revision and records an audit event atomically. Refresh after a conflict. |
| Manager, already linked repair | Inspect the account-specific privacy explanation | No transfer or overwrite action. A different occupant never inherits the link. |

Link request body:

```json
{
  "residentUserId": "8d92cb8f-2ced-49a6-a121-5b1a3d6e3154",
  "residentOccupancyId": "b3a24db4-72d1-4f10-93b6-83e211f2e758"
}
```

These are illustrative UUIDs, not existing accounts. New manager-created reports may include the same optional pair; both values must be present together. Raw UUIDs are not included in the returned repair. `residentLinked` means a binding exists, **not** that the assignment is currently active or an account lookup succeeded.

Migration 005 never guesses an identity from a resident name or apartment. Existing repair history remains intact and **unlinked**, available to managers and the assigned vendor but not residents. Review individual current-occupancy records before explicitly linking them. Do not bulk-link previous occupants' records or change occupancy dates just to reveal old history. A correction/transfer workflow is deliberately not implemented; an incorrectly linked record needs a separately reviewed administrative correction, not a silent reassignment.

## Coordinate the rollout

1. Back up the configured database and review the deployment/restore plan. Do not run the final-schema snapshot against existing data.
2. Inventory resident accounts and provision their trusted occupancy entries. Existing property/unit-only metadata is no longer sufficient. End old periods and use new UUIDs at turnover.
3. In a planned maintenance window, apply the unchanged numbered migrations through **005** with the migration credential. Run `npm run db:migrate`, then `npm run db:check`; schema version 5 must pass. Deploy the matching API and client versions together. Keep production `Database:AutoMigrate=false`.
4. Link only independently verified current-occupancy legacy repairs where residents still need to respond. Until linked, existing scheduling/verification records remain manager/vendor-visible but unavailable to residents.
5. On your configured staging deployment, test two different residents in the same unit at different periods, the same resident returning with a new UUID, an expired/revoked account, a future account, direct repair URLs and private photo access. Test assignment changes with an existing signed-in session on real Android/iOS devices too.

No migration, provisioning, database import or deployment to your configured services was performed during implementation. Do not roll back to a unit-wide API merely to make missing resident records visible; investigate provisioning/linking instead.

## Drafts and private files

The web report draft is now held only in memory for the signed-in account in that tab. Navigation within the same account can restore it; sign-out, an account change, reload or closing the tab loses it. Photos are not saved in the draft. Native report drafts remain memory-only.

The previous browser-wide localStorage draft, `repairledger-report-draft`, is **not imported, overwritten or deleted** by this change. Before a shared-device pilot, have the device owner remove that old key through the browser's site-storage controls, or clear the site's data if they intend to reset its other preferences and authentication too. The new code does not claim to erase existing browser storage or downloaded copies.

Evidence operations recheck repair authorization before issuing a signed URL. Previously issued download URLs may remain usable until their existing 15-minute expiry; already downloaded files cannot be revoked. Photo scanning, retention, device-cache cleanup and real private-storage testing remain rollout work.

## Verification and remaining scope

The privacy increment adds regression tests for trusted metadata parsing, account/period turnover, expired/future/revoked/ambiguous assignments, body identity spoofing, revision-checked immutable linking, paired database bindings, response allowlisting and account-scoped drafts. See [the current handoff verification](../FINAL-HANDOFF.md) for the completed runs and their limits.

This is a small-portfolio privacy foundation, not a full lease system or production certification. Account administration, household sharing, mistakes/corrections, retention policy, live Supabase/storage and physical-device validation remain explicit work. Settle resident responses before occupancy ends where possible: a verification repair whose resident loses access currently has no administrative-close API, so it can remain open and block property archiving. Define a separately reviewed administrative resolution procedure; never extend/reuse a lease assignment merely to bypass privacy. Notifications, invoice reconciliation, administrative closure and pagination remain separate roadmap items.
