using Dapper;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using RepairLedger.Api.DataAccess;
using RepairLedger.Api.Helpers;
using RepairLedger.Api.Models;
using RepairLedger.Api.Utils;
using Xunit;

namespace RepairLedger.Api.Tests;

public sealed class MigrationTests
{

    [Fact]
    public Task Version_one_upgrades_without_losing_history_and_is_idempotent() => WithDatabase(async (connection, sql, dapper, config) =>
    {
            await using (var db = await connection.Open(default))
            {
                await db.ExecuteAsync(sql.GetSqlQuery("BootstrapMigrations"));
                await db.ExecuteAsync(sql.ReadResource($"RepairLedger.Api.DatabaseScripts.{(connection.Provider == RepairLedger.Api.Enums.DatabaseConnectionType.MySql ? "MySql" : "Common")}.001_initial.sql"));
                await db.ExecuteAsync(sql.GetSqlQuery("RecordMigration"), new { version = 1, at = DateTimeOffset.UtcNow.ToString("O"), checksum = (string?)null });
                await db.ExecuteAsync(sql.GetSqlQuery("ImportProperty"), new Property { WorkspaceId = "legacy", Id = "p", Name = "Property", Address = "Address", Units = 1 });
                await db.ExecuteAsync(sql.GetSqlQuery("InsertVendor"), new Vendor { WorkspaceId = "legacy", Id = "v", Name = "Vendor", Trade = "Plumbing" });
                // Use the v1 INSERT shape; v2 query resources must never be needed to upgrade an old database.
                await db.ExecuteAsync(sql.GetSqlQuery("InsertRepair"), new Repair { WorkspaceId = "legacy", Id = "r", Title = "Old repair",
                    PropertyId = "p", Property = "Property", Unit = "3B", Resident = "Resident", Category = "Plumbing", Description = "Old repair",
                    Access = "Home", State = "closed", Revision = 7, AssignedVendorId = "v", VendorDecision = "accepted",
                    VerificationJson = System.Text.Json.JsonSerializer.Serialize(new Verification("verified", "Fixed", "2026-09-01T10:00:00.0000000+00:00")) });
            }
            var migrator = new DatabaseMigrationHelper(connection, sql, dapper, config, NullLogger<DatabaseMigrationHelper>.Instance);
            await migrator.Initialize(default); await migrator.Initialize(default);
            var actor = new Actor("owner", "legacy", "owner", "owner@example.com", null, []);
            var dal = new RepairDAL(connection, sql, dapper);
            var repair = await dal.Get(actor, "r", default);
            Assert.Equal(7, repair.Revision); Assert.Equal("closed", repair.State); Assert.NotNull(repair.UnitId);
            Assert.True(Assert.Single(repair.Offers).LegacySnapshot); Assert.Null(repair.Offers[0].OfferedAt);
            Assert.True(Assert.Single(repair.VerificationHistory).LegacySnapshot);
            Assert.Equal("verified", repair.VerificationHistory[0].Status);
            Assert.Equal("Fixed", repair.VerificationHistory[0].Note);
            Assert.False(repair.ResidentLinked); // Never auto-share legacy history with the current resident.
            await using var check = await connection.Open(default);
            Assert.Equal(DatabaseMigrationHelper.CurrentVersion, await check.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM schema_migrations"));
            Assert.Equal(1, await check.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM request_locations"));
            Assert.Equal(1, await check.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM workspaces"));
            config["Database:AutoMigrate"] = "false"; await migrator.Initialize(default);

    });

    [Fact]
    public Task Final_schema_snapshot_is_executable_and_matches_the_runtime() => WithDatabase(async (connection, sql, dapper, config) =>
    {
        var provider = connection.Provider == RepairLedger.Api.Enums.DatabaseConnectionType.MySql ? "MySql" : "Sqlite";
        var snapshot = Path.GetFullPath(Path.Combine(new WorkflowTests.TestEnvironment().ContentRootPath, $"../../docs/schema/RepairLedger-Final-{provider}.sql"));
        await using (var db = await connection.Open(default))
            await db.ExecuteAsync(await File.ReadAllTextAsync(snapshot));
        var migrator = new DatabaseMigrationHelper(connection, sql, dapper, config, NullLogger<DatabaseMigrationHelper>.Instance);
        await migrator.Initialize(default);
        var actor = new Actor("owner", "baseline", "owner", "owner@example.com", null, []);
        var dal = new RepairDAL(connection, sql, dapper);
        await dal.SaveProperty(actor, new Property { Id = "p", Name = "Property", Address = "Address", Units = 2 }, true, default);
        var repair = await new RepairLedger.Api.Business.RepairBL(dal).Create(actor,
            new("Leaking tap", null, "p", "3B", "Resident", "Plumbing", "Tap is leaking"), default);
        Assert.NotNull(repair.UnitId);
        Assert.Equal(repair.Id, (await dal.Get(actor, repair.Id, default)).Id);
        await using var check = await connection.Open(default);
        Assert.Equal(DatabaseMigrationHelper.CurrentVersion, await check.ExecuteScalarAsync<int>("SELECT MAX(version) FROM schema_migrations"));
    });


    [Theory]
    [InlineData(2)]
    [InlineData(3)]
    [InlineData(4)]
    [InlineData(5)]
    public Task MySql_recovers_from_a_partly_committed_DDL_migration(int interruptedVersion) => WithDatabase(async (connection, sql, dapper, config) =>
    {
        if (connection.Provider != RepairLedger.Api.Enums.DatabaseConnectionType.MySql) return;
        await using (var db = await connection.Open(default))
        {
            await db.ExecuteAsync(sql.GetSqlQuery("BootstrapMigrations"));
            for (var version = 1; version <= interruptedVersion; version++)
            {
                var file = version switch { 1 => "001_initial", 2 => "002_relational_history", 3 => "003_integrity", 4 => "004_mobile_operations", _ => "005_resident_privacy" };
                var script = sql.ReadResource($"RepairLedger.Api.DatabaseScripts.MySql.{file}.sql");
                var parameters = new { version, at = DateTimeOffset.UtcNow.ToString("O"),
                    checksum = SqlScriptHelper.Checksum(script) };
                await db.ExecuteAsync(sql.GetSqlQuery("BeginMigration"), parameters);
                var statements = SqlScriptHelper.SplitStatements(script).ToList();
                var selected = version < interruptedVersion ? statements : statements.Take(interruptedVersion == 2 ? statements.Count - 2 : 3);
                foreach (var statement in selected) await db.ExecuteAsync(statement, new { migrationAt = parameters.at });
                if (version < interruptedVersion) await db.ExecuteAsync(sql.GetSqlQuery("RecordMigration"), parameters);
            }
            Assert.Equal(-1, await db.ExecuteScalarAsync<int>(sql.GetSqlQuery("SchemaVersion")));
        }
        var migrator = new DatabaseMigrationHelper(connection, sql, dapper, config, NullLogger<DatabaseMigrationHelper>.Instance);
        await migrator.Initialize(default);
        await migrator.Initialize(default);
        await using var check = await connection.Open(default);
        Assert.Equal(DatabaseMigrationHelper.CurrentVersion, await check.ExecuteScalarAsync<int>(sql.GetSqlQuery("SchemaVersion")));
        Assert.Equal(DatabaseMigrationHelper.CurrentVersion, await check.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM schema_migrations WHERE completed=1"));
    });

    [Fact]
    public Task MySql_rejects_a_changed_migration_checksum() => WithDatabase(async (connection, sql, dapper, config) =>
    {
        if (connection.Provider != RepairLedger.Api.Enums.DatabaseConnectionType.MySql) return;
        await using (var db = await connection.Open(default))
        {
            await db.ExecuteAsync(sql.GetSqlQuery("BootstrapMigrations"));
            await db.ExecuteAsync(sql.GetSqlQuery("BeginMigration"),
                new { version = 1, at = DateTimeOffset.UtcNow.ToString("O"), checksum = new string('0', 64) });
        }
        var migrator = new DatabaseMigrationHelper(connection, sql, dapper, config, NullLogger<DatabaseMigrationHelper>.Instance);
        var error = await Assert.ThrowsAsync<InvalidOperationException>(() => migrator.Initialize(default));
        Assert.Contains("changed after it started", error.Message);
    });

    private static async Task WithDatabase(Func<DbConnectionHelper, SqlFileQueryHelper, DapperHelper, ConfigurationManager, Task> test)
    {
        var mysql = Environment.GetEnvironmentVariable("REPAIRLEDGER_TEST_MYSQL");
        var schema = "rl_test_" + Guid.NewGuid().ToString("N");
        var path = Path.Combine(Path.GetTempPath(), $"repairledger-upgrade-{Guid.NewGuid():N}.db");
        var config = new ConfigurationManager();
        config["Database:Provider"] = mysql == null ? "Sqlite" : "MySql";
        config["Database:ConnectionString"] = mysql == null ? $"Data Source={path};Foreign Keys=True" : new MySqlConnector.MySqlConnectionStringBuilder(mysql) { Database = schema }.ConnectionString;
        config["Database:AutoMigrate"] = "true";
        if (mysql != null)
        {
            await using var setup = new MySqlConnector.MySqlConnection(mysql); await setup.OpenAsync();
            await setup.ExecuteAsync($"CREATE DATABASE {schema} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs");
        }

        try
        {
            await using var connection = new DbConnectionHelper(config, new WorkflowTests.TestEnvironment());
            await test(connection, new SqlFileQueryHelper(connection), new DapperHelper(config), config);
        }
        finally
        {
            Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
            if (mysql != null)
            {
                await using var cleanup = new MySqlConnector.MySqlConnection(mysql); await cleanup.OpenAsync();
                if (!System.Text.RegularExpressions.Regex.IsMatch(schema, "^rl_test_[a-f0-9]{32}$")) throw new InvalidOperationException("Unsafe database name.");
                await cleanup.ExecuteAsync($"DROP DATABASE {schema}");
            }
            foreach (var suffix in new[] { "", "-wal", "-shm" }) if (File.Exists(path + suffix)) File.Delete(path + suffix);
        }
    }
}
