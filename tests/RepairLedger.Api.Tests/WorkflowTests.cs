using Dapper;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using RepairLedger.Api.Models.Inputs;
using RepairLedger.Api.Models;
using RepairLedger.Api.ExternalAPI;
using RepairLedger.Api.Errors;
using RepairLedger.Api.Business;
using RepairLedger.Api.DataAccess;
using RepairLedger.Api.Helpers;
using RepairLedger.Api.Utils;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace RepairLedger.Api.Tests;

public sealed class WorkflowTests : IAsyncLifetime
{
    private readonly string? mysql = Environment.GetEnvironmentVariable("REPAIRLEDGER_TEST_MYSQL");
    private readonly string testDatabase = "rl_test_" + Guid.NewGuid().ToString("N");
    private readonly string path = Path.Combine(Path.GetTempPath(), $"repairledger-test-{Guid.NewGuid():N}.db");
    private DbConnectionHelper database = null!;
    private RepairDAL repository = null!;
    private RepairBL service = null!;
    private static readonly Actor Owner = new("owner", "test-workspace", "owner", "owner@example.com", null, []);
    private static readonly Actor Vendor = new("vendor-user", "test-workspace", "vendor", "vendor@example.com", "vendor", []);
    private const string OccupancyId = "22222222-2222-4222-8222-222222222222";
    private static readonly Actor Resident = new("11111111-1111-4111-8111-111111111111", "test-workspace", "tenant", "resident@example.com", null,
        new() { ["property"] = ["3B"] }, ResidentOccupancies: [new(OccupancyId, "property", "3B", DateTimeOffset.UtcNow.AddYears(-1), null)]);
    private static readonly Actor Demo = new("demo", "test-workspace", "demo", "demo@example.com", null, []);
    public async Task InitializeAsync()
    {
        try
        {
            DefaultTypeMap.MatchNamesWithUnderscores = true;
            var config = new ConfigurationManager();
            config["Database:Provider"] = mysql == null ? "Sqlite" : "MySql";
            if (mysql != null)
            {
                await using var connection = new MySqlConnector.MySqlConnection(mysql); await connection.OpenAsync();
                // Identifier is generated entirely by this fixture, never supplied by a caller.
                await connection.ExecuteAsync($"CREATE DATABASE {testDatabase} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs");
            }
            config["Database:ConnectionString"] = mysql == null ? $"Data Source={path};Foreign Keys=True;Default Timeout=5" : new MySqlConnector.MySqlConnectionStringBuilder(mysql) { Database = testDatabase }.ConnectionString;
            config["Database:AutoMigrate"] = "true";
            database = new DbConnectionHelper(config, new TestEnvironment());
            await new DatabaseMigrationHelper(database, new SqlFileQueryHelper(database), new DapperHelper(config), config, NullLogger<DatabaseMigrationHelper>.Instance).Initialize(default);
            repository = new RepairDAL(database, new SqlFileQueryHelper(database), new DapperHelper(config)); service = new RepairBL(repository);
            await repository.SaveProperty(Owner, new Property { Id = "property", Name = "Test property", Address = "Test address", Units = 10, Timezone = "UTC" }, true, default);
            await repository.SaveVendor(Owner, new Vendor { Id = "vendor", Name = "Test vendor", Trade = "Plumbing", Status = "approved" }, default);
        }
        catch { await DisposeAsync(); throw; }
    }
    public async Task DisposeAsync()
    {
        if (database != null) await database.DisposeAsync();
        Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
        if (mysql != null)
        {
            await using var connection = new MySqlConnector.MySqlConnection(mysql); await connection.OpenAsync();
            if (!System.Text.RegularExpressions.Regex.IsMatch(testDatabase, "^rl_test_[a-f0-9]{32}$")) throw new InvalidOperationException("Invalid test database.");
            await connection.ExecuteAsync($"DROP DATABASE IF EXISTS {testDatabase}");
        }
        foreach (var suffix in new[] { "", "-wal", "-shm" }) if (File.Exists(path + suffix)) File.Delete(path + suffix);
    }
    private Task<Repair> Create(string unit = "3B", string priority = "routine") => service.Create(Owner, new("Leaking tap", null, "property", unit, "Resident", "Plumbing", "Tap is leaking", priority,
        SafetyAnswers: new() { ["waterFlowing"] = "Yes" }, ResidentUserId: unit == "3B" ? Resident.Id : null, ResidentOccupancyId: unit == "3B" ? OccupancyId : null), default);
    private async Task<Repair> Quoted()
    {
        var r = await Create();
        await service.Offer(Owner, r.Id, new("vendor", null, null), default, null);
        await service.VendorResponse(Vendor, r.Id, new("vendor", "accepted", null), default, null);
        return await service.SubmitEstimate(Vendor, r.Id, new("Replace tap washers", 0.10m, 0.20m, 0.03m), default, null);
    }
    [Fact]
    public async Task Full_workflow_requires_approval_confirmations_and_resident_verification()
    {
        var r = await Quoted(); Assert.Equal(0.33m, r.Estimate!.Total);
        await Assert.ThrowsAsync<ApiException>(() => service.StartWork(Vendor, r.Id, default, null));
        await service.ReviewEstimate(Owner, r.Id, r.Estimate.Id, true, null, default, null);
        var local = DateTime.UtcNow.AddDays(1).ToString("yyyy-MM-dd'T'HH:mm");
        r = await service.ProposeVisit(Owner, r.Id, new(local, 60, "UTC"), default, null);
        await Assert.ThrowsAsync<ApiException>(() => service.StartWork(Vendor, r.Id, default, null));
        await service.ConfirmVisit(Resident, r.Id, r.Appointment!.Id, new(true, null), default, null);
        r = await service.ConfirmVisit(Vendor, r.Id, r.Appointment.Id, new(true, null), default, null);
        Assert.Equal("confirmed", r.Appointment!.Status);
        await service.StartWork(Vendor, r.Id, default, null);
        r = await service.CompleteWork(Vendor, r.Id, default, null); Assert.Equal("verification", r.State);
        await Assert.ThrowsAsync<ApiException>(() => service.Verify(Owner, r.Id, new(true, null), default, null));
        r = await service.Verify(Resident, r.Id, new(true, "Now working"), default, null);
        Assert.Equal("closed", r.State); Assert.Equal("verified", r.ResidentVerification!.Status);
        var persisted = await repository.Get(Owner, r.Id, default); Assert.Equal(r.Revision, persisted.Revision); Assert.True(persisted.Events.Count >= 8);
    }
    [Fact]
    public async Task Workspace_unit_and_vendor_isolation_fail_closed()
    {
        var r = await Create(); await Create("4A");
        Assert.Single(await repository.List(Resident, default)); Assert.Empty(await repository.List(Vendor, default));
        var outsider = Owner with { Id = "other", WorkspaceId = "other-workspace" };
        Assert.Empty(await repository.List(outsider, default));
        Assert.Equal(404, (await Assert.ThrowsAsync<ApiException>(() => repository.Get(outsider, r.Id, default))).Status);
        Assert.Equal(403, (await Assert.ThrowsAsync<ApiException>(() => service.Create(Resident, new("Other repair", null, "property", "4A", "Resident", "Plumbing", "Broken tap"), default))).Status);
        await Assert.ThrowsAsync<ApiException>(() => repository.Vendors(Resident, default));
    }
    [Fact]
    public async Task Failed_and_stale_changes_roll_back_all_records()
    {
        var r = await Create(); var notifications = (await repository.Notifications(Owner, default)).Count;
        Assert.Equal(r.CreatedAt, (await repository.Get(Owner, r.Id, default)).CreatedAt);
        await Assert.ThrowsAsync<ApiException>(() => service.Transition(Owner, r.Id, new("closed", null), default, null));
        var updated = await service.Transition(Owner, r.Id, new("acknowledged", null), default, r.Revision);
        await Assert.ThrowsAsync<ApiException>(() => service.Transition(Owner, r.Id, new("waiting", null), default, r.Revision));
        var saved = await repository.Get(Owner, r.Id, default); Assert.Equal(updated.Revision, saved.Revision); Assert.Equal("acknowledged", saved.State);
        Assert.Equal(notifications + 1, (await repository.Notifications(Owner, default)).Count);
    }
    [Fact]
    public async Task Concurrent_updates_cannot_both_commit_the_same_revision()
    {
        var r = await Create();
        async Task<bool> Change()
        {
            try { await service.Transition(Owner, r.Id, new("acknowledged", "Concurrent test"), default, r.Revision); return true; }
            catch (ApiException e) when (e.Status == 409) { return false; }
            catch (Microsoft.Data.Sqlite.SqliteException e) when (e.SqliteErrorCode is 5 or 6) { return false; }
            catch (MySqlConnector.MySqlException e) when (e.Number is 1205 or 1213) { return false; }
        }
        var results = await Task.WhenAll(Change(), Change()); Assert.Single(results, x => x);
        var saved = await repository.Get(Owner, r.Id, default); Assert.Equal(r.Revision + 1, saved.Revision); Assert.Equal(r.Events.Count + 1, saved.Events.Count);
    }
    [Fact]
    public async Task Quote_revisions_are_append_only_and_previous_visits_cannot_be_confirmed()
    {
        var r = await Quoted(); var old = r.Estimate!.Id;
        await service.ReviewEstimate(Owner, r.Id, old, false, "Revise the scope", default, null);
        r = await service.SubmitEstimate(Vendor, r.Id, new("Replace and test washers", 10, 20, 3), default, null);
        Assert.Equal(2, r.Estimate!.Version); Assert.Equal(2, r.Estimates.Count);
        await Assert.ThrowsAsync<ApiException>(() => service.ReviewEstimate(Owner, r.Id, old, true, null, default, null));
        await service.ReviewEstimate(Owner, r.Id, r.Estimate.Id, true, null, default, null);
        r = await service.ProposeVisit(Owner, r.Id, new(DateTime.UtcNow.AddDays(1).ToString("yyyy-MM-dd'T'HH:mm"), 60, "UTC"), default, null);
        var first = r.Appointment!.Id;
        r = await service.ProposeVisit(Owner, r.Id, new(DateTime.UtcNow.AddDays(2).ToString("yyyy-MM-dd'T'HH:mm"), 60, "UTC"), default, null);
        Assert.Equal("cancelled", r.Appointments[0].Status);
        await Assert.ThrowsAsync<ApiException>(() => service.ConfirmVisit(Resident, r.Id, first, new(true, null), default, null));
    }
    [Fact]
    public async Task Archive_preserves_history_and_search_is_parameterized()
    {
        var r = await Create(); Assert.Equal("urgent", r.Priority);
        Assert.Empty(await repository.List(Owner, default, "' OR 1=1 --"));
        Assert.Single(await repository.List(Owner, default, "Leaking"));
        await Assert.ThrowsAsync<ApiException>(() => repository.ArchiveProperty(Owner, "property", default));
        await service.Transition(Owner, r.Id, new("cancelled", "Duplicate"), default, null);
        await repository.ArchiveProperty(Owner, "property", default);
        Assert.Empty(await repository.Properties(Owner, default)); Assert.Equal(r.Id, (await repository.Get(Owner, r.Id, default)).Id);
    }
    [Fact]
    public async Task Invalid_money_and_dst_times_are_rejected()
    {
        var r = await Quoted();
        await Assert.ThrowsAsync<ApiException>(() => service.SubmitEstimate(Vendor, r.Id, new("Scope", -1, 0, 0), default, null));
        await Assert.ThrowsAsync<ApiException>(() => service.ProposeVisit(Owner, r.Id, new("2026-11-01T01:30", 60, "America/New_York"), default, null));
        await Assert.ThrowsAsync<ApiException>(() => service.ProposeVisit(Owner, r.Id, new("2026-03-08T02:30", 60, "America/New_York"), default, null));
    }
    [Fact]
    public async Task Import_is_insert_only_and_rolls_back_the_entire_snapshot_on_a_conflict()
    {
        var imported = new MigrationWorkspace("import-workspace", [new Property { Id = "import-property", Name = "Imported", Address = "Imported address", Units = 2, Timezone = "UTC" }], [],
            [new Repair { Id = "import-repair", PropertyId = "import-property", Property = "Imported", Title = "Imported repair", Unit = "1", Resident = "Resident", Category = "Plumbing", Description = "Imported", Access = "Home" }], [], []);
        await repository.Import(new([imported]), default);
        var actor = Owner with { WorkspaceId = imported.Id };
        Assert.Single(await repository.List(actor, default));
        var newWorkspace = imported with { Id = "rolled-back-workspace" };
        await Assert.ThrowsAnyAsync<System.Data.Common.DbException>(() => repository.Import(new([newWorkspace, imported]), default));
        Assert.Empty(await repository.Properties(Owner with { WorkspaceId = newWorkspace.Id }, default));
        Assert.Single(await repository.List(actor, default));
    }
    [Fact]
    public async Task Units_are_reused_scoped_and_capacity_is_enforced()
    {
        var first = await Create();
        var second = await Create();
        Assert.Equal(first.UnitId, second.UnitId);
        Assert.Single(await repository.Units(Owner, "property", default));
        await repository.AddUnit(Owner, "property", "4A", default);
        Assert.Single(await repository.Units(Resident, "property", default));
        Assert.Equal(2, (await repository.Units(Owner, "property", default)).Count);
        await Assert.ThrowsAsync<ApiException>(() => repository.AddUnit(Owner, "property", "4A", default));
        await Assert.ThrowsAsync<ApiException>(() => service.SaveProperty(Owner, new("Test property", "Test address", 1, "UTC"), "property", default));
        await repository.SaveProperty(Owner, new Property { Id = "small", Name = "Small property", Address = "Small address", Units = 1 }, true, default);
        await repository.AddUnit(Owner, "small", "A", default);
        await Assert.ThrowsAsync<ApiException>(() => repository.AddUnit(Owner, "small", "B", default));
        await Assert.ThrowsAsync<ApiException>(() => service.Create(Owner, new("Broken tap", null, "small", "B", "Resident", "Plumbing", "Tap is broken"), default));
        var actor = Owner with { WorkspaceId = "outside" };
        Assert.Equal(404, (await Assert.ThrowsAsync<ApiException>(() => repository.Units(actor, "property", default))).Status);
    }

