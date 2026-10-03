using Dapper;
using RepairLedger.Api.Enums;
namespace RepairLedger.Api.Helpers;

/// <summary>Reads only server/schema metadata. Never migrates, imports, seeds or reads customer rows.</summary>
public sealed class DatabasePreflightHelper(IConnectionHelper connection, ISqlFileQueryHelper sql, IDapperHelper dapper)
{
    private static readonly string[] Tables =
    [
        "schema_migrations", "workspaces", "properties", "property_units", "requests", "request_locations",
        "vendors", "vendor_offers", "events", "estimates", "appointments", "evidence", "messages",
        "request_verifications", "notifications", "notification_reads", "gate_presence", "common_area_issues", "common_area_issue_events"
    ];
    private sealed class TableMetadata
    {
        public string Name { get; set; } = "";
        public string? Engine { get; set; }
        public string TableType { get; set; } = "";
    }
    public async Task<DatabaseCheckResult> Inspect(CancellationToken ct)
    {
        if (connection.Provider != DatabaseConnectionType.MySql)
            throw new InvalidOperationException("Database preflight requires MySql; SQLite files will not be opened or created.");
        await using var db = await connection.Open(ct);
        var tables = (await dapper.QueryAsync<TableMetadata>(db, new CommandDefinition(sql.GetSqlQuery("PreflightTables"),
            new { names = Tables }, cancellationToken: ct))).ToDictionary(t => t.Name, StringComparer.Ordinal);
        var missing = Tables.Where(t => !tables.ContainsKey(t)).ToArray();
        var incompatible = tables.Values.Where(t => t.TableType != "BASE TABLE" || !string.Equals(t.Engine, "InnoDB", StringComparison.OrdinalIgnoreCase))
            .Select(t => t.Name).Order(StringComparer.Ordinal).ToArray();
        var columns = (await dapper.QueryAsync<string>(db, new CommandDefinition(sql.GetSqlQuery("PreflightMigrationColumns"),
            cancellationToken: ct))).ToHashSet(StringComparer.Ordinal);
        var validMetadata = tables.ContainsKey("schema_migrations") &&
            new[] { "version", "applied_at", "completed", "checksum" }.All(columns.Contains);
        int? version = validMetadata ? await dapper.ExecuteScalarAsync<int>(db,
            new CommandDefinition(sql.GetSqlQuery("SchemaVersion"), cancellationToken: ct)) : null;
        var modes = await dapper.ExecuteScalarAsync<string>(db, new CommandDefinition(sql.GetSqlQuery("PreflightSqlMode"), cancellationToken: ct)) ?? "";
        var strict = modes.Split(',', StringSplitOptions.TrimEntries).Any(m => m is "STRICT_TRANS_TABLES" or "STRICT_ALL_TABLES");
        if (missing.Length == 0 && incompatible.Length == 0)
            await dapper.QueryAsync<object>(db, new CommandDefinition(sql.GetSqlQuery("PreflightReadPermissions"), cancellationToken: ct));
        return new(db.ServerVersion, version, validMetadata, strict, missing, incompatible);
    }
}
