using Dapper;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using RepairLedger.Api.Business;
using RepairLedger.Api.DataAccess;
using RepairLedger.Api.Errors;
using RepairLedger.Api.Helpers;
using RepairLedger.Api.Models;
using RepairLedger.Api.Models.Inputs;
using RepairLedger.Api.Utils;
using Xunit;

namespace RepairLedger.Api.Tests;

public sealed class MobileTests : IAsyncLifetime
{
    private readonly string? mysql = Environment.GetEnvironmentVariable("REPAIRLEDGER_TEST_MYSQL");
    private readonly string schema = "rl_test_" + Guid.NewGuid().ToString("N");
    private readonly string path = Path.Combine(Path.GetTempPath(), "repairledger-mobile-" + Guid.NewGuid().ToString("N") + ".db");
    private DbConnectionHelper database = null!;
    private RepairDAL repairs = null!;
    private MobileBL mobile = null!;
    private static readonly Actor Owner = new("owner", "workspace", "owner", "owner@example.test", null, []);
    private static readonly Actor Resident = new("resident", "workspace", "tenant", "resident@example.test", null, new() { ["p1"] = ["204"] });
    private static readonly Actor Watchman = new("watchman", "workspace", "watchman", "watchman@example.test", null, [], ["p1"]);
    public async Task InitializeAsync()
    {
        try
        {
            DefaultTypeMap.MatchNamesWithUnderscores = true;
            var config = new ConfigurationManager { ["Database:Provider"] = mysql == null ? "Sqlite" : "MySql", ["Database:AutoMigrate"] = "true" };
            if (mysql != null)
            {
                await using var setup = new MySqlConnector.MySqlConnection(mysql); await setup.OpenAsync();
                await setup.ExecuteAsync($"CREATE DATABASE {schema} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs");
            }
            config["Database:ConnectionString"] = mysql == null ? $"Data Source={path};Foreign Keys=True;Default Timeout=5" : new MySqlConnector.MySqlConnectionStringBuilder(mysql) { Database = schema }.ConnectionString;
            database = new DbConnectionHelper(config, new WorkflowTests.TestEnvironment());
            var sql = new SqlFileQueryHelper(database); var dapper = new DapperHelper(config);
            await new DatabaseMigrationHelper(database, sql, dapper, config, NullLogger<DatabaseMigrationHelper>.Instance).Initialize(default);
            repairs = new RepairDAL(database, sql, dapper); mobile = new MobileBL(new MobileDAL(database, sql, dapper), TimeProvider.System);
            foreach (var id in new[] { "p1", "p2" }) await repairs.SaveProperty(Owner, new Property { Id = id, Name = "Building " + id, Address = "Test address", Units = 5, Timezone = "UTC" }, true, default);
            await repairs.SaveVendor(Owner, new Vendor { Id = "v", Name = "Test contractor", Trade = "Plumbing", Status = "approved" }, default);
        }
        catch { await DisposeAsync(); throw; }
    }
    public async Task DisposeAsync()
    {
        if (database != null) await database.DisposeAsync();
        Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
        if (mysql != null)
        {
            if (!System.Text.RegularExpressions.Regex.IsMatch(schema, "^rl_test_[a-f0-9]{32}$")) throw new InvalidOperationException("Unsafe test schema name.");
            await using var cleanup = new MySqlConnector.MySqlConnection(mysql); await cleanup.OpenAsync();
            await cleanup.ExecuteAsync($"DROP DATABASE IF EXISTS {schema}");
        }
        foreach (var suffix in new[] { "", "-wal", "-shm" }) if (File.Exists(path + suffix)) File.Delete(path + suffix);
    }
    private async Task<Repair> Visit(string property = "p1", string status = "confirmed", int dayOffset = 0)
    {
        var now = DateTimeOffset.UtcNow.AddDays(dayOffset);
        var repair = new Repair { Id = Guid.NewGuid().ToString("N"), WorkspaceId = Owner.WorkspaceId, PropertyId = property, Property = "Building " + property,
            Unit = "204", Resident = "PRIVATE RESIDENT", Access = "PRIVATE ACCESS", AccessNotes = "PRIVATE ACCESS NOTES", Description = "PRIVATE DESCRIPTION", Title = "Private unit repair",
            Category = "Plumbing", AssignedVendorId = "v", AssignedVendorName = "Test contractor", VendorDecision = "accepted", State = "scheduled" };
        repair.Appointments.Add(new Appointment { StartsAt = now.ToString("O"), EndsAt = now.AddHours(1).ToString("O"), Timezone = "UTC", Status = status,
            ResidentConfirmedAt = status == "confirmed" ? now.ToString("O") : null, VendorConfirmedAt = now.ToString("O") });
        return await repairs.Create(Owner, repair, default);
    }
    private CreateCommonAreaInput Report(string property = "p1", string? submission = null) => new(submission ?? Guid.NewGuid().ToString("D"), property, "Lift lobby", "Broken corridor light", "Electrical", "Light does not turn on");
    [Fact]
    public async Task Context_and_visits_use_assigned_buildings_not_editable_unit_claims()
    {
        var context = await mobile.Context(Watchman, default); Assert.Equal("p1", Assert.Single(context.Properties).Id); Assert.Empty(context.Properties[0].Units);
        var resident = await mobile.Context(Resident, default); Assert.Equal("204", Assert.Single(resident.Properties[0].Units));
        await Visit(); await Visit("p2"); await Visit(status: "proposed"); await Visit(dayOffset: 1);
        Assert.Single(await mobile.Visits(Watchman, default));
        var fake = Watchman with { AssignedPropertyIds = null, PropertyUnits = new() { ["p1"] = ["204"] } };
        Assert.Empty((await mobile.Context(fake, default)).Properties); Assert.Empty(await mobile.Visits(fake, default));
        Assert.Equal(403, (await Assert.ThrowsAsync<ApiException>(() => mobile.Visits(Resident, default))).Status);
    }
    [Fact]
    public async Task Watchman_never_receives_full_repairs_or_sensitive_fields()
    {
        var repair = await Visit(); Assert.Empty(await repairs.List(Watchman, default));
        Assert.False(Watchman.CanAccess(repair)); Assert.False(Watchman.IsManager);
        Assert.Equal(404, (await Assert.ThrowsAsync<ApiException>(() => repairs.Get(Watchman, repair.Id, default))).Status);
        var json = System.Text.Json.JsonSerializer.Serialize(Assert.Single(await mobile.Visits(Watchman, default)));
        Assert.DoesNotContain("PRIVATE", json); Assert.DoesNotContain("Description", json); Assert.DoesNotContain("RepairState", json); Assert.DoesNotContain("Cost", json);
        Assert.Equal(403, Assert.Throws<ApiException>(Watchman.RequireManager).Status);
    }
    [Fact]
    public async Task Arrival_and_departure_are_revision_checked_and_do_not_change_repair_state()
    {
        var repair = await Visit(); var visit = Assert.Single(await mobile.Visits(Watchman, default));
        Assert.Equal(409, (await Assert.ThrowsAsync<ApiException>(() => mobile.Presence(Watchman, visit.Id, new("depart", 0), default))).Status);
        var arrived = await mobile.Presence(Watchman, visit.Id, new("arrive", 0), default); Assert.NotNull(arrived.ArrivedAt); Assert.Equal(1, arrived.Revision);
        Assert.Equal(409, (await Assert.ThrowsAsync<ApiException>(() => mobile.Presence(Watchman, visit.Id, new("arrive", 0), default))).Status);
        var departed = await mobile.Presence(Watchman, visit.Id, new("depart", 1), default); Assert.NotNull(departed.DepartedAt); Assert.Equal(2, departed.Revision);
        Assert.Equal("scheduled", (await repairs.Get(Owner, repair.Id, default)).State);
        await using var db = await database.Open(default); Assert.Equal(Watchman.Id, await db.ExecuteScalarAsync<string>("SELECT arrived_by FROM gate_presence WHERE workspace_id=@workspace AND appointment_id=@id", new { workspace = Watchman.WorkspaceId, id = visit.Id }));
    }
    [Fact]
    public async Task Cross_building_and_cross_workspace_gate_actions_fail_closed()
    {
        var other = await Visit("p2"); var appointment = other.Appointments[0].Id;
        Assert.Equal(404, (await Assert.ThrowsAsync<ApiException>(() => mobile.Presence(Watchman, appointment, new("arrive", 0), default))).Status);
        var repair = await Visit(); var foreign = Watchman with { WorkspaceId = "foreign" };
        Assert.Empty(await mobile.Visits(foreign, default));
        Assert.Equal(404, (await Assert.ThrowsAsync<ApiException>(() => mobile.Presence(foreign, repair.Appointments[0].Id, new("arrive", 0), default))).Status);
    }
    [Fact]
    public async Task Open_gate_presence_can_be_checked_out_after_repair_cancellation()
    {
        var repair = await Visit(); var visit = Assert.Single(await mobile.Visits(Watchman, default));
        await mobile.Presence(Watchman, visit.Id, new("arrive", 0), default);
        await repairs.Mutate(Owner, repair.Id, r => { r.State = "cancelled"; r.Appointments[0].Status = "cancelled"; }, default);
        Assert.Single(await mobile.Visits(Watchman, default));
        var departure = await mobile.Presence(Watchman, visit.Id, new("depart", 1), default); Assert.NotNull(departure.DepartedAt);
        Assert.Empty(await mobile.Visits(Watchman, default));
    }
    [Fact]
    public async Task Shared_reports_are_scoped_idempotent_and_do_not_consume_unit_capacity()
    {
        var input = Report(); var first = await mobile.Report(Watchman, input, default);
        var retry = await mobile.Report(Watchman, input, default); Assert.Equal(first.Id, retry.Id);
        Assert.Equal(409, (await Assert.ThrowsAsync<ApiException>(() => mobile.Report(Watchman, input with { Title = "Different report" }, default))).Status);
        Assert.Equal(404, (await Assert.ThrowsAsync<ApiException>(() => mobile.Report(Watchman, Report("p2"), default))).Status);
        await mobile.Report(Owner, Report("p2"), default);
        Assert.Single(await mobile.Issues(Watchman, default)); Assert.Single(await mobile.Issues(Resident, default));
        Assert.Empty(await mobile.Issues(Watchman with { WorkspaceId = "foreign" }, default));
        await using var db = await database.Open(default); Assert.Equal(0, await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM property_units"));
        Assert.Equal(2, await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM common_area_issue_events"));
        var json = System.Text.Json.JsonSerializer.Serialize(first); Assert.DoesNotContain("ReportedBy", json); Assert.DoesNotContain("SubmissionId", json);
    }
    [Fact]
    public async Task Only_managers_can_publish_revision_checked_public_updates()
    {
        var issue = await mobile.Report(Resident, Report(), default);
        Assert.Equal(403, (await Assert.ThrowsAsync<ApiException>(() => mobile.UpdateIssue(Watchman, issue.Id, new("resolved", "Fixed light", 0), default))).Status);
        Assert.Equal(403, (await Assert.ThrowsAsync<ApiException>(() => mobile.UpdateIssue(Resident, issue.Id, new("resolved", "Fixed light", 0), default))).Status);
        var active = await mobile.UpdateIssue(Owner, issue.Id, new("in_progress", "Electrician assigned", 0), default); Assert.Equal(1, active.Revision);
        Assert.Equal(409, (await Assert.ThrowsAsync<ApiException>(() => mobile.UpdateIssue(Owner, issue.Id, new("resolved", "Fixed light", 0), default))).Status);
        var done = await mobile.UpdateIssue(Owner, issue.Id, new("resolved", "Replaced light and tested", 1), default); Assert.Equal("resolved", done.Status);
        Assert.Equal(409, (await Assert.ThrowsAsync<ApiException>(() => mobile.UpdateIssue(Owner, issue.Id, new("in_progress", "Reopened", 2), default))).Status);
        await using var db = await database.Open(default); Assert.Equal(3, await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM common_area_issue_events"));
    }
    [Fact]
    public async Task Active_shared_reports_block_property_archive_until_resolved()
    {
        var issue = await mobile.Report(Watchman, Report(), default);
        Assert.Equal(409, (await Assert.ThrowsAsync<ApiException>(() => repairs.ArchiveProperty(Owner, "p1", default))).Status);
        await mobile.UpdateIssue(Owner, issue.Id, new("resolved", "Issue fixed and inspected", 0), default);
        await repairs.ArchiveProperty(Owner, "p1", default);
        Assert.Empty((await mobile.Context(Watchman, default)).Properties);
        Assert.Equal(404, (await Assert.ThrowsAsync<ApiException>(() => mobile.Report(Watchman, Report(), default))).Status);
    }
    [Theory]
    [InlineData("2026-10-02T20:00:00+00:00", "2026-10-03T02:00:00+00:00", "Asia/Kolkata", true)]
    [InlineData("2026-10-02T20:00:00+00:00", "2026-10-03T02:00:00+00:00", "America/Los_Angeles", true)]
    [InlineData("2026-10-02T10:00:00+00:00", "2026-10-03T02:00:00+00:00", "Asia/Kolkata", false)]
    [InlineData("2026-10-02T10:00:00+00:00", "2026-10-03T02:00:00+00:00", "invalid-zone", false)]
    public void Gate_day_is_property_local_not_device_local(string start, string now, string timezone, bool expected)
        => Assert.Equal(expected, MobileBL.IsVisitDay(new GateVisit { StartsAt = start, Timezone = timezone }, DateTimeOffset.Parse(now)));
}
