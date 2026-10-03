namespace RepairLedger.Api.Business.Interfaces;

public interface IMobileBL
{
    Task<MobileContext> Context(Actor actor, CancellationToken ct);
    Task<List<GateVisit>> Visits(Actor actor, CancellationToken ct);
    Task<GateVisit> Presence(Actor actor, string id, GatePresenceInput input, CancellationToken ct);
    Task<List<CommonAreaIssue>> Issues(Actor actor, CancellationToken ct);
    Task<CommonAreaIssue> Report(Actor actor, CreateCommonAreaInput input, CancellationToken ct);
    Task<CommonAreaIssue> UpdateIssue(Actor actor, string id, UpdateCommonAreaInput input, CancellationToken ct);
}
