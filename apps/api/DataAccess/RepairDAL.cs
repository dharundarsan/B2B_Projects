using System.Data.Common;
using Dapper;
namespace RepairLedger.Api.DataAccess;

public sealed partial class RepairDAL(IConnectionHelper database, ISqlFileQueryHelper queryHelper, IDapperHelper dapper) : IRepairDAL
{

    // Every query carries workspace_id, including child lookups. Never accept table or column names from clients.
    public async Task<List<Repair>> List(Actor actor, CancellationToken ct, string? search = null, string? state = null, string? priority = null, string? property = null)
    {
        await using var db = await database.Open(ct);
        return await Load(db, null, actor, null, ct, search, state, priority, property);
    }
    public async Task<Repair> Get(Actor actor, string id, CancellationToken ct)
    {
        await using var db = await database.Open(ct);
        return (await Load(db, null, actor, id, ct)).SingleOrDefault() ?? throw new ApiException(404, "Repair not found.");
    }
    private async Task<List<Repair>> Load(DbConnection db, DbTransaction? tx, Actor actor, string? id, CancellationToken ct, string? search = null, string? state = null, string? priority = null, string? property = null)
    {
        // Explicit tenant unit predicates prevent unrelated residents' records from reaching application memory.
        var parameters = new DynamicParameters(new { workspace = actor.WorkspaceId, id, vendor = actor.VendorId });
        var scope = "r.workspace_id=@workspace AND (@id IS NULL OR r.id=@id)";
        if (!string.IsNullOrWhiteSpace(search))
        {
            parameters.Add("search", "%" + search.Trim().ToLowerInvariant().Replace("!", "!!").Replace("%", "!%").Replace("_", "!_") + "%");
            scope += queryHelper.GetSqlQuery("RepairSearchPredicate");
        }
        if (!string.IsNullOrEmpty(state)) { parameters.Add("state", state); scope += " AND r.state=@state"; }
        if (!string.IsNullOrEmpty(priority)) { parameters.Add("priority", priority); scope += " AND r.priority=@priority"; }
        if (!string.IsNullOrEmpty(property)) { parameters.Add("property", property); scope += " AND (r.property=@property OR r.property_id=@property)"; }
        if (actor.Role == "vendor") scope += " AND r.assigned_vendor_id=@vendor";
        else if (actor.Role == "tenant")
        {
            var predicates = new List<string>();
            var index = 0;
            foreach (var (propertyKey, units) in actor.PropertyUnits)
            {
                if (units.Length == 0) continue;
                var unitParameters = new List<string>();
                for (var unitIndex = 0; unitIndex < units.Length; unitIndex++)
                {
                    var name = $"u{index}_{unitIndex}";
                    unitParameters.Add("@" + name); parameters.Add(name, units[unitIndex]);
                }
                predicates.Add($"(r.property_id=@p{index} AND r.unit IN ({string.Join(',', unitParameters)}))");
                parameters.Add($"p{index}", propertyKey); index++;
            }
            scope += " AND (" + (predicates.Count == 0 ? "1=0" : string.Join(" OR ", predicates)) + ")";
        }
        else if (!actor.IsManager) scope += " AND 1=0";
        var childScope = $"workspace_id=@workspace AND request_id IN (SELECT r.id FROM requests r WHERE {scope})";
        var sql = queryHelper.GetSqlQuery("LoadRepairs").Replace("{Scope}", scope).Replace("{ChildScope}", childScope);
        using var result = await dapper.QueryMultipleAsync(db, new CommandDefinition(sql, parameters, tx, cancellationToken: ct));
        var repairs = (await result.ReadAsync<Repair>()).ToList();
        var events = (await result.ReadAsync<Activity>()).ToLookup(x => x.RequestId);
        var estimates = (await result.ReadAsync<Estimate>()).ToLookup(x => x.RequestId);
        var appointments = (await result.ReadAsync<Appointment>()).ToLookup(x => x.RequestId);
        var evidence = (await result.ReadAsync<Evidence>()).ToLookup(x => x.RequestId);
        var offers = (await result.ReadAsync<VendorOffer>()).ToLookup(x => x.RequestId);
        var verifications = (await result.ReadAsync<VerificationRecord>()).ToLookup(x => x.RequestId);
        foreach (var r in repairs)
        {
            r.Events = events[r.Id].ToList(); r.Estimates = estimates[r.Id].ToList();
            r.Appointments = appointments[r.Id].ToList(); r.Evidence = evidence[r.Id].ToList();
            r.Offers = offers[r.Id].ToList(); r.VerificationHistory = verifications[r.Id].ToList();
            r.SafetyAnswers = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, string>>(r.SafetyJson) ?? [];
            r.ResidentVerification = r.VerificationJson == null ? null : System.Text.Json.JsonSerializer.Deserialize<Verification>(r.VerificationJson);
        }
        return repairs;
    }