    [Fact]
    public async Task Offer_history_and_quote_vendor_currency_survive_reload()
    {
        var r = await Create();
        await service.Offer(Owner, r.Id, new("vendor", "First offer", null), default, null);
        await service.VendorResponse(Vendor, r.Id, new("vendor", "declined", "Busy"), default, null);
        await service.Offer(Owner, r.Id, new("vendor", "Second offer", null), default, null);
        await service.VendorResponse(Vendor, r.Id, new("vendor", "accepted", null), default, null);
        await service.SubmitEstimate(Vendor, r.Id, new("Replace tap", 100, 200, 30, "INR"), default, null);
        r = await repository.Get(Owner, r.Id, default);
        Assert.Equal(2, r.Offers.Count);
        Assert.Equal("declined", r.Offers[0].Status); Assert.Equal("Busy", r.Offers[0].ResponseNote);
        Assert.Equal("accepted", r.Offers[1].Status); Assert.Equal(2, r.Offers[1].Sequence);
        Assert.Equal(Vendor.Id, r.Offers[1].ResponseBy);
        Assert.Equal("vendor", r.Estimate!.VendorId); Assert.Equal("INR", r.Estimate.Currency);
        await service.ReviewEstimate(Owner, r.Id, r.Estimate.Id, false, "Revise scope", default, null);
        await Assert.ThrowsAsync<ApiException>(() => service.SubmitEstimate(Vendor, r.Id, new("Replace tap", 100, 200, 30, "USD"), default, null));
        await Assert.ThrowsAsync<ApiException>(() => service.SubmitEstimate(Vendor, r.Id, new("Replace tap", 100, 200, 30, "BAD"), default, null));
    }

