using Microsoft.AspNetCore.Mvc;
namespace RepairLedger.Api.Controllers;

[Route("api/evidence")]
public sealed class EvidenceController(IEvidenceBL business, Actor actor) : RepairLedgerController(actor)
{
    [HttpPost("upload-url")] public async Task<object> Upload(UploadInput input, CancellationToken ct) => Data(await business.Upload(Actor, input, ct));
    [HttpPost("{id}/complete")] public async Task<object> Complete(string id, CompleteUploadInput input, CancellationToken ct) => Data(await business.Complete(Actor, id, input, ct));
    [HttpGet("/api/requests/{requestId}/evidence/{id}/url")]
    public async Task<object> Download(string requestId, string id, CancellationToken ct) => Data(await business.Download(Actor, requestId, id, ct));
}
