using Dapper;
using RepairLedger.Api.Enums;
using System.Security.Cryptography;
using System.Text;
namespace RepairLedger.Api.Helpers;

public sealed class DatabaseMigrationHelper(IConnectionHelper connection, ISqlFileQueryHelper sql, IDapperHelper dapper,
    IConfiguration configuration, ILogger<DatabaseMigrationHelper> logger)
{
    public const int CurrentVersion = 5;
    public async Task Initialize(CancellationToken ct)
    {
        await using var db = await connection.Open(ct);
        if (!configuration.GetValue<bool>("Database:AutoMigrate"))
        {
            var version = await dapper.ExecuteScalarAsync<int>(db, new CommandDefinition(sql.GetSqlQuery("SchemaVersion"), cancellationToken: ct));
            if (version != CurrentVersion) throw new InvalidOperationException("Apply the versioned database migrations before starting the API.");
            return;
        }
        var resources = Resources();
        if (connection.Provider == DatabaseConnectionType.MySql)
        {
            await MigrateMySql(db, resources, ct);
            return;
        }
        await using var tx = await db.BeginTransactionAsync(ct);
        await dapper.ExecuteAsync(db, new CommandDefinition(sql.GetSqlQuery("BootstrapMigrations"), transaction: tx, cancellationToken: ct));
        if (await dapper.ExecuteScalarAsync<int>(db, new CommandDefinition(sql.GetSqlQuery("SchemaVersion"), transaction: tx, cancellationToken: ct)) > CurrentVersion)
            throw new InvalidOperationException("The database schema is newer than this API. Deploy the matching API version.");
        foreach (var resource in resources)
        {
            if (await dapper.ExecuteScalarAsync<int>(db, new CommandDefinition(sql.GetSqlQuery("HasMigration"),
                new { version = resource.Version }, tx, cancellationToken: ct)) != 0) continue;
            await dapper.ExecuteAsync(db, new CommandDefinition(sql.ReadResource(resource.Name),
                new { migrationAt = DateTimeOffset.UtcNow.ToString("O") }, tx, cancellationToken: ct));
            await dapper.ExecuteAsync(db, new CommandDefinition(sql.GetSqlQuery("RecordMigration"),
                new { version = resource.Version, at = DateTimeOffset.UtcNow.ToString("O") }, tx, cancellationToken: ct));
            logger.LogInformation("Applied schema migration {Version}", resource.Version);
        }
        await tx.CommitAsync(ct);
    }

    private sealed record MigrationResource(string Name, int Version);
    private List<MigrationResource> Resources()
    {
        var folder = connection.Provider == DatabaseConnectionType.MySql ? "MySql" : "Common";
        var resources = typeof(DatabaseMigrationHelper).Assembly.GetManifestResourceNames()
            .Where(n => n.StartsWith($"RepairLedger.Api.DatabaseScripts.{folder}.", StringComparison.Ordinal)
                || connection.Provider == DatabaseConnectionType.Sqlite && n.StartsWith("RepairLedger.Api.DatabaseScripts.Sqlite.", StringComparison.Ordinal))
            .Select(n => new MigrationResource(n, int.Parse(n.Split('.')[^2].Split('_')[0]))).OrderBy(n => n.Version).ToList();
        if (resources.Count != CurrentVersion || resources.Select(x => x.Version).Distinct().Count() != CurrentVersion)
            throw new InvalidOperationException("Migration resources are missing or duplicated.");
        return resources;
    }

    // MySQL DDL implicitly commits. A session lock, completion flag, checksum and idempotent statements permit recovery.
    private async Task MigrateMySql(System.Data.Common.DbConnection db, List<MigrationResource> resources, CancellationToken ct)
    {
        // Canonicalize on case-insensitive MySQL hosts (including Windows) so casing cannot bypass the lock.
        var databaseName = await dapper.ExecuteScalarAsync<string>(db, new CommandDefinition(sql.GetSqlQuery("MigrationDatabaseName"), cancellationToken: ct))
            ?? throw new InvalidOperationException("Select the MySQL migration database.");
        var name = "repairledger:" + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(databaseName)))[..32];
        if (await dapper.ExecuteScalarAsync<int?>(db, new CommandDefinition(sql.GetSqlQuery("MigrationLock"), new { name }, commandTimeout: 45, cancellationToken: ct)) != 1)
            throw new InvalidOperationException("Another process holds the MySQL migration lock. Retry later.");
        try
        {
            await dapper.ExecuteAsync(db, new CommandDefinition(sql.GetSqlQuery("BootstrapMigrations"), cancellationToken: ct));
            if (await dapper.ExecuteScalarAsync<int>(db, new CommandDefinition(sql.GetSqlQuery("MaximumMigrationVersion"), cancellationToken: ct)) > CurrentVersion)
                throw new InvalidOperationException("The database schema is newer than this API.");
            foreach (var resource in resources)
            {
                var script = sql.ReadResource(resource.Name);
                var checksum = SqlScriptHelper.Checksum(script);
                var previous = await dapper.ExecuteScalarAsync<string>(db, new CommandDefinition(sql.GetSqlQuery("MigrationChecksum"),
                    new { version = resource.Version }, cancellationToken: ct));
                if (previous != null && !string.Equals(previous, checksum, StringComparison.Ordinal))
                    throw new InvalidOperationException($"Migration {resource.Version} changed after it started. Restore the original SQL before retrying.");
                if (await dapper.ExecuteScalarAsync<int>(db, new CommandDefinition(sql.GetSqlQuery("HasMigration"),
                    new { version = resource.Version }, cancellationToken: ct)) != 0) continue;
                var parameters = new { version = resource.Version, checksum, at = DateTimeOffset.UtcNow.ToString("O") };
                await dapper.ExecuteAsync(db, new CommandDefinition(sql.GetSqlQuery("BeginMigration"), parameters, cancellationToken: ct));
                foreach (var statement in SqlScriptHelper.SplitStatements(script))
                {
                    if (await AlreadyApplied(db, statement, ct)) continue;
                    await dapper.ExecuteAsync(db, new CommandDefinition(statement, new { migrationAt = parameters.at }, cancellationToken: ct));
                }
                await dapper.ExecuteAsync(db, new CommandDefinition(sql.GetSqlQuery("RecordMigration"), parameters, cancellationToken: ct));
                logger.LogInformation("Applied MySQL schema migration {Version}", resource.Version);
            }
        }
        finally
        {
            try { await dapper.ExecuteScalarAsync<int?>(db, new CommandDefinition(sql.GetSqlQuery("ReleaseMigrationLock"), new { name }, commandTimeout: 10)); }
            catch (Exception error)
            {
                logger.LogWarning(error, "Could not release the MySQL migration lock; clearing the startup connection pool.");
                await MySqlConnector.MySqlConnection.ClearPoolAsync((MySqlConnector.MySqlConnection)db);
            }
        }
    }

    private async Task<bool> AlreadyApplied(System.Data.Common.DbConnection db, string statement, CancellationToken ct)
    {
        var match = System.Text.RegularExpressions.Regex.Match(statement,
            @"^ALTER\s+TABLE\s+\x60?(?<table>[a-z_]+)\x60?\s+ADD\s+(?<kind>COLUMN|CONSTRAINT|UNIQUE\s+KEY|KEY)\s+\x60?(?<name>[a-z_]+)\x60?",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        if (!match.Success) return false;
        var query = match.Groups["kind"].Value.ToUpperInvariant() switch
        {
            "COLUMN" => "MigrationColumnExists",
            "CONSTRAINT" => "MigrationConstraintExists",
            _ => "MigrationIndexExists"
        };
        return await dapper.ExecuteScalarAsync<int>(db, new CommandDefinition(sql.GetSqlQuery(query),
            new { table = match.Groups["table"].Value, name = match.Groups["name"].Value }, cancellationToken: ct)) > 0;
    }

}
