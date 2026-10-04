using System.Text.Json.Serialization;
namespace RepairLedger.Api.Models;

public sealed record MobileContext(string Role, string Email, List<MobileProperty> Properties, int UserContext = 1, bool CanSwitchContext = false, int[]? AvailableContexts = null, string DisplayName = "");
public sealed class MobileProperty
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Timezone { get; set; } = "UTC";
    public string[] Units { get; set; } = [];
}

// Deliberately not a Repair: no resident names, access notes, messages, evidence or money.
public sealed class GateVisit
{
    public string Id { get; set; } = "";
    public string PropertyId { get; set; } = "";
    public string PropertyName { get; set; } = "";
    public string Unit { get; set; } = "";
    public string VendorName { get; set; } = "";
    public string Trade { get; set; } = "";
    public string StartsAt { get; set; } = "";
    public string EndsAt { get; set; } = "";
    public string Timezone { get; set; } = "UTC";
    public string? ArrivedAt { get; set; }
    public string? DepartedAt { get; set; }
    public long Revision { get; set; }
    [JsonIgnore] public string AppointmentStatus { get; set; } = "";
    [JsonIgnore] public string RepairState { get; set; } = "";
    [JsonIgnore] public string? VendorDecision { get; set; }
}

public sealed class CommonAreaIssue
{
    public string Id { get; set; } = "";
    public string PropertyId { get; set; } = "";
    public string PropertyName { get; set; } = "";
    public string Location { get; set; } = "";
    public string Title { get; set; } = "";
    public string Category { get; set; } = "";
    public string Description { get; set; } = "";
    public string Priority { get; set; } = "routine";
    public string Status { get; set; } = "reported";
    public string? ResolutionNote { get; set; }
    public string CreatedAt { get; set; } = "";
    public string UpdatedAt { get; set; } = "";
    public long Revision { get; set; }
    [JsonIgnore] public string WorkspaceId { get; set; } = "";
    [JsonIgnore] public string ReportedBy { get; set; } = "";
    [JsonIgnore] public string SubmissionId { get; set; } = "";
    [JsonIgnore] public string? UpdatedBy { get; set; }
}
