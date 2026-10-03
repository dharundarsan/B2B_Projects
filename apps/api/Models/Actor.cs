using System.Text.Json.Serialization;

namespace RepairLedger.Api.Models;

public sealed record Actor(string Id, string WorkspaceId, string Role, string Email,
    string? VendorId, Dictionary<string, string[]> PropertyUnits, string[]? AssignedPropertyIds = null)
{
    public bool IsManager => Role is "owner" or "manager" or "demo";
    public bool IsDemo => Role == "demo";
    public void RequireMobileUser() { if (Role is not ("tenant" or "watchman") && !IsManager) throw new ApiException(403, "Resident or watchman access required."); }
    public void RequireWatchman() { if (Role != "watchman") throw new ApiException(403, "Watchman access required."); }
    public string[] MobilePropertyIds => Role == "tenant" ? PropertyUnits.Where(x => x.Value.Length > 0).Select(x => x.Key).ToArray()
        : Role == "watchman" ? AssignedPropertyIds ?? [] : [];
    public void RequireManager() { if (!IsManager) throw new ApiException(403, "Manager access required."); }
    public void RequireVendor() { if (Role != "vendor" && !IsDemo) throw new ApiException(403, "Vendor access required."); }
    public void RequireResident() { if (Role != "tenant" && !IsDemo) throw new ApiException(403, "Resident access required."); }
    public bool CanAccess(Repair r) => r.WorkspaceId == WorkspaceId && (IsManager ||
        (Role == "vendor" && VendorId != null && VendorId == r.AssignedVendorId) ||
        (Role == "tenant" && PropertyUnits.TryGetValue(r.PropertyId, out var units) && units.Contains(r.Unit)));
}
