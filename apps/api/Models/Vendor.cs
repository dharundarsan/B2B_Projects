using System.Text.Json.Serialization;

namespace RepairLedger.Api.Models;

public sealed class Vendor
{
    public string Id { get; set; } = "";
    [JsonIgnore] public string WorkspaceId { get; set; } = "";
    public string Name { get; set; } = "";
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string Trade { get; set; } = "";
    public string Distance { get; set; } = "Not calculated";
    public string Availability { get; set; } = "Saved · invitation not sent";
    public string FirstVisitFixes { get; set; } = "No history yet";
    public string Status { get; set; } = "review";
}