    [Fact]
    public async Task Notification_read_status_is_per_manager_not_global()
    {
        await Create();
        var other = Owner with { Id = "other-manager", Email = "other-manager@example.com" };
        var n = Assert.Single(await repository.Notifications(Owner, default)); Assert.False(n.Read);
        Assert.True((await repository.ReadNotification(Owner, n.Id, default)).Read);
        Assert.True((await repository.ReadNotification(Owner, n.Id, default)).Read);
        Assert.False(Assert.Single(await repository.Notifications(other, default)).Read);
        Assert.True(Assert.Single(await repository.Notifications(Owner, default)).Read);
        await Assert.ThrowsAsync<ApiException>(() => repository.ReadNotification(Owner with { WorkspaceId = "outside" }, n.Id, default));
    }

    [Fact]
    public async Task Reopened_repairs_keep_every_resident_verification()
    {
        var r = await Quoted();
        await service.ReviewEstimate(Owner, r.Id, r.Estimate!.Id, true, null, default, null);
        await service.StartWork(Vendor, r.Id, default, null);
        await service.CompleteWork(Vendor, r.Id, default, null);
        await service.Verify(Resident, r.Id, new(false, "Still leaking"), default, null);
        await service.CompleteWork(Vendor, r.Id, default, null);
        await service.Verify(Resident, r.Id, new(true, "Fixed this time"), default, null);
        r = await repository.Get(Owner, r.Id, default);
        Assert.Equal(new[] { "pending", "unresolved", "pending", "verified" }, r.VerificationHistory.Select(x => x.Status));
        Assert.Equal(4, r.VerificationHistory.Select(x => x.Revision).Distinct().Count());
        Assert.Equal(Resident.Id, r.VerificationHistory.Last().ActorId);
        Assert.Equal("closed", r.State);
    }

