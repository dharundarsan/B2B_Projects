using Microsoft.AspNetCore.Mvc;
using RepairLedger.Api.DataAccess;
namespace RepairLedger.Api.Controllers;
[Route("api/admin/users")]
public sealed class UserManagementController(UserDAL users,UserManagementBL business,Actor actor):RepairLedgerController(actor)
{
    [HttpGet] public async Task<object> List(CancellationToken ct)=>Data(await users.List(Actor,ct));
    [HttpPost] public async Task<object> Create(ManagedUserInput input,CancellationToken ct)=>Data(await business.Create(Actor,input,ct));
    [HttpPatch("{id}")] public async Task<object> Update(string id,ManagedUserInput input,CancellationToken ct)=>Data(await business.Update(Actor,id,input,ct));
    [HttpPost("{id}/status")] public async Task<object> Status(string id,ManagedUserStatusInput input,CancellationToken ct)=>Data(await users.Status(Actor,id,input,ct));
}