    public async Task<Repair> Create(Actor actor, Repair repair, CancellationToken ct)
    {
        await using var db = await database.Open(ct);
        await using var tx = await db.BeginTransactionAsync(ct);
        // Lock the property row through a harmless write, also serializing concurrent archive/create actions.
        var active = await dapper.ExecuteAsync(db, new CommandDefinition(queryHelper.GetSqlQuery("LockRepairProperty"), repair, tx, cancellationToken: ct));
        if (active != 1) throw new ApiException(409, "Property is no longer active.");
        repair.UnitId = await LinkUnit(db, tx, repair, ct);
        repair.SafetyJson = System.Text.Json.JsonSerializer.Serialize(repair.SafetyAnswers);
        await dapper.ExecuteAsync(db, new CommandDefinition(queryHelper.GetSqlQuery("InsertRepair"), repair, tx, cancellationToken: ct));
        await LinkRequest(db, tx, repair, ct);
        await SaveChildren(db, tx, repair, ct);
        await Notify(db, tx, repair, "New repair reported", "request", ct);
        await tx.CommitAsync(ct);
        return repair;
    }

    public async Task<Repair> Mutate(Actor actor, string id, Action<Repair> change, CancellationToken ct, long? expectedRevision = null)
    {
        await using var db = await database.Open(ct);
        await using var tx = await db.BeginTransactionAsync(ct);
        var r = (await Load(db, tx, actor, id, ct)).SingleOrDefault() ?? throw new ApiException(404, "Repair not found.");
        if (expectedRevision.HasValue && expectedRevision != r.Revision) throw new ApiException(409, "Repair changed. Refresh before retrying.");
        var persisted = CaptureChildren(r);
        change(r);
        r.VerificationJson = r.ResidentVerification == null ? null : System.Text.Json.JsonSerializer.Serialize(r.ResidentVerification);
        var updated = await dapper.ExecuteAsync(db, new CommandDefinition(queryHelper.GetSqlQuery("UpdateRepair"), r, tx, cancellationToken: ct));
        if (updated != 1) throw new ApiException(409, "Repair changed. Refresh before retrying.");
        await SaveChildren(db, tx, r, ct, persisted);
        await Notify(db, tx, r, r.Events.LastOrDefault()?.Label ?? "Repair updated", "request", ct);
        await tx.CommitAsync(ct);
        r.Revision++;
        return r;
    }

