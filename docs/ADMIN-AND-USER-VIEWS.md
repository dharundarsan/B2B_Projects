# CommunityHub account views

Current schema 8 stores **User = 1**, **Admin = 2** and **Seller / Provider = 3** in `users.user_context`. The authenticated workspace/account key, revision and server-owned permissions determine which contexts are available.

Admin accounts have all three views. Regular members never receive an Admin option; they can have User, Seller / Provider or both. Watchmen use User only. API administration requires an allowed admin role, admin permission and context 2. Seller view contains only the account's own business. View switching does not impersonate another person.

Web homes are `/home`, `/admin` and `/seller`. Community links resolve to the selected home. Both web and mobile put the switch in the sticky/fixed top-right profile menu. User creation and access configuration live under Admin > People & access, with building and dated tenant-occupancy assignments, suspension and access audit.

`GET /api/user/context` returns role, current context, availableContexts, displayName, email, canSwitchContext and revision. `PATCH` accepts `{ "userContext": 3, "revision": 0 }` and checks both permission and revision. Middleware resolves managed roles/assignments for every verified API request. Mobile context includes the same allowed views.

Migration 007 introduced the preference table; **008_ManagementViews.sql** adds permissions, managed accounts and the third view without changing earlier migrations. Supabase owns passwords and verifies identity/workspace. The local database is authoritative for managed account access; legacy metadata remains supported until an account is managed.

See [the complete revamp, features and rollout](COMMUNITYHUB-REVAMP.md), [community workflows](COMMUNITY-PLATFORM.md) and [mobile/hosting feasibility](MOBILE-MFE-FEASIBILITY.md). Native supports the management/seller workflows and rectangular map editing; polygon/Three.js editing and private receipt uploads remain on the web. Native exports pass; physical-device verification remains required.
