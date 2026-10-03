using System.Text.Json.Serialization;

namespace RepairLedger.Api.Models;

public sealed record Actor(string Id, string WorkspaceId, string Role, string Email,
    string? VendorId, Dictionary<string, string[]> PropertyUnits, string[]? AssignedPropertyIds = null,
    ResidentOccupancy[]? ResidentOccupancies = null)
{
    public bool IsManager => Role is "owner" or "manager" or "demo";
    public bool IsDemo => Role == "demo";
    public void RequireMobileUser() { if (Role is not ("tenant" or "watchman") && !IsManager) throw new ApiException(403, "Resident or watchman access required."); }
    public void RequireWatchman() { if (Role != "watchman") throw new ApiException(403, "Watchman access required."); }
    public ResidentOccupancy[] ActiveResidentOccupancies => (ResidentOccupancies ?? [])
        .Where(o => o.IsActive(DateTimeOffset.UtcNow) && PropertyUnits.TryGetValue(o.PropertyId, out var units) && units.Contains(o.Unit))
        .GroupBy(o => (o.PropertyId, o.Unit)).Where(g => g.Count() == 1).Select(g => g.Single()).ToArray();
    public Dictionary<string, string[]> ResidentUnits => ActiveResidentOccupancies.GroupBy(o => o.PropertyId)
        .ToDictionary(g => g.Key, g => g.Select(o => o.Unit).ToArray());
    public string[] MobilePropertyIds => Role == "tenant" ? ResidentUnits.Keys.ToArray()
        : Role == "watchman" ? AssignedPropertyIds ?? [] : [];
    public void RequireManager() { if (!IsManager) throw new ApiException(403, "Manager access required."); }
    public void RequireVendor() { if (Role != "vendor" && !IsDemo) throw new ApiException(403, "Vendor access required."); }
    public void RequireResident() { if (Role != "tenant" && !IsDemo) throw new ApiException(403, "Resident access required."); }
    public bool CanAccess(Repair r) => r.WorkspaceId == WorkspaceId && (IsManager ||
        (Role == "vendor" && VendorId != null && VendorId == r.AssignedVendorId) ||
        (Role == "tenant" && r.ResidentUserId == Id && DateTimeOffset.TryParse(r.CreatedAt, out var reported) && ActiveResidentOccupancies.Any(o =>
            o.Id == r.ResidentOccupancyId && o.PropertyId == r.PropertyId && o.Unit == r.Unit &&
            o.StartsAt <= reported && (o.EndsAt == null || reported < o.EndsAt))));
}