    private async Task SaveChildren(DbConnection db, DbTransaction tx, Repair r, CancellationToken ct, PersistedChildren? before = null)
    {
        await SaveOfferAndVerification(db, tx, r, ct, before);
        foreach (var e in r.Events.Where(e => before == null || !before.Events.Contains(e.Id))) await dapper.ExecuteAsync(db, new CommandDefinition(queryHelper.GetSqlQuery("AppendEvent"), new { workspace = r.WorkspaceId, request = r.Id, e.Id, e.Type, e.Label, e.Detail, e.At, e.Actor }, tx, cancellationToken: ct));
        foreach (var e in r.Estimates.Where(e => before == null || !before.Estimates.TryGetValue(e.Id, out var saved) || saved != (e.Status, e.ApprovedAt, e.ApprovedBy))) await dapper.ExecuteAsync(db, new CommandDefinition(queryHelper.GetSqlQuery(before?.Estimates.ContainsKey(e.Id) == true ? "UpdateEstimate" : "SaveEstimate"), new { workspace = r.WorkspaceId, request = r.Id, e.Id, e.Version, e.Scope, e.Labor, e.Parts, e.Tax, e.Total, e.Status, e.CreatedAt, e.ApprovedAt, e.ApprovedBy, e.VendorId, e.Currency }, tx, cancellationToken: ct));
        foreach (var a in r.Appointments.Where(a => before == null || !before.Appointments.TryGetValue(a.Id, out var saved) || saved != (a.Status, a.ResidentConfirmedAt, a.VendorConfirmedAt))) await dapper.ExecuteAsync(db, new CommandDefinition(queryHelper.GetSqlQuery(before?.Appointments.ContainsKey(a.Id) == true ? "UpdateAppointment" : "SaveAppointment"), new { workspace = r.WorkspaceId, request = r.Id, a.Id, a.StartsAt, a.EndsAt, a.Timezone, a.Status, a.ResidentConfirmedAt, a.VendorConfirmedAt, a.CreatedAt }, tx, cancellationToken: ct));
        foreach (var e in r.Evidence.Where(e => before == null || !before.Evidence.TryGetValue(e.Id, out var status) || status != e.Status)) await dapper.ExecuteAsync(db, new CommandDefinition(queryHelper.GetSqlQuery(before?.Evidence.ContainsKey(e.Id) == true ? "UpdateEvidence" : "SaveEvidence"), new { workspace = r.WorkspaceId, request = r.Id, e.Id, e.Path, e.Name, e.ContentType, e.Size, e.UploadedBy, e.CreatedAt, e.Status }, tx, cancellationToken: ct));
    }
    private async Task SaveOfferAndVerification(DbConnection db, DbTransaction tx, Repair r, CancellationToken ct, PersistedChildren? before)
    {
        foreach (var offer in r.Offers.Where(o => before == null || !before.Offers.TryGetValue(o.Id, out var saved) || saved != (o.Status, o.RespondedAt, o.ResponseBy, o.ResponseNote)))
            await dapper.ExecuteAsync(db, new CommandDefinition(queryHelper.GetSqlQuery(before?.Offers.ContainsKey(offer.Id) == true ? "UpdateOffer" : "SaveOffer"),
                new
                {
                    workspace = r.WorkspaceId,
                    request = r.Id,
                    offer.Id,
                    offer.VendorId,
                    offer.Sequence,
                    offer.Status,
                    offer.OfferedAt,
                    offer.RespondedAt,
                    offer.OfferedBy,
                    offer.ResponseBy,
                    offer.Note,
                    offer.ResponseNote,
                    legacy = offer.LegacySnapshot ? 1 : 0
                }, tx, cancellationToken: ct));
        foreach (var verification in r.VerificationHistory.Where(v => before == null || !before.Verifications.Contains(v.Id)))
            await dapper.ExecuteAsync(db, new CommandDefinition(queryHelper.GetSqlQuery("AppendVerification"),
                new
                {
                    workspace = r.WorkspaceId,
                    request = r.Id,
                    verification.Id,
                    verification.Revision,
                    verification.Status,
                    verification.Note,
                    verification.ActorId,
                    verification.RecordedAt,
                    legacy = verification.LegacySnapshot ? 1 : 0
                }, tx, cancellationToken: ct));
    }
    private async Task<string> LinkUnit(DbConnection db, DbTransaction tx, Repair r, CancellationToken ct)
    {
        var p = new
        {
            workspace = r.WorkspaceId,
            property = r.PropertyId,
            label = r.Unit,
            id = Guid.NewGuid().ToString("N"),
            at = DateTimeOffset.UtcNow.ToString("O")
        };
        var existing = (await dapper.QueryAsync<PropertyUnit>(db, new CommandDefinition(queryHelper.GetSqlQuery("GetUnit"), p, tx, cancellationToken: ct))).SingleOrDefault();
        if (existing != null)
        {
            if (existing.Archived != 0) throw new ApiException(409, "This unit is archived.");
            return existing.Id;
        }
        var capacity = await dapper.ExecuteScalarAsync<int>(db, new CommandDefinition(queryHelper.GetSqlQuery("UnitCapacity"), p, tx, cancellationToken: ct));
        var count = await dapper.ExecuteScalarAsync<int>(db, new CommandDefinition(queryHelper.GetSqlQuery("CountUnits"), p, tx, cancellationToken: ct));
        if (count >= capacity) throw new ApiException(409, "Increase the property's capacity or select a registered unit.");
        await dapper.ExecuteAsync(db, new CommandDefinition(queryHelper.GetSqlQuery("InsertUnit"), p, tx, cancellationToken: ct));
        var unit = await dapper.QuerySingleAsync<PropertyUnit>(db, new CommandDefinition(queryHelper.GetSqlQuery("GetUnit"), p, tx, cancellationToken: ct));
        if (unit.Archived != 0) throw new ApiException(409, "This unit is archived.");
        return unit.Id;
    }
    private Task LinkRequest(DbConnection db, DbTransaction tx, Repair r, CancellationToken ct) =>
        dapper.ExecuteAsync(db, new CommandDefinition(queryHelper.GetSqlQuery("InsertRequestLocation"),
            new { workspace = r.WorkspaceId, request = r.Id, property = r.PropertyId, unit = r.UnitId }, tx, cancellationToken: ct));
    private Task EnsureWorkspace(DbConnection db, DbTransaction tx, string workspace, CancellationToken ct) =>
        dapper.ExecuteAsync(db, new CommandDefinition(queryHelper.GetSqlQuery("EnsureWorkspace"),
            new { workspace, at = DateTimeOffset.UtcNow.ToString("O") }, tx, cancellationToken: ct));

