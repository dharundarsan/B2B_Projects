using Microsoft.AspNetCore.Mvc;
namespace RepairLedger.Api.Controllers;

[Route("api/properties")]
public sealed class PropertiesController(IRepairBL business, Actor actor) : RepairLedgerController(actor)
{
    [HttpGet] public async Task<object> List(CancellationToken ct) => Data(await business.Properties(Actor, ct));
    [HttpPost] public async Task<object> Create(PropertyInput input, CancellationToken ct) => Data(await business.SaveProperty(Actor, input, null, ct));
    [HttpPatch("{id}")] public async Task<object> Update(string id, PropertyInput input, CancellationToken ct) => Data(await business.SaveProperty(Actor, input, id, ct));
    [HttpDelete("{id}")]
    public async Task<object> Archive(string id, CancellationToken ct)
    { await business.ArchiveProperty(Actor, id, ct); return Data(new { id, archived = true }); }
    [HttpGet("{id}/units")] public async Task<object> Units(string id, CancellationToken ct) => Data(await business.Units(Actor, id, ct));
    [HttpPost("{id}/units")] public async Task<object> AddUnit(string id, UnitInput input, CancellationToken ct) => Data(await business.AddUnit(Actor, id, input, ct));
}
