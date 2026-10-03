# Run RepairLedger on Windows
Requirements: Node.js 22.6+ (with npm), .NET 10 SDK, MySQL 8.4 LTS.

```powershell
cd D:\B2B\RepairLedger-Web-and-Mobile-Final\RepairLedger-app-source
node -v
dotnet --version
npm ci
npm --prefix apps/mobile ci
# Configure MySQL first: docs/SETUP.md
npm run db:check
# Apply migrations only to your NEW/reviewed database:
npm run db:migrate
npm run db:check
npm run dev
```
Open http://localhost:5173. `npm run dev:api` now runs ASP.NET Core, not Node or pnpm.
This extracted source does not include a private SDK. Install the .NET 10 SDK. Scripts prefer an optional ignored `.tools/dotnet` SDK when present and otherwise use your installed `dotnet`.
If npm is not recognized, install a supported Node distribution and open a new PowerShell window. The app's React build still needs Node/npm even though the backend is C#.
For the production database, auth and hosting configuration, see [docs/SETUP.md](docs/SETUP.md).
Old `apps/api/.env` values are no longer loaded by ASP.NET Core; transfer them to environment variables or ignored `appsettings.Local.json`.


If appsettings.Local.json has not been configured yet, add your credentials privately using the MySQL development example; do not paste them into chat. db:check exit 1 means settings/connection/permissions need attention; exit 2 means connected but not ready (expected for a new empty database before migration). It never creates/migrates/seeds data. See SETUP for production environment/TLS and populated-database precautions.
