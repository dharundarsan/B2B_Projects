using Microsoft.AspNetCore.Mvc;
namespace RepairLedger.Api.Controllers;

[Route("api/mobile")]
public sealed class MobileController(IMobileBL business, Actor actor) : RepairLedgerController(actor)
{
    [HttpGet("context")] public async Task<object> Context(CancellationToken ct) => Data(await business.Context(Actor, ct));
    [HttpGet("watchman/visits")] public async Task<object> Visits(CancellationToken ct) => Data(await business.Visits(Actor, ct));
    [HttpPost("watchman/visits/{id}/presence")] public async Task<object> Presence(string id, GatePresenceInput input, CancellationToken ct)
        => Data(await business.Presence(Actor, id, input, ct));
    [HttpGet("common-area-issues")] public async Task<object> Issues(CancellationToken ct) => Data(await business.Issues(Actor, ct));
    [HttpPost("common-area-issues")] public async Task<object> Report(CreateCommonAreaInput input, CancellationToken ct)
        => Data(await business.Report(Actor, input, ct));
    [HttpPatch("common-area-issues/{id}")] public async Task<object> UpdateIssue(string id, UpdateCommonAreaInput input, CancellationToken ct)
        => Data(await business.UpdateIssue(Actor, id, input, ct));
}
