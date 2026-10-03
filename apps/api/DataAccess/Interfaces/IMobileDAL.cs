namespace RepairLedger.Api.DataAccess.Interfaces;

public interface IMobileDAL
{
    Task<List<MobileProperty>> Properties(Actor actor, CancellationToken ct);
    Task<List<GateVisit>> Visits(Actor actor, DateTimeOffset now, CancellationToken ct);
    Task<GateVisit> Presence(Actor actor, string id, GatePresenceInput input, DateTimeOffset now, CancellationToken ct);
    Task<List<CommonAreaIssue>> Issues(Actor actor, CancellationToken ct);
    Task<CommonAreaIssue> Report(Actor actor, CommonAreaIssue issue, CancellationToken ct);
    Task<CommonAreaIssue> UpdateIssue(Actor actor, string id, UpdateCommonAreaInput input, string at, CancellationToken ct);
}
