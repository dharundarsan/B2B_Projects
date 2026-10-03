using System.Text.Json.Serialization;

namespace RepairLedger.Api.Models;

public sealed class Appointment
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    [JsonIgnore] public string RequestId { get; set; } = "";
    public string StartsAt { get; set; } = "";
    public string EndsAt { get; set; } = "";
    public string Timezone { get; set; } = "UTC";
    public string Status { get; set; } = "proposed";
    public string? ResidentConfirmedAt { get; set; }
    public string? VendorConfirmedAt { get; set; }
    [JsonIgnore] public string CreatedAt { get; set; } = DateTimeOffset.UtcNow.ToString("O");
}
