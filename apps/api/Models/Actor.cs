using System.Text.Json.Serialization;

namespace RepairLedger.Api.Models;

public sealed record Actor(string Id, string WorkspaceId, string Role, string Email,
    string? VendorId, Dictionary<string, string[]> PropertyUnits, string[]? AssignedPropertyIds = null,
    ResidentOccupancy[]? ResidentOccupancies = null, int? UserContext = null, bool? AdminAccess = null,
    bool? SellerAccess = null, string[]? CommunityPropertyIds = null, bool? UserAccess = null, string? DisplayName = null)
{
    public bool HasAdminRole => Role is "owner" or "manager" or "demo";
    public bool CanAdmin => HasAdminRole && AdminAccess != false;
    public bool CanSell => CanAdmin || SellerAccess != false;
    public int Context => UserContext == 3 && CanSell ? 3 : UserContext == 1 || !CanAdmin ? 1 : 2;
    public bool IsManager => CanAdmin && Context == 2;
    public bool IsUnitOwner => Context == 1 && (Role == "unit_owner" || HasAdminRole);
    public bool IsOperator => Context == 1 && (Role == "operator" || HasAdminRole);
    public bool IsResident => Context == 1 && (Role == "tenant" || HasAdminRole);
    public bool IsDemo => Role == "demo";
    public void RequireMobileUser() { if (Role is not ("member" or "tenant" or "watchman" or "unit_owner" or "operator") && !HasAdminRole) throw new ApiException(403, "Community access required."); }
    public void RequireWatchman() { if (Role != "watchman") throw new ApiException(403, "Watchman access required."); }
    public ResidentOccupancy[] ActiveResidentOccupancies => (ResidentOccupancies ?? [])
        .Where(o => o.IsActive(DateTimeOffset.UtcNow) && PropertyUnits.TryGetValue(o.PropertyId, out var units) && units.Contains(o.Unit))
        .GroupBy(o => (o.PropertyId, o.Unit)).Where(g => g.Count() == 1).Select(g => g.Single()).ToArray();
    public Dictionary<string, string[]> ResidentUnits => ActiveResidentOccupancies.GroupBy(o => o.PropertyId)
        .ToDictionary(g => g.Key, g => g.Select(o => o.Unit).ToArray());
    public string[] MobilePropertyIds => Context == 3 ? [] : Role == "tenant" ? ResidentUnits.Keys.ToArray()
        : Role == "watchman" ? AssignedPropertyIds ?? [] : [];
    public void RequireManager() { if (!IsManager) throw new ApiException(403, "Manager access required."); }
    public void RequireVendor() { if (Role != "vendor" && !IsDemo) throw new ApiException(403, "Vendor access required."); }
    public void RequireResident() { if (Context != 1 || Role != "tenant" && !IsDemo) throw new ApiException(403, "Open User view with resident access."); }
    public bool CanAccess(Repair r) => r.WorkspaceId == WorkspaceId && (IsManager ||
        (Role == "vendor" && VendorId != null && VendorId == r.AssignedVendorId) ||
        (Context == 1 && Role == "tenant" && r.ResidentUserId == Id && DateTimeOffset.TryParse(r.CreatedAt, out var reported) && ActiveResidentOccupancies.Any(o =>
            o.Id == r.ResidentOccupancyId && o.PropertyId == r.PropertyId && o.Unit == r.Unit &&
            o.StartsAt <= reported && (o.EndsAt == null || reported < o.EndsAt))));
}
