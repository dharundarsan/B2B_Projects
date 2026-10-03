using RepairLedger.Api.Helpers;
using RepairLedger.Api.Models;
using Xunit;

namespace RepairLedger.Api.Tests;

public sealed class RepairAttentionTests
{
    [Theory]
    [InlineData("submitted", null, null, null, null, "acknowledge")]
    [InlineData("urgent", null, null, null, null, "acknowledge")]
    [InlineData("acknowledged", null, null, null, null, "assign")]
    [InlineData("assigned", null, null, null, null, "assign")]
    [InlineData("assigned", "pending", "vendor", null, null, null)]
    [InlineData("acknowledged", "pending", "vendor", null, null, null)]
    [InlineData("assigned", "accepted", "vendor", null, null, null)]
    [InlineData("acknowledged", "accepted", "vendor", null, null, null)]
    [InlineData("acknowledged", "declined", "vendor", null, null, "assign")]
    [InlineData("waiting", "declined", "vendor", null, null, "assign")]
    [InlineData("assigned", "accepted", "vendor", "submitted", null, "review_quote")]
    [InlineData("waiting", "accepted", "vendor", "submitted", null, "review_quote")]
    [InlineData("assigned", "accepted", "vendor", "changes_requested", null, null)]
    [InlineData("approved", "accepted", "vendor", "approved", null, "schedule")]
    [InlineData("assigned", "accepted", "vendor", "approved", "cancelled", "schedule")]
    [InlineData("scheduled", "accepted", "vendor", "approved", "proposed", null)]
    [InlineData("scheduled", "accepted", "vendor", "approved", "confirmed", null)]
    [InlineData("acknowledged", "declined", "vendor", "approved", "cancelled", null)]
    [InlineData("acknowledged", null, null, "submitted", null, null)]
    [InlineData("waiting", null, null, null, null, null)]
    [InlineData("assigned", null, "vendor", null, null, null)]
    public void Manager_attention_matches_workflow_owner_and_available_operation(
        string state, string? decision, string? vendorId, string? estimateStatus, string? visitStatus, string? expected)
    {
        var repair = RepairFor(state, decision, vendorId, estimateStatus, visitStatus);
        Assert.Equal(expected, RepairAttentionHelper.ManagerAction(repair));
    }

    [Theory]
    [InlineData("closed")]
    [InlineData("cancelled")]
    [InlineData("completed")]
    [InlineData("verification")]
    [InlineData("invoice_review")]
    [InlineData("in_progress")]
    [InlineData("draft")]
    [InlineData("unknown")]
    public void Non_decision_states_do_not_reappear_from_stale_quotes_or_visits(string state)
    {
        var repair = RepairFor(state, "accepted", "vendor", "submitted", "cancelled");
        Assert.Null(RepairAttentionHelper.ManagerAction(repair));
        repair.Estimates[0].Status = "approved";
        Assert.Null(RepairAttentionHelper.ManagerAction(repair));
    }

    [Fact]
    public void Latest_quote_and_latest_visit_define_the_current_decision_without_mutating_history()
    {
        var repair = RepairFor("assigned", "accepted", "vendor", "submitted", "confirmed");
        repair.Estimates.Add(new Estimate { Version = 2, Status = "approved" });
        repair.Appointments.Add(new Appointment { Status = "cancelled" });
        Assert.Equal("schedule", RepairAttentionHelper.ManagerAction(repair));
        Assert.Equal("submitted", repair.Estimates[0].Status);
        Assert.Equal("confirmed", repair.Appointments[0].Status);
        Assert.Equal(2, repair.Estimates.Count);
        Assert.Equal(2, repair.Appointments.Count);
    }

    [Theory]
    [InlineData("submitted", true, false)]
    [InlineData("in_progress", true, false)]
    [InlineData("completed", true, true)]
    [InlineData("verification", true, true)]
    [InlineData("invoice_review", true, false)]
    [InlineData("closed", false, false)]
    [InlineData("cancelled", false, false)]
    public void Open_and_verification_counts_remain_distinct(string state, bool open, bool verification)
    {
        var repair = new Repair { State = state };
        Assert.Equal(open, RepairAttentionHelper.IsOpen(repair));
        Assert.Equal(verification, RepairAttentionHelper.AwaitsVerification(repair));
    }

    [Fact]
    public void Today_includes_confirmed_visits_in_progress_and_sorts_by_actual_instant()
    {
        var now = DateTimeOffset.Parse("2026-10-02T09:00:00Z");
        var later = Visit("later", "scheduled", "confirmed", "2026-10-02T15:00:00+00:00");
        var earlier = Visit("earlier", "in_progress", "confirmed", "2026-10-02T10:00:00+05:30");
        var proposed = Visit("proposed", "scheduled", "proposed", "2026-10-02T10:00:00Z");
        var cancelled = Visit("cancelled", "scheduled", "cancelled", "2026-10-02T10:00:00Z");
        var completed = Visit("completed", "verification", "confirmed", "2026-10-02T10:00:00Z");
        var tomorrow = Visit("tomorrow", "scheduled", "confirmed", "2026-10-03T10:00:00Z");
        var invalid = Visit("invalid", "scheduled", "confirmed", "invalid");
        var visits = RepairAttentionHelper.ConfirmedVisitsToday([later, proposed, cancelled, completed, tomorrow, earlier, invalid], now);
        Assert.Equal(["earlier", "later"], visits.Select(repair => repair.Id));
    }

    [Fact]
    public void Today_is_the_appointment_timezone_day_not_the_server_or_utc_day()
    {
        var repair = Visit("visit", "scheduled", "confirmed", "2026-10-01T20:00:00Z", "Asia/Kolkata");
        Assert.Single(RepairAttentionHelper.ConfirmedVisitsToday([repair], DateTimeOffset.Parse("2026-10-02T16:00:00Z")));
        Assert.Empty(RepairAttentionHelper.ConfirmedVisitsToday([repair], DateTimeOffset.Parse("2026-10-02T20:00:00Z")));
    }

    private static Repair RepairFor(string state, string? decision, string? vendorId, string? estimateStatus, string? visitStatus)
    {
        var repair = new Repair { State = state, VendorDecision = decision, AssignedVendorId = vendorId };
        if (estimateStatus != null) repair.Estimates.Add(new Estimate { Version = 1, Status = estimateStatus });
        if (visitStatus != null) repair.Appointments.Add(new Appointment { Status = visitStatus });
        return repair;
    }

    private static Repair Visit(string id, string state, string status, string startsAt, string timezone = "UTC")
        => new() { Id = id, State = state, Appointments = [new Appointment { Status = status, StartsAt = startsAt, Timezone = timezone }] };
}
