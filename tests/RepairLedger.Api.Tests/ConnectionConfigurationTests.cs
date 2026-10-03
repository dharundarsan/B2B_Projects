using Microsoft.Extensions.Configuration;
using RepairLedger.Api.Helpers;
using Xunit;
namespace RepairLedger.Api.Tests;

public sealed class ConnectionConfigurationTests
{
    private static ConfigurationManager Config(string provider, string connection) => new()
    {
        ["Database:Provider"] = provider,
        ["Database:ConnectionString"] = connection
    };

    [Theory]
    [InlineData("Disabled")]
    [InlineData("Preferred")]
    [InlineData("Required")]
    [InlineData("VerifyCA")]
    public void Production_requires_hostname_and_certificate_verification(string ssl)
    {
        var config = Config("MySql", $"Server=localhost;Database=repairledger;User ID=test;SslMode={ssl}");
        var environment = new WorkflowTests.TestEnvironment { EnvironmentName = "Production" };
        Assert.Throws<InvalidOperationException>(() => new DbConnectionHelper(config, environment));
    }

    [Fact]
    public async Task Production_accepts_VerifyFull_configuration_without_opening_a_connection()
    {
        var config = Config("MySql", "Server=localhost;Database=repairledger;User ID=test;SslMode=VerifyFull");
        await using var helper = new DbConnectionHelper(config, new WorkflowTests.TestEnvironment { EnvironmentName = "Production" });
        Assert.Equal(RepairLedger.Api.Enums.DatabaseConnectionType.MySql, helper.Provider);
    }

    [Fact]
    public void Production_rejects_SQLite() =>
        Assert.Throws<InvalidOperationException>(() => new DbConnectionHelper(Config("Sqlite", "Data Source=unused.db"),
            new WorkflowTests.TestEnvironment { EnvironmentName = "Production" }));

    [Fact]
    public void Retired_provider_fails_with_a_clear_configuration_error() =>
        Assert.Throws<InvalidOperationException>(() => new DbConnectionHelper(Config("Postgres", "unused"),
            new WorkflowTests.TestEnvironment()));

    [Fact]
    public void Missing_credentials_fail_explicitly_instead_of_creating_a_fallback_database() =>
        Assert.Throws<InvalidOperationException>(() => new DbConnectionHelper(Config("MySql", ""), new WorkflowTests.TestEnvironment()));
}
