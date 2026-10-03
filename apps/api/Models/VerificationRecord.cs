using System.Text.Json.Serialization;
namespace RepairLedger.Api.Models;

public sealed class VerificationRecord
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    [JsonIgnore] public string RequestId { get; set; } = "";
    public long Revision { get; set; }
    public string Status { get; set; } = "pending";
    public string? Note { get; set; }
    public string? ActorId { get; set; }
    public string RecordedAt { get; set; } = DateTimeOffset.UtcNow.ToString("O");
    public bool LegacySnapshot { get; set; }
}
