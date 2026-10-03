using System.Net;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using RepairLedger.Api.ExternalAPI;
using RepairLedger.Api.Helpers;
using RepairLedger.Api.Models;
using Xunit;

namespace RepairLedger.Api.Tests;

public sealed class ResidentAccessTests
{
    private const string User = "11111111-1111-4111-8111-111111111111";
    private const string Occupancy = "22222222-2222-4222-8222-222222222222";
    private static JsonObject Assignment() => new()
    {
        ["id"] = Occupancy, ["property_id"] = "p", ["unit"] = "204",
        ["starts_at"] = DateTimeOffset.UtcNow.AddDays(-2).ToString("O"), ["ends_at"] = null
    };
    [Theory]
    [InlineData("2026-10-01", null)]
    [InlineData("2026-10-01T10:00:00", null)]
    [InlineData("2026-10-01T10:00:00Z", "2026-09-30T10:00:00Z")]
    [InlineData("2026-10-01T10:00:00Z", "2026-10-01T10:00:00Z")]
    [InlineData("2026-10-01T10:00:00Z", "bad-date")]
    public void Missing_offsets_or_invalid_windows_grant_no_assignment(string starts, string? ends)
    {
        var assignment = Assignment(); assignment["starts_at"] = starts; assignment["ends_at"] = ends;
        Assert.Empty(ResidentAccessHelper.Parse(new() { ["resident_occupancies"] = new JsonArray(assignment) }));
    }
    [Fact]
    public void Invalid_claim_types_and_missing_or_zero_ids_fail_closed()
    {
        Assert.Empty(ResidentAccessHelper.Parse(new()));
        foreach (var field in new[] { "id", "property_id", "unit", "starts_at", "ends_at" })
        {
            var value = Assignment(); value[field] = 123;
            Assert.Empty(ResidentAccessHelper.Parse(new() { ["resident_occupancies"] = new JsonArray(value) }));
        }
        var zero = Assignment(); zero["id"] = Guid.Empty.ToString("D");
        Assert.Empty(ResidentAccessHelper.Parse(new() { ["resident_occupancies"] = new JsonArray(zero) }));
    }
    [Fact]
    public void Occupancy_start_is_inclusive_end_is_exclusive_and_offsets_represent_instants()
    {
        var start = DateTimeOffset.Parse("2030-01-01T05:30:00+05:30");
        var occupancy = new ResidentOccupancy(Occupancy, "p", "204", start, start.AddHours(1));
        Assert.True(occupancy.IsActive(DateTimeOffset.Parse("2030-01-01T00:00:00Z")));
        Assert.False(occupancy.IsActive(start.AddTicks(-1))); Assert.False(occupancy.IsActive(start.AddHours(1)));
    }
    [Fact]
    public void Active_claims_also_require_exact_building_unit_permission_and_no_ambiguity()
    {
        var active = new ResidentOccupancy(Occupancy, "p", "204", DateTimeOffset.UtcNow.AddDays(-1), null);
        var actor = new Actor(User, "w", "tenant", "test@example.test", null, new() { ["p"] = ["204"] }, ResidentOccupancies: [active]);
        Assert.Equal("204", Assert.Single(actor.ResidentUnits["p"]));
        Assert.Empty((actor with { PropertyUnits = new() { ["p"] = ["OTHER"] } }).ResidentUnits);
        Assert.Empty((actor with { ResidentOccupancies = [active, active with { Id = Guid.NewGuid().ToString("D") }] }).ResidentUnits);
        Assert.Empty((actor with { ResidentOccupancies = [active with { StartsAt = DateTimeOffset.UtcNow.AddDays(1) }] }).ResidentUnits);
        Assert.Empty((actor with { ResidentOccupancies = [active with { EndsAt = DateTimeOffset.UtcNow.AddSeconds(-1) }] }).ResidentUnits);
    }
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Authentication_uses_verified_app_metadata_never_editable_user_metadata(bool trusted)
    {
        var metadata = new JsonObject { ["role"] = "tenant", ["workspace_id"] = "w", ["property_ids"] = new JsonArray("p"),
            ["property_units"] = new JsonObject { ["p"] = new JsonArray("204") } };
        if (trusted) metadata["resident_occupancies"] = new JsonArray(Assignment());
        var body = new JsonObject { ["id"] = User, ["email"] = "test@example.test", ["app_metadata"] = metadata,
            ["user_metadata"] = new JsonObject { ["resident_occupancies"] = new JsonArray(Assignment()) } };
        using var http = new HttpClient(new AuthEndpoint(body.ToJsonString()));
        var config = new ConfigurationManager { ["Supabase:Url"] = "https://auth.example.test", ["Supabase:PublicKey"] = "public-test-placeholder", ["Demo:Enabled"] = "false" };
        var context = new DefaultHttpContext(); context.Request.Headers.Authorization = "Bearer not-a-real-token";
        var actor = await new SupabaseIdentity(http, config, new WorkflowTests.TestEnvironment()).Authenticate(context);
        Assert.Equal(trusted ? 1 : 0, actor.ActiveResidentOccupancies.Length);
    }
    private sealed class AuthEndpoint(string body) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Assert.Equal("https://auth.example.test/auth/v1/user", request.RequestUri!.ToString());
            Assert.Equal("Bearer", request.Headers.Authorization!.Scheme);
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(body, System.Text.Encoding.UTF8, "application/json") });
        }
    }
    [Fact]
    public void Resident_response_is_an_allowlist_and_does_not_change_the_domain_record()
    {
        var actor = new Actor(User, "w", "tenant", "resident@example.test", null, new() { ["p"] = ["204"] },
            ResidentOccupancies: [new(Occupancy, "p", "204", DateTimeOffset.UtcNow.AddDays(-1), null)]);
        var repair = new Repair { Id = "r", WorkspaceId = "w", PropertyId = "p", Unit = "204", ResidentUserId = User, ResidentOccupancyId = Occupancy,
            AssignedVendorId = "vendor-private-id", AssignedVendorName = "Contractor" };
        repair.Estimates.Add(new() { Total = 8765.43m, ApprovedBy = "manager-private-id" });
        repair.Offers.Add(new() { Note = "INTERNAL NEGOTIATION", OfferedBy = "manager-private-id" });
        repair.Events.Add(new() { Type = "estimate-review", Label = "Quote review", Detail = "INTERNAL NEGOTIATION", Actor = "manager@example.test" });
        repair.Events.Add(new() { Type = "received", Label = "Repair reported", Detail = "PRIVATE AUDIT DETAIL", Actor = "manager@example.test" });
        repair.Evidence.Add(new() { Name = "Photo.jpg", Path = "PRIVATE STORAGE PATH", UploadedBy = "manager-private-id", Status = "uploaded" });
        var json = JsonSerializer.Serialize(RepairResponseHelper.ForActor(actor, repair), new JsonSerializerOptions(JsonSerializerDefaults.Web));
        using var parsed = JsonDocument.Parse(json);
        Assert.Equal("submitted", parsed.RootElement.GetProperty("quoteStatus").GetString());
        Assert.True(parsed.RootElement.GetProperty("vendorAssigned").GetBoolean());
        Assert.False(parsed.RootElement.TryGetProperty("estimate", out _)); Assert.False(parsed.RootElement.TryGetProperty("estimates", out _));
        Assert.False(parsed.RootElement.TryGetProperty("offers", out _)); Assert.False(parsed.RootElement.TryGetProperty("assignedVendorId", out _));
        Assert.DoesNotContain("PRIVATE", json); Assert.DoesNotContain("INTERNAL", json); Assert.DoesNotContain("8765.43", json);
        Assert.DoesNotContain("manager-private-id", json); Assert.DoesNotContain(User, json); Assert.DoesNotContain(Occupancy, json);
        Assert.Equal(2, repair.Events.Count); Assert.Single(repair.Estimates); Assert.Equal("PRIVATE STORAGE PATH", repair.Evidence[0].Path);
    }
}