    [Fact]
    public async Task Database_constraints_reject_cross_property_links_and_unknown_workspaces()
    {
        var repair = await Create();
        await repository.SaveProperty(Owner, new Property { Id = "second", Name = "Second", Address = "Second address", Units = 2 }, true, default);
        var unit = await repository.AddUnit(Owner, "second", "3B", default);
        await using var db = await database.Open(default);
        await Assert.ThrowsAnyAsync<System.Data.Common.DbException>(() => db.ExecuteAsync(
            "UPDATE request_locations SET unit_id=@unit WHERE workspace_id=@workspace AND request_id=@request",
            new { unit = unit.Id, workspace = Owner.WorkspaceId, request = repair.Id }));
        await Assert.ThrowsAnyAsync<System.Data.Common.DbException>(() => db.ExecuteAsync(
            "UPDATE vendors SET workspace_id='unknown' WHERE workspace_id=@workspace AND id='vendor'", new { workspace = Owner.WorkspaceId }));
        Assert.Equal(repair.UnitId, (await repository.Get(Owner, repair.Id, default)).UnitId);
    }

    [Fact]
    public async Task Sql_resources_are_cached_and_invalid_resource_names_fail_closed()
    {
        var sql = new SqlFileQueryHelper(database);
        var resources = await Task.WhenAll(Enumerable.Range(0, 20).Select(_ => Task.Run(() => sql.GetSqlQuery("ListVendors"))));
        Assert.All(resources, x => Assert.Same(resources[0], x));
        Assert.Throws<ArgumentException>(() => sql.GetSqlQuery("../appsettings"));
        Assert.Throws<InvalidOperationException>(() => sql.GetSqlQuery("UnknownQuery"));
    }


