using System.Globalization;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace RepairLedger.Api.Helpers;

public static class ResidentAccessHelper
{
    // Read only server-managed app_metadata. Missing/malformed assignments grant no access.
    public static ResidentOccupancy[] Parse(JsonObject metadata)
    {
        if (metadata["resident_occupancies"] is not JsonArray entries || entries.Count > 100) return [];
        var result = new List<ResidentOccupancy>();
        foreach (var entry in entries.OfType<JsonObject>())
        {
            var id = String(entry["id"]); var property = String(entry["property_id"]); var unit = String(entry["unit"]);
            if (!Guid.TryParseExact(id, "D", out var occupancy) || occupancy == Guid.Empty ||
                string.IsNullOrWhiteSpace(property) || property.Length > 200 || string.IsNullOrWhiteSpace(unit) || unit.Length > 40 ||
                !Instant(String(entry["starts_at"]), out var starts)) continue;
            DateTimeOffset? ends = null;
            if (entry["ends_at"] != null)
            {
                if (!Instant(String(entry["ends_at"]), out var parsed) || parsed <= starts) continue;
                ends = parsed;
            }
            result.Add(new(occupancy.ToString("D"), property, unit, starts, ends));
        }
        return result.ToArray();
    }
    private static string? String(JsonNode? value) => value is JsonValue json && json.TryGetValue<string>(out var text) ? text : null;
    private static bool Instant(string? value, out DateTimeOffset instant)
    {
        instant = default;
        return value != null && value.Length <= 40 && Regex.IsMatch(value,
            @"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?(?:Z|[+-]\d{2}:\d{2})$") &&
            DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.None, out instant);
    }
}
