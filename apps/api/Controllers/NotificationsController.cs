using Microsoft.AspNetCore.Mvc;
namespace RepairLedger.Api.Controllers;

[Route("api/notifications")]
public sealed class NotificationsController(IRepairBL business, Actor actor) : RepairLedgerController(actor)
{
    [HttpGet] public async Task<object> List(CancellationToken ct) => Data(await business.Notifications(Actor, ct));
    [HttpPost("{id}/read")] public async Task<object> Read(string id, CancellationToken ct) => Data(await business.ReadNotification(Actor, id, ct));
}
