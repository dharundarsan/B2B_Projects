using RepairLedger.Api.ExternalAPI;
namespace RepairLedger.Api.Business;

public sealed class EvidenceBL(IRepairDAL repository, EvidenceStorage storage) : IEvidenceBL
{
    public async Task<object> Upload(Actor actor, UploadInput input, CancellationToken ct)
    {
        RepairBL.Text(input.Name, "Filename", 1, 160);
        if (!EvidenceStorage.ContentTypes.Contains(input.ContentType) || input.Size is < 1 or > 20971520) throw new ApiException(400, "Select a supported image, video or PDF of at most 20 MB.");
        await repository.Get(actor, input.RequestId, ct);
        var e = new Evidence { RequestId = input.RequestId, Name = input.Name, ContentType = input.ContentType, Size = input.Size, UploadedBy = actor.Id };
        // Use only server-generated components in object paths; filenames stay in metadata, never in paths.
        e.Path = $"{Uri.EscapeDataString(actor.WorkspaceId)}/{input.RequestId}/{e.Id}";
        var signed = await storage.Upload(e.Path, ct);
        await repository.Mutate(actor, input.RequestId, repair => { repair.Evidence.Add(e); RepairBL.Event(repair, actor, "evidence", "Evidence upload initiated", input.Name); }, ct);

        return new { evidenceId = e.Id, path = e.Path, signedUrl = signed.Url, token = signed.Token };
    }
    public async Task<object> Complete(Actor actor, string id, CompleteUploadInput input, CancellationToken ct)
    {
        var repair = await repository.Get(actor, input.RequestId, ct);
        var evidence = repair.Evidence.SingleOrDefault(x => x.Id == id) ?? throw new ApiException(404, "Evidence not found.");
        if (evidence.UploadedBy != actor.Id && !actor.IsManager) throw new ApiException(403, "Only the uploader or manager can complete this upload.");
        await storage.Verify(evidence, ct);
        await repository.Mutate(actor, input.RequestId, record => { record.Evidence.Single(x => x.Id == id).Status = "uploaded"; RepairBL.Event(record, actor, "evidence", "Evidence attached", evidence.Name); }, ct);

        return new { evidenceId = id };
    }
    public async Task<object> Download(Actor actor, string requestId, string id, CancellationToken ct)
    {
        var repair = await repository.Get(actor, requestId, ct);
        var evidence = repair.Evidence.SingleOrDefault(x => x.Id == id && x.Status == "uploaded")
            ?? throw new ApiException(404, "Uploaded evidence not found.");
        return new { url = await storage.Download(evidence.Path, ct) };
    }
}
