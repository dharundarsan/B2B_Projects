namespace RepairLedger.Api.Models;

public sealed record UserView(string Role, int UserContext, bool CanSwitchContext, long Revision,
    string DisplayName = "", string Email = "", int[]? AvailableContexts = null);
public sealed record UserViewInput(int UserContext, long Revision);

public sealed class ManagedUser
{
    public string UserId { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string Email { get; set; } = "";
    public string IdentityRole { get; set; } = "";
    public string? ManagedRole { get; set; }
    public string Role => ManagedRole ?? IdentityRole;
    public string Status { get; set; } = "active";
    public bool AllowUser { get; set; }
    public bool AllowAdmin { get; set; }
    public bool AllowSeller { get; set; }
    public int UserContext { get; set; }
    public long Revision { get; set; }
    public string CreatedAt { get; set; } = "";
    [System.Text.Json.Serialization.JsonIgnore] public bool HasStore { get; set; }
    public List<UserMembership> Memberships { get; set; } = [];
}
public sealed class UserMembership
{
    [System.Text.Json.Serialization.JsonIgnore] public string UserId { get; set; } = "";
    public string PropertyId { get; set; } = "";
    public string? UnitId { get; set; }
    public string? UnitLabel { get; set; }
    public string? OccupancyId { get; set; }
    public string? StartsAt { get; set; }
    public string? EndsAt { get; set; }
}
public sealed record ManagedUserInput(string DisplayName, string Email, string Role, bool AllowUser, bool AllowAdmin,
    bool AllowSeller, int DefaultContext, List<UserMembership> Memberships, string? Password = null, long Revision = 0);
public sealed record ManagedUserStatusInput(string Action, long Revision);
public sealed record UserAdminAudit(string Id, string UserId, string ActorId, string Action, string CreatedAt);
