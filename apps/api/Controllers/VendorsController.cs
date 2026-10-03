using Microsoft.AspNetCore.Mvc;
namespace RepairLedger.Api.Controllers;

[Route("api/vendors")]
public sealed class VendorsController(IRepairBL business, Actor actor) : RepairLedgerController(actor)
{
    [HttpGet] public async Task<object> List(CancellationToken ct) => Data(await business.Vendors(Actor, ct));
    [HttpPost("invite")] public async Task<object> Invite(VendorInput input, CancellationToken ct) => Data(await business.InviteVendor(Actor, input, ct));
}
