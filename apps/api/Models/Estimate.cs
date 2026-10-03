using System.Text.Json.Serialization;

namespace RepairLedger.Api.Models;

public sealed class Estimate
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    [JsonIgnore] public string RequestId { get; set; } = "";
    public int Version { get; set; }
    public string? VendorId { get; set; }
    public string Currency { get; set; } = "USD";
    public string Scope { get; set; } = "";
    public decimal Labor { get; set; }
    public decimal Parts { get; set; }
    public decimal Tax { get; set; }
    public decimal Total { get; set; }
    public string Status { get; set; } = "submitted";
    public string CreatedAt { get; set; } = DateTimeOffset.UtcNow.ToString("O");
    public string? ApprovedAt { get; set; }
    public string? ApprovedBy { get; set; }
}
