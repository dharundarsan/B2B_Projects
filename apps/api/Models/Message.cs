using System.Text.Json.Serialization;

namespace RepairLedger.Api.Models;

public sealed class Message
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    [JsonIgnore] public string WorkspaceId { get; set; } = "";
    public string RequestId { get; set; } = "";
    public string Sender { get; set; } = "";
    public string Role { get; set; } = "";
    public string Body { get; set; } = "";
    public string At { get; set; } = DateTimeOffset.UtcNow.ToString("O");
    public string Status { get; set; } = "sent";
}
