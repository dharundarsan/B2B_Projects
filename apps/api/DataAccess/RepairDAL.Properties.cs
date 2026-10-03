using Dapper;
namespace RepairLedger.Api.DataAccess;

public sealed partial class RepairDAL
{
    public async Task<List<Property>> Properties(Actor actor, CancellationToken ct)
    {
        var residentUnits = actor.ResidentUnits;
        if (!actor.IsManager && (actor.Role != "tenant" || residentUnits.Count == 0)) return [];
        var parameters = new DynamicParameters(new { workspace = actor.WorkspaceId });
        var scope = "p.workspace_id=@workspace AND p.archived=0";
        if (!actor.IsManager)
        {
            var names = new List<string>();
            foreach (var property in residentUnits.Keys)
            {
                var name = "property" + names.Count; names.Add("@" + name); parameters.Add(name, property);
            }
            scope += $" AND p.id IN ({string.Join(',', names)})";
        }
        await using var db = await database.Open(ct);
        var data = await dapper.QueryAsync<Property>(db, new CommandDefinition(queryHelper.GetSqlQuery("ListProperties").Replace("{Scope}", scope), parameters, cancellationToken: ct));
        // Tenants receive only their properties, with no counts for other residents' repairs.
        return data.Where(p => actor.IsManager || (actor.Role == "tenant" && residentUnits.ContainsKey(p.Id)))
            .Select(p => { if (!actor.IsManager) { p.OpenRequests = 0; p.UrgentRequests = 0; } return p; }).ToList();
    }
    public async Task<Property> SaveProperty(Actor actor, Property p, bool create, CancellationToken ct)
    {
        actor.RequireManager(); p.WorkspaceId = actor.WorkspaceId;
        await using var db = await database.Open(ct);
        await using var tx = await db.BeginTransactionAsync(ct);
        await EnsureWorkspace(db, tx, actor.WorkspaceId, ct);
        if (!create && await dapper.ExecuteAsync(db, new CommandDefinition(queryHelper.GetSqlQuery("LockProperty"),
            new { workspace = actor.WorkspaceId, id = p.Id }, tx, cancellationToken: ct)) != 1)
            throw new ApiException(404, "Property not found.");
        if (!create && p.Units < await dapper.ExecuteScalarAsync<int>(db, new CommandDefinition(queryHelper.GetSqlQuery("CountUnits"),
            new { workspace = actor.WorkspaceId, property = p.Id }, tx, cancellationToken: ct)))
            throw new ApiException(409, "Declared capacity cannot be less than the number of registered units.");
        var sql = create ? queryHelper.GetSqlQuery("InsertProperty") : queryHelper.GetSqlQuery("UpdateProperty");
        if (await dapper.ExecuteAsync(db, new CommandDefinition(sql, p, tx, cancellationToken: ct)) != 1) throw new ApiException(404, "Property not found.");
        await tx.CommitAsync(ct);
        return (await Properties(actor, ct)).Single(x => x.Id == p.Id);
    }
    public async Task ArchiveProperty(Actor actor, string id, CancellationToken ct)
    {
        actor.RequireManager(); await using var db = await database.Open(ct); await using var tx = await db.BeginTransactionAsync(ct);
        var p = new { workspace = actor.WorkspaceId, id };
        if (await dapper.ExecuteAsync(db, new CommandDefinition(queryHelper.GetSqlQuery("LockProperty"), p, tx, cancellationToken: ct)) != 1) throw new ApiException(404, "Property not found.");
        if (await dapper.ExecuteScalarAsync<int>(db, new CommandDefinition(queryHelper.GetSqlQuery("CountActivePropertyRepairs"), p, tx, cancellationToken: ct)) > 0) throw new ApiException(409, "Close active repairs, resolve shared-area reports and record outstanding departures before archiving this property.");
        await dapper.ExecuteAsync(db, new CommandDefinition(queryHelper.GetSqlQuery("ArchiveProperty"), p, tx, cancellationToken: ct)); await tx.CommitAsync(ct);
    }
    public async Task<List<PropertyUnit>> Units(Actor actor, string property, CancellationToken ct)
    {
        if (!(await Properties(actor, ct)).Any(p => p.Id == property)) throw new ApiException(404, "Property not found.");
        var p = new DynamicParameters(new { workspace = actor.WorkspaceId, property });
        var scope = "";
        if (!actor.IsManager)
        {
            var labels = actor.ResidentUnits.GetValueOrDefault(property) ?? [];
            if (labels.Length == 0) return [];
            var names = labels.Select((label, index) => { p.Add("label" + index, label); return "@label" + index; });
            scope = $" AND label IN ({string.Join(',', names)})";
        }
        await using var db = await database.Open(ct);
        return (await dapper.QueryAsync<PropertyUnit>(db, new CommandDefinition(
            queryHelper.GetSqlQuery("ListUnits").Replace("{UnitScope}", scope), p, cancellationToken: ct))).ToList();
    }

    public async Task<PropertyUnit> AddUnit(Actor actor, string property, string label, CancellationToken ct)
    {
        actor.RequireManager();
        await using var db = await database.Open(ct); await using var tx = await db.BeginTransactionAsync(ct);
        if (await dapper.ExecuteAsync(db, new CommandDefinition(queryHelper.GetSqlQuery("LockProperty"),
            new { workspace = actor.WorkspaceId, id = property }, tx, cancellationToken: ct)) != 1) throw new ApiException(404, "Property not found.");
        var p = new { workspace = actor.WorkspaceId, property, label, id = Guid.NewGuid().ToString("N"), at = DateTimeOffset.UtcNow.ToString("O") };
        if ((await dapper.QueryAsync<PropertyUnit>(db, new CommandDefinition(queryHelper.GetSqlQuery("GetUnit"), p, tx, cancellationToken: ct))).Any())
            throw new ApiException(409, "This unit is already registered.");
        var capacity = await dapper.ExecuteScalarAsync<int>(db, new CommandDefinition(queryHelper.GetSqlQuery("UnitCapacity"), p, tx, cancellationToken: ct));
        var count = await dapper.ExecuteScalarAsync<int>(db, new CommandDefinition(queryHelper.GetSqlQuery("CountUnits"), p, tx, cancellationToken: ct));
        if (count >= capacity) throw new ApiException(409, "Increase the property's declared capacity before registering another unit.");
        if (await dapper.ExecuteAsync(db, new CommandDefinition(queryHelper.GetSqlQuery("InsertUnit"), p, tx, cancellationToken: ct)) != 1)
            throw new ApiException(409, "This unit label is already registered.");
        var unit = await dapper.QuerySingleAsync<PropertyUnit>(db, new CommandDefinition(queryHelper.GetSqlQuery("GetUnit"), p, tx, cancellationToken: ct));
        await tx.CommitAsync(ct); return unit;
    }
}