    private Task Notify(DbConnection db, DbTransaction tx, Repair r, string title, string type, CancellationToken ct) => dapper.ExecuteAsync(db, new CommandDefinition(queryHelper.GetSqlQuery("InsertRepairNotification"), new { workspace = r.WorkspaceId, id = Guid.NewGuid().ToString("N"), title, detail = $"{r.Id} · {r.Title}", type, href = $"/requests/{r.Id}", request = r.Id, at = DateTimeOffset.UtcNow.ToString("O") }, tx, cancellationToken: ct));


    // An existing history row is not re-written on every unrelated repair action.
    // The parent revision check still gates the entire transaction.
    private sealed record PersistedChildren(
        HashSet<string> Events, HashSet<string> Verifications,
        Dictionary<string, (string Status, string? At, string? By)> Estimates,
        Dictionary<string, (string Status, string? Resident, string? Vendor)> Appointments,
        Dictionary<string, string> Evidence,
        Dictionary<string, (string Status, string? At, string? By, string? Note)> Offers);
    private static PersistedChildren CaptureChildren(Repair r) => new(
        r.Events.Select(e => e.Id).ToHashSet(), r.VerificationHistory.Select(v => v.Id).ToHashSet(),
        r.Estimates.ToDictionary(e => e.Id, e => (e.Status, e.ApprovedAt, e.ApprovedBy)),
        r.Appointments.ToDictionary(a => a.Id, a => (a.Status, a.ResidentConfirmedAt, a.VendorConfirmedAt)),
        r.Evidence.ToDictionary(e => e.Id, e => e.Status),
        r.Offers.ToDictionary(o => o.Id, o => (o.Status, o.RespondedAt, o.ResponseBy, o.ResponseNote)));

}
