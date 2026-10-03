using System.Text.Json.Serialization;

namespace RepairLedger.Api.Models;

public sealed class Notification
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    [JsonIgnore] public string WorkspaceId { get; set; } = "";
    public string Title { get; set; } = "";
    public string Detail { get; set; } = "";
    public string Type { get; set; } = "request";
    public bool Read { get; set; }
    public string? Href { get; set; }
    public string At { get; set; } = DateTimeOffset.UtcNow.ToString("O");
}
