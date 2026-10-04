using Microsoft.AspNetCore.Mvc;
using RepairLedger.Api.DataAccess;
namespace RepairLedger.Api.Controllers;

[Route("api/user/context")]
public sealed class UserController(UserDAL users, Actor actor) : RepairLedgerController(actor)
{
    [HttpGet] public async Task<object> Read(CancellationToken ct) => Data(await users.Read(Actor, ct));
    [HttpPatch] public async Task<object> Switch(UserViewInput input, CancellationToken ct) => Data(await users.Switch(Actor, input, ct));
}