    [Fact]
    public async Task Unicode_JSON_literal_search_and_long_actor_emails_round_trip()
    {
        var email = new string('a', 64) + "@" + new string('b', 63) + "." + new string('c', 63) + "." + new string('d', 61);
        Assert.Equal(254, email.Length);
        var actor = Owner with { Email = email };
        var repair = await service.Create(actor, new("100%_Über repair 🔧", null, "property", "Étage-😀", "Résident", "Plumbing",
            "Fuite à réparer 😀", SafetyAnswers: new() { ["instructions"] = "Étape 1 🔧" }), default);
        await Create();
        Assert.Single(await repository.List(Owner, default, "%_"));
        Assert.Single(await repository.List(Owner, default, "über"));
        Assert.Empty(await repository.List(Owner, default, "\\%"));
        var saved = await repository.Get(Owner, repair.Id, default);
        Assert.Equal(repair.Title, saved.Title);
        Assert.Equal("Étape 1 🔧", saved.SafetyAnswers["instructions"]);
        Assert.Equal(email, saved.Events[0].Actor);
        await repository.SendMessage(actor, repair.Id, "Réparation terminée 😀", default);
        Assert.Equal(email, Assert.Single(await repository.Messages(actor, repair.Id, default)).Sender);
    }

    [Fact]
    public async Task Database_enforces_money_totals_and_one_active_vendor_offer()
    {
        var repair = await Create();
        await service.Offer(Owner, repair.Id, new("vendor", null, null), default, null);
        var sql = new SqlFileQueryHelper(database);
        await using var db = await database.Open(default);
        await Assert.ThrowsAnyAsync<System.Data.Common.DbException>(() => db.ExecuteAsync(sql.GetSqlQuery("SaveEstimate"),
            new { workspace = Owner.WorkspaceId, request = repair.Id, Id = "bad-total", Version = 1, Scope = "Test",
                Labor = 1m, Parts = 2m, Tax = 3m, Total = 7m, Status = "submitted", CreatedAt = repair.CreatedAt,
                ApprovedAt = (string?)null, ApprovedBy = (string?)null, VendorId = "vendor", Currency = "USD" }));
        await Assert.ThrowsAnyAsync<System.Data.Common.DbException>(() => db.ExecuteAsync(sql.GetSqlQuery("SaveOffer"),
            new { workspace = Owner.WorkspaceId, request = repair.Id, Id = "second-active", VendorId = "vendor", Sequence = 2,
                Status = "pending", OfferedAt = repair.CreatedAt, RespondedAt = (string?)null, OfferedBy = Owner.Id,
                ResponseBy = (string?)null, Note = (string?)null, ResponseNote = (string?)null, legacy = 0 }));
        var saved = await repository.Get(Owner, repair.Id, default);
        Assert.Single(saved.Offers);
        Assert.Empty(saved.Estimates);
        var path = "synthetic/" + new string('é', 600) + "/evidence.pdf";
        var evidence = new { workspace = Owner.WorkspaceId, request = repair.Id, Id = "first-path", Path = path,
            Name = "Evidence.pdf", ContentType = "application/pdf", Size = 100L, UploadedBy = Owner.Id,
            CreatedAt = repair.CreatedAt, Status = "uploading" };
        await db.ExecuteAsync(sql.GetSqlQuery("SaveEvidence"), evidence);
        await Assert.ThrowsAnyAsync<System.Data.Common.DbException>(() => db.ExecuteAsync(sql.GetSqlQuery("SaveEvidence"),
            evidence with { Id = "duplicate-path" }));
        Assert.Equal(path, Assert.Single((await repository.Get(Owner, repair.Id, default)).Evidence).Path);
    }
    [Fact]
    public async Task A_unit_label_never_exposes_unlinked_or_another_occupants_history()
    {
        var linked = await Create();
        var legacy = await service.Create(Owner, new("Legacy repair", null, "property", "3B", "Same display name", "Plumbing", "Old resident's private issue"), default);
        Assert.False(legacy.ResidentLinked); Assert.Equal(linked.Id, Assert.Single(await repository.List(Resident, default)).Id);
        var replacement = Resident with { Id = "33333333-3333-4333-8333-333333333333" };
        Assert.Empty(await repository.List(replacement, default));
        Assert.Equal(404, (await Assert.ThrowsAsync<ApiException>(() => repository.Get(replacement, linked.Id, default))).Status);
        Assert.Equal(404, (await Assert.ThrowsAsync<ApiException>(() => repository.Messages(Resident, legacy.Id, default))).Status);
        Assert.Equal(2, (await repository.List(Owner, default)).Count);
    }
    [Fact]
    public async Task A_returning_resident_with_a_new_occupancy_cannot_reopen_the_previous_period()
    {
        var repair = await Create();
        var returning = Resident with { ResidentOccupancies = [new(Guid.NewGuid().ToString("D"), "property", "3B", DateTimeOffset.UtcNow.AddDays(-1), null)] };
        Assert.Empty(await repository.List(returning, default));
        Assert.Equal(404, (await Assert.ThrowsAsync<ApiException>(() => repository.SendMessage(returning, repair.Id, "Can I see the old conversation?", default))).Status);
        Assert.Equal(404, (await Assert.ThrowsAsync<ApiException>(() => service.Verify(returning, repair.Id, new(true, null), default, repair.Revision))).Status);
        using var http = new HttpClient(); var evidence = new EvidenceBL(repository, new EvidenceStorage(http, new ConfigurationManager()));
        Assert.Equal(404, (await Assert.ThrowsAsync<ApiException>(() => evidence.Download(returning, repair.Id, "photo", default))).Status);
        Assert.Equal(404, (await Assert.ThrowsAsync<ApiException>(() => evidence.Upload(returning, new(repair.Id, "Photo.jpg", "image/jpeg", 100), default))).Status);
    }
    [Fact]
    public async Task Missing_future_expired_or_revoked_occupancy_denies_reads_and_writes()
    {
        var repair = await Create();
        var assignment = Resident.ResidentOccupancies![0];
        foreach (var actor in new[] {
            Resident with { ResidentOccupancies = null },
            Resident with { ResidentOccupancies = [assignment with { StartsAt = DateTimeOffset.UtcNow.AddDays(1) }] },
            Resident with { ResidentOccupancies = [assignment with { EndsAt = DateTimeOffset.UtcNow.AddSeconds(-1) }] },
            Resident with { PropertyUnits = [] } })
        {
            Assert.Empty(await repository.List(actor, default)); Assert.Empty(await repository.Properties(actor, default));
            Assert.Equal(404, (await Assert.ThrowsAsync<ApiException>(() => repository.SendMessage(actor, repair.Id, "Blocked", default))).Status);
            await Assert.ThrowsAsync<ApiException>(() => service.Create(actor, new("Blocked report", null, "property", "3B", "Resident", "Plumbing", "Private repair"), default));
        }
    }
    [Fact]
    public async Task A_report_before_the_assignment_start_is_not_visible_even_with_the_same_ids()
    {
        var repair = await Create();
        await using var db = await database.Open(default);
        var oldAt = Resident.ResidentOccupancies![0].StartsAt.AddDays(-1).ToUniversalTime().ToString("O");
        await db.ExecuteAsync("UPDATE requests SET created_at=@oldAt WHERE workspace_id=@workspace AND id=@id", new { oldAt, workspace = Owner.WorkspaceId, id = repair.Id });
        Assert.Empty(await repository.List(Resident, default));
        Assert.Equal(404, (await Assert.ThrowsAsync<ApiException>(() => repository.Get(Resident, repair.Id, default))).Status);
        Assert.Equal(oldAt, (await repository.Get(Owner, repair.Id, default)).CreatedAt);
    }
    [Fact]
    public async Task Resident_creation_ignores_client_identity_and_occupancy_spoofing()
    {
        var repair = await service.Create(Resident, new("Self reported", null, "property", "3B", "Any display name", "Plumbing", "Tap is leaking",
            ResidentUserId: "33333333-3333-4333-8333-333333333333", ResidentOccupancyId: Guid.NewGuid().ToString("D")), default);
        var stored = await repository.Get(Owner, repair.Id, default);
        Assert.Equal(Resident.Id, stored.ResidentUserId); Assert.Equal(OccupancyId, stored.ResidentOccupancyId);
        Assert.True(Resident.CanAccess(stored)); Assert.Equal(repair.Id, Assert.Single(await repository.List(Resident, default)).Id);
    }
    [Fact]
    public async Task Manager_linking_is_explicit_revision_checked_audited_and_not_transferable()
    {
        var repair = await service.Create(Owner, new("Unlinked report", null, "property", "3B", "Resident", "Plumbing", "Tap is leaking"), default);
        var input = new ResidentLinkInput(Resident.Id, OccupancyId);
        Assert.Equal(403, (await Assert.ThrowsAsync<ApiException>(() => service.LinkResident(Resident, repair.Id, input, default, 0))).Status);
        Assert.Equal(400, (await Assert.ThrowsAsync<ApiException>(() => service.LinkResident(Owner, repair.Id, input, default, null))).Status);
        Assert.Equal(409, (await Assert.ThrowsAsync<ApiException>(() => service.LinkResident(Owner, repair.Id, input, default, 1))).Status);
        Assert.False((await repository.Get(Owner, repair.Id, default)).ResidentLinked);
        var saved = await service.LinkResident(Owner, repair.Id, input, default, 0);
        Assert.Equal(1, saved.Revision); Assert.Equal("resident-link", saved.Events.Last().Type);
        Assert.Equal(saved.Id, (await repository.Get(Resident, repair.Id, default)).Id);
        Assert.Equal(409, (await Assert.ThrowsAsync<ApiException>(() => service.LinkResident(Owner, repair.Id, input with { ResidentUserId = Guid.NewGuid().ToString("D") }, default, 1))).Status);
    }
    [Fact]
    public async Task Incomplete_or_invalid_manager_binding_fails_before_a_repair_is_created()
    {
        var input = new CreateRepair("Invalid binding", null, "property", "3B", "Resident", "Plumbing", "Tap is leaking", ResidentUserId: Resident.Id);
        Assert.Equal(400, (await Assert.ThrowsAsync<ApiException>(() => service.Create(Owner, input, default))).Status);
        await Assert.ThrowsAsync<ApiException>(() => service.Create(Owner, input with { ResidentUserId = "resident@example.test", ResidentOccupancyId = OccupancyId }, default));
        Assert.Empty(await repository.List(Owner, default));
    }
    [Fact]
    public async Task Database_binding_pairs_and_controller_resident_payloads_are_enforced()
    {
        var repair = await Quoted();
        await using (var db = await database.Open(default))
            await Assert.ThrowsAnyAsync<System.Data.Common.DbException>(() => db.ExecuteAsync("UPDATE requests SET resident_occupancy_id=NULL WHERE workspace_id=@workspace AND id=@id", new { workspace = Owner.WorkspaceId, id = repair.Id }));
        var controller = new RepairLedger.Api.Controllers.RequestsController(service, Resident) {
            ControllerContext = new Microsoft.AspNetCore.Mvc.ControllerContext { HttpContext = new Microsoft.AspNetCore.Http.DefaultHttpContext() }
        };
        var options = new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web);
        var list = System.Text.Json.JsonSerializer.Serialize(await controller.List(default), options);
        var detail = System.Text.Json.JsonSerializer.Serialize(await controller.Get(repair.Id, default), options);
        Assert.DoesNotContain("\"estimates\"", list); Assert.DoesNotContain("\"estimate\"", detail); Assert.DoesNotContain("\"offers\"", detail);
        Assert.DoesNotContain(Resident.Id, detail); Assert.DoesNotContain(OccupancyId, detail);
        Assert.NotNull((await repository.Get(Owner, repair.Id, default)).Estimate);
    }
    internal sealed class TestEnvironment : IWebHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Development";
        public string ApplicationName { get; set; } = "RepairLedger.Api";
        public string WebRootPath { get; set; } = "";
        public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
        public string ContentRootPath { get; set; } = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../apps/api"));
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
