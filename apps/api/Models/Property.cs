using System.Text.Json.Serialization;

namespace RepairLedger.Api.Models;

public sealed class Property
{
    public string Id { get; set; } = "";
    [JsonIgnore] public string WorkspaceId { get; set; } = "";
    public string Name { get; set; } = "";
    public string Address { get; set; } = "";
    public int Units { get; set; }
    public string Timezone { get; set; } = "UTC";
    public int OpenRequests { get; set; }
    public int UrgentRequests { get; set; }
    public int Assets { get; set; }
    public string? ImageUrl { get; set; }
    [JsonIgnore] public int Archived { get; set; }
}
