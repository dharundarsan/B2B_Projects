namespace RepairLedger.Api.Business.Interfaces;

public interface IEvidenceBL
{
    Task<object> Upload(Actor actor, UploadInput input, CancellationToken ct);
    Task<object> Complete(Actor actor, string id, CompleteUploadInput input, CancellationToken ct);
    Task<object> Download(Actor actor, string requestId, string id, CancellationToken ct);
}
