using System.Text.Json.Serialization;

namespace RepairLedger.Api.Models;

public sealed record Verification(string Status, string? Note = null, string? UpdatedAt = null);
