using System.Text.Json.Serialization;

namespace RepairLedger.Api.Models;

public sealed class Evidence
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    [JsonIgnore] public string RequestId { get; set; } = "";
    public string Path { get; set; } = "";
    public string Name { get; set; } = "";
    public string ContentType { get; set; } = "";
    public long Size { get; set; }
    public string UploadedBy { get; set; } = "";
    public string CreatedAt { get; set; } = DateTimeOffset.UtcNow.ToString("O");
    public string Status { get; set; } = "uploading";
}
