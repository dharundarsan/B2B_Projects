using System.Text.Json.Serialization;

namespace RepairLedger.Api.Models;

public sealed class Activity
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    [JsonIgnore] public string RequestId { get; set; } = "";
    public string Type { get; set; } = "";
    public string Label { get; set; } = "";
    public string Detail { get; set; } = "";
    public string At { get; set; } = DateTimeOffset.UtcNow.ToString("O");
    public string? Actor { get; set; }
}
