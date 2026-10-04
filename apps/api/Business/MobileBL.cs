namespace RepairLedger.Api.Business;

public sealed class MobileBL(IMobileDAL repository, TimeProvider time) : IMobileBL
{
    public async Task<MobileContext> Context(Actor actor, CancellationToken ct)
    {
        actor.RequireMobileUser();
        var properties = await repository.Properties(actor, ct);
        foreach (var property in properties)
            property.Units = actor.Role == "tenant" ? actor.ResidentUnits.GetValueOrDefault(property.Id) ?? [] : [];
        var views=new[]{actor.UserAccess!=false?1:0,actor.CanAdmin?2:0,actor.SellerAccess==true||actor.CanAdmin?3:0}.Where(x=>x>0).ToArray();
        return new(actor.Role, actor.Email, properties, actor.Context, views.Length>1,views,actor.DisplayName??actor.Email.Split('@')[0]);
    }
    public async Task<List<GateVisit>> Visits(Actor actor, CancellationToken ct)
    {
        actor.RequireWatchman();
        var now = time.GetUtcNow();
        return (await repository.Visits(actor, now, ct)).Where(v => v.ArrivedAt != null && v.DepartedAt == null || IsVisitDay(v, now)).ToList();
    }
    public Task<GateVisit> Presence(Actor actor, string id, GatePresenceInput input, CancellationToken ct)
    {
        actor.RequireWatchman();
        if (input.Action is not ("arrive" or "depart") || input.Revision < 0)
            throw new ApiException(400, "Select arrive or depart and provide the current revision.");
        return repository.Presence(actor, id, input, time.GetUtcNow(), ct);
    }
    public static bool IsVisitDay(GateVisit visit, DateTimeOffset now)
    {
        if (!DateTimeOffset.TryParse(visit.StartsAt, out var starts)) return false;
        try
        {
            var zone = TimeZoneInfo.FindSystemTimeZoneById(visit.Timezone);
            return TimeZoneInfo.ConvertTime(starts, zone).Date == TimeZoneInfo.ConvertTime(now, zone).Date;
        }
        catch (TimeZoneNotFoundException) { return false; }
        catch (InvalidTimeZoneException) { return false; }
    }
    public Task<List<CommonAreaIssue>> Issues(Actor actor, CancellationToken ct)
    {
        actor.RequireMobileUser(); return repository.Issues(actor, ct);
    }
    public Task<CommonAreaIssue> Report(Actor actor, CreateCommonAreaInput input, CancellationToken ct)
    {
        actor.RequireMobileUser();
        if (!Guid.TryParseExact(input.SubmissionId, "D", out var submission)) throw new ApiException(400, "Provide a unique submission UUID.");
        if (input.Priority is not ("routine" or "urgent")) throw new ApiException(400, "Select routine or urgent priority.");
        var at = time.GetUtcNow().ToString("O");
        return repository.Report(actor, new CommonAreaIssue
        {
            Id = Guid.NewGuid().ToString("N"), WorkspaceId = actor.WorkspaceId, ReportedBy = actor.Id, SubmissionId = submission.ToString("D"),
            PropertyId = RepairBL.Text(input.PropertyId, "Property", 1, 200), Location = RepairBL.Text(input.Location, "Shared location", 2, 160),
            Title = RepairBL.Text(input.Title, "Title", 3, 200), Category = RepairBL.Text(input.Category, "Category", 2, 100),
            Description = RepairBL.Text(input.Description, "Description", 3, 4000), Priority = input.Priority, CreatedAt = at, UpdatedAt = at
        }, ct);
    }
    public Task<CommonAreaIssue> UpdateIssue(Actor actor, string id, UpdateCommonAreaInput input, CancellationToken ct)
    {
        actor.RequireManager();
        if (input.Status is not ("in_progress" or "resolved") || input.Revision < 0) throw new ApiException(400, "Select in_progress or resolved and provide the current revision.");
        var note = RepairBL.Text(input.Note, "Public update", 3, 1000);
        return repository.UpdateIssue(actor, id, input with { Note = note }, time.GetUtcNow().ToString("O"), ct);
    }
}
