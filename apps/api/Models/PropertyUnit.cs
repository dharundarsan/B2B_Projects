using System.Text.Json.Serialization;
namespace RepairLedger.Api.Models;

public sealed class PropertyUnit
{
    public string Id { get; set; } = "";
    [JsonIgnore] public string WorkspaceId { get; set; } = "";
    public string PropertyId { get; set; } = "";
    public string Label { get; set; } = "";
    public string? BlockId { get; set; }
    public int? Floor { get; set; }
    [JsonIgnore] public int Archived { get; set; }
    public string CreatedAt { get; set; } = DateTimeOffset.UtcNow.ToString("O");
}
