using Microsoft.AspNetCore.Mvc;
namespace RepairLedger.Api.Controllers;

[Route("api/dashboard")]
public sealed class DashboardController(IRepairBL business, Actor actor) : RepairLedgerController(actor)
{
    [HttpGet] public async Task<object> Get(CancellationToken ct) => Data(await business.Dashboard(Actor, ct));
}
