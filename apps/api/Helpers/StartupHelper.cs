namespace RepairLedger.Api.Helpers;

public static class StartupHelper
{
    public static void ConfigureCommandOptions(IConfiguration configuration)
    {
        var check = configuration.GetValue<bool>("check-database");
        var migrate = configuration.GetValue<bool>("migrate-only");
        var import = !string.IsNullOrWhiteSpace(configuration["import"]);
        if ((check ? 1 : 0) + (migrate ? 1 : 0) + (import ? 1 : 0) > 1)
            throw new InvalidOperationException("Choose exactly one database command: check-database, migrate-only or import.");
        if (check) configuration["Database:AutoMigrate"] = "false";
        else if (migrate) configuration["Database:AutoMigrate"] = "true";
    }

    /// <returns>True when a command-line-only operation completed; the HTTP server should not start.</returns>
    public static async Task<bool> Initialize(WebApplication app, CancellationToken ct)
    {
        if (!app.Environment.IsDevelopment() && app.Configuration.GetValue<bool>("Demo:Enabled"))
            throw new InvalidOperationException("Demo authentication cannot be enabled outside Development.");
        if (app.Configuration.GetValue<bool>("check-database")) return await CheckDatabase(app, ct);
        await app.Services.GetRequiredService<DatabaseMigrationHelper>().Initialize(ct);
        if (app.Configuration.GetValue<bool>("migrate-only")) { app.Logger.LogInformation("Database migrations applied."); return true; }
        using var scope = app.Services.CreateScope();
        var dal = scope.ServiceProvider.GetRequiredService<IRepairDAL>();
        if (app.Configuration["import"] is { Length: > 0 } path)
        {
            await using var file = File.OpenRead(path);
            var snapshot = await System.Text.Json.JsonSerializer.DeserializeAsync<MigrationSnapshot>(file, new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web), ct)
                ?? throw new InvalidOperationException("Invalid migration snapshot.");
            await dal.Import(snapshot, ct);
            app.Logger.LogInformation("Imported {Count} workspaces. No existing data was overwritten.", snapshot.Workspaces.Count);
            return true;
        }
        if (app.Environment.IsDevelopment() && app.Configuration.GetValue<bool>("Demo:Enabled")) await DemoSeed.Initialize(dal, ct);
        return false;
    }

    private static async Task<bool> CheckDatabase(WebApplication app, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(app.Configuration["Database:ConnectionString"]))
        {
            app.Logger.LogError("Database connection is not configured. Set Database:ConnectionString in apps/api/appsettings.Local.json or environment variables. No data was changed.");
            Environment.ExitCode = 1;
            return true;
        }
        try
        {
            var check = await app.Services.GetRequiredService<DatabasePreflightHelper>().Inspect(ct);
            app.Logger.LogInformation("MySQL connection succeeded. Server version: {ServerVersion}; schema version: {SchemaVersion}; expected: {ExpectedVersion}.",
                check.ServerVersion, check.SchemaVersion?.ToString() ?? "missing", DatabaseMigrationHelper.CurrentVersion);
            if (check.MissingTables.Count > 0) app.Logger.LogWarning("Missing or inaccessible application tables: {Tables}", string.Join(", ", check.MissingTables));
            if (check.IncompatibleTables.Count > 0) app.Logger.LogWarning("Application objects must be InnoDB base tables: {Tables}", string.Join(", ", check.IncompatibleTables));
            if (!check.ValidMigrationMetadata) app.Logger.LogWarning("Migration metadata is missing or incompatible. Apply migrations to an empty dedicated database; investigate existing installations first.");
            if (!check.StrictMode) app.Logger.LogWarning("Strict SQL mode is disabled. Enable STRICT_TRANS_TABLES or STRICT_ALL_TABLES on your MySQL server before using real data.");
            if (check.SchemaVersion == -1) app.Logger.LogWarning("A migration is incomplete or a version is missing. Investigate and resume the original unchanged migration; do not reset tables.");
            if (check.Ready) app.Logger.LogInformation("Database preflight passed. No migrations, seeds or customer writes were performed.");
            else app.Logger.LogWarning("Database preflight is not ready. No data was changed. See docs/SETUP.md before migration.");
            Environment.ExitCode = check.Ready ? 0 : 2;
        }
        catch (Exception error) when (error is System.Data.Common.DbException or InvalidOperationException or ArgumentException or FormatException)
        {
            // Connector exceptions can contain host/user details. Keep credentials and raw errors out of CLI output.
            app.Logger.LogError("Database check failed. Verify the MySQL provider, connection settings, TLS policy, server availability and SELECT permissions. No data was changed; no credentials are printed.");
            Environment.ExitCode = 1;
        }
        return true;
    }
}
