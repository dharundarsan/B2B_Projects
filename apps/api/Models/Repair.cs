using System.Text.Json.Serialization;

namespace RepairLedger.Api.Models;

public sealed class Repair
{
    public string Id { get; set; } = "";
    [JsonIgnore] public string WorkspaceId { get; set; } = "";
    public long Revision { get; set; }
    public string Title { get; set; } = "";
    public string Property { get; set; } = "";
    public string PropertyId { get; set; } = "";
    public string Unit { get; set; } = "";
    public string? UnitId { get; set; }
    public string Resident { get; set; } = "";
    [JsonIgnore] public string? ResidentUserId { get; set; }
    [JsonIgnore] public string? ResidentOccupancyId { get; set; }
    public bool ResidentLinked => ResidentUserId != null && ResidentOccupancyId != null;
    public string Category { get; set; } = "";
    public string Priority { get; set; } = "routine";
    public string State { get; set; } = "submitted";
    public string NextAction { get; set; } = "Manager acknowledgement";
    public string DueLabel { get; set; } = "Awaiting acknowledgement";
    public string Description { get; set; } = "";
    public string Access { get; set; } = "";
    public string Language { get; set; } = "English";
    public string Timezone { get; set; } = "UTC";
    public string CreatedAt { get; set; } = DateTimeOffset.UtcNow.ToString("O");
    public string? PhotoUrl { get; set; }
    public string? AccessNotes { get; set; }
    public string? PreferredWindow { get; set; }
    public Dictionary<string, string> SafetyAnswers { get; set; } = [];
    [JsonIgnore] public string SafetyJson { get; set; } = "{}";
    public string? AssignedVendorId { get; set; }
    public string? AssignedVendorName { get; set; }
    public string? VendorDecision { get; set; }
    public List<Activity> Events { get; set; } = [];
    public List<Estimate> Estimates { get; set; } = [];
    public Estimate? Estimate => Estimates.MaxBy(x => x.Version);
    public List<Appointment> Appointments { get; set; } = [];
    public Appointment? Appointment => Appointments.LastOrDefault();
    public List<Evidence> Evidence { get; set; } = [];
    public List<VendorOffer> Offers { get; set; } = [];
    public List<VerificationRecord> VerificationHistory { get; set; } = [];
    public Verification? ResidentVerification { get; set; }
    [JsonIgnore] public string? VerificationJson { get; set; }
}
