using Microsoft.Extensions.Configuration;
using RepairLedger.Api.Helpers;
using RepairLedger.Api.Models;
using RepairLedger.Api.Utils;
using Xunit;
namespace RepairLedger.Api.Tests;

public sealed class DatabaseCommandTests
{
    [Fact]
    public void Check_forces_auto_migration_off_without_changing_demo_configuration()
    {
        var config = new ConfigurationManager
        {
            ["check-database"] = "true", ["Database:AutoMigrate"] = "true", ["Demo:Enabled"] = "true"
        };
        StartupHelper.ConfigureCommandOptions(config);
        Assert.Equal("false", config["Database:AutoMigrate"]);
        Assert.Equal("true", config["Demo:Enabled"]);
    }

    [Fact]
    public void Only_explicit_migrate_enables_auto_migration()
    {
        var config = new ConfigurationManager { ["migrate-only"] = "true", ["Database:AutoMigrate"] = "false" };
        StartupHelper.ConfigureCommandOptions(config);
        Assert.Equal("true", config["Database:AutoMigrate"]);
    }

    [Theory]
    [InlineData(true, true, false)]
    [InlineData(true, false, true)]
    [InlineData(false, true, true)]
    [InlineData(true, true, true)]
    public void Conflicting_commands_fail_before_database_configuration_changes(bool check, bool migrate, bool import)
    {
        var config = new ConfigurationManager
        {
            ["check-database"] = check.ToString(), ["migrate-only"] = migrate.ToString(),
            ["import"] = import ? "synthetic.json" : null, ["Database:AutoMigrate"] = "false"
        };
        Assert.Throws<InvalidOperationException>(() => StartupHelper.ConfigureCommandOptions(config));
        Assert.Equal("false", config["Database:AutoMigrate"]);
    }

    [Theory]
    [InlineData(5, true, true, true, true, true)]
    [InlineData(-1, true, true, true, true, false)]
    [InlineData(2, true, true, true, true, false)]
    [InlineData(6, true, true, true, true, false)]
    [InlineData(4, true, true, true, true, false)]
    [InlineData(3, true, true, true, true, false)]
    [InlineData(5, false, true, true, true, false)]
    [InlineData(5, true, false, true, true, false)]
    [InlineData(5, true, true, false, true, false)]
    [InlineData(5, true, true, true, false, false)]
    public void Readiness_requires_schema_metadata_strict_mode_and_all_InnoDB_tables(int version, bool metadata,
        bool strict, bool allTables, bool engines, bool expected)
    {
        var result = new DatabaseCheckResult("8.4.11", version, metadata, strict,
            allTables ? [] : ["requests"], engines ? [] : ["estimates"]);
        Assert.Equal(expected, result.Ready);
    }

    [Fact]
    public async Task MySql_check_cannot_create_an_accidental_SQLite_file()
    {
        var path = Path.Combine(Path.GetTempPath(), "repairledger-no-create-" + Guid.NewGuid().ToString("N") + ".db");
        var config = new ConfigurationManager { ["Database:Provider"] = "Sqlite", ["Database:ConnectionString"] = $"Data Source={path}" };
        await using var connection = new DbConnectionHelper(config, new WorkflowTests.TestEnvironment());
        var inspector = new DatabasePreflightHelper(connection, new SqlFileQueryHelper(connection), new DapperHelper(config));
        await Assert.ThrowsAsync<InvalidOperationException>(() => inspector.Inspect(default));
        Assert.False(File.Exists(path));
    }
}
