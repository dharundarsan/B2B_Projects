namespace RepairLedger.Api.Models;

public sealed record ResidentOccupancy(string Id, string PropertyId, string Unit, DateTimeOffset StartsAt, DateTimeOffset? EndsAt)
{
    public bool IsActive(DateTimeOffset now) => StartsAt <= now && (EndsAt == null || now < EndsAt);
}
