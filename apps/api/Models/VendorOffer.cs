using System.Text.Json.Serialization;
namespace RepairLedger.Api.Models;

public sealed class VendorOffer
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    [JsonIgnore] public string RequestId { get; set; } = "";
    public string VendorId { get; set; } = "";
    public int Sequence { get; set; }
    public string Status { get; set; } = "pending";
    public string? OfferedAt { get; set; }
    public string? RespondedAt { get; set; }
    public string? OfferedBy { get; set; }
    public string? ResponseBy { get; set; }
    public string? Note { get; set; }
    public string? ResponseNote { get; set; }
    public bool LegacySnapshot { get; set; }
}
