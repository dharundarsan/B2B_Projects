# Mobile micro-frontends and Vercel

Checked 2026-10-04. Decision for this project: keep separately compiled web and native screens, shared contracts and one authenticated API. No runtime federation dependency or bundler migration was added.

Native micro-frontends are technically possible: Re.Pack supports React Native Module Federation. Its Expo integration uses a different bundler and native-platform setup. This project's Expo Router/Metro build would need a migration and compatibility testing; the Re.Pack 5 federation documentation also points to older version 4 guidance. This is not a drop-in way to load the React web screens inside the native app. [Re.Pack federation](https://re-pack.dev/docs/features/module-federation), [Expo integration](https://re-pack.dev/docs/guides/expo-modules)

Vercel can serve an Expo web export, and Expo provides an official Vercel configuration example. Android/iOS installations still require native builds and distribution. Hosting remote native JavaScript assets on a CDN is a possible federation design, but inferring that from CDN hosting does not establish compatibility with this app's Expo/React Native versions. No remote native bundles were shipped or tested. [Expo website publishing](https://docs.expo.dev/guides/publishing-websites/)

The free Vercel Hobby plan permits personal, non-commercial use only. A personal prototype can qualify; a commercial apartment service should not assume the free plan is allowed. [Vercel Hobby plan](https://vercel.com/docs/plans/hobby)

The current .NET API/MySQL database needs its own hosting configuration. Static frontend deployment does not host either service. This repository does not implement an adapter for Vercel Functions or its container runtime. Moving to an MFE would not remove those backend requirements. [Vercel runtime documentation](https://vercel.com/docs/functions/runtimes)

## Prepared frontend configurations

Two optional `vercel.json` files are included. Nothing was deployed.

| Frontend | Vercel Root Directory | Build | Output | Public build-time variables |
| --- | --- | --- | --- | --- |
| Web portal | `apps/web` | `npm run build` | `dist` | `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| Expo web version | `apps/mobile` | `npm run export:web` | `dist` | `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` |

Keep **Include source files outside of the Root Directory in the Build Step** enabled for both projects: their TypeScript imports use the repository's `shared` directory. The native app has its own package lock and dependencies; install those in `apps/mobile`. [Vercel shared-source settings](https://vercel.com/docs/monorepos/monorepo-faq)

Use a separately reachable HTTPS API, add the deployed frontend origin to the API's CORS configuration, and leave preview/demo flags off. Public Supabase keys belong in the client build; private Storage/service-role/database credentials stay exclusively on the API host. SPA rewrites allow direct links to nested routes. Native app builds consume the same HTTPS API and Supabase account.

Revisit federation when independent teams genuinely need separate native feature releases and a custom native shell/bundler is justified. Sharing types, request contracts and domain rules already avoids duplicating backend behavior without that migration.
