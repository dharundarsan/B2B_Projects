using Dapper;
using System.Data.Common;
namespace RepairLedger.Api.DataAccess;

public sealed class MobileDAL(IConnectionHelper database, ISqlFileQueryHelper sql, IDapperHelper dapper) : IMobileDAL
{
    private static (string Sql, DynamicParameters Parameters) Scope(Actor actor, string column)
    {
        actor.RequireMobileUser();
        var p = new DynamicParameters(new { workspace = actor.WorkspaceId });
        if (actor.IsManager) return ("1=1", p);
        var ids = actor.MobilePropertyIds.Distinct().ToArray();
        if (ids.Length == 0) return ("1=0", p);
        var names = ids.Select((id, i) => { p.Add("property" + i, id); return "@property" + i; });
        // column is always a server-owned literal, never request input.
        return ($"{column} IN ({string.Join(',', names)})", p);
    }
    public async Task<List<MobileProperty>> Properties(Actor actor, CancellationToken ct)
    {
        var scope = Scope(actor, "p.id");
        await using var db = await database.Open(ct);
        return (await dapper.QueryAsync<MobileProperty>(db, new CommandDefinition(sql.GetSqlQuery("MobileProperties")
            .Replace("{PropertyScope}", scope.Sql), scope.Parameters, cancellationToken: ct))).ToList();
    }
    public async Task<List<GateVisit>> Visits(Actor actor, DateTimeOffset now, CancellationToken ct)
    {
        actor.RequireWatchman(); var scope = Scope(actor, "r.property_id");
        scope.Parameters.Add("fromAt", now.AddHours(-38).ToString("O")); scope.Parameters.Add("toAt", now.AddHours(38).ToString("O"));
        await using var db = await database.Open(ct);
        return (await dapper.QueryAsync<GateVisit>(db, new CommandDefinition(sql.GetSqlQuery("MobileVisits")
            .Replace("{PropertyScope}", scope.Sql).Replace("{VisitFilter}",
                "AND ((a.starts_at>=@fromAt AND a.starts_at<@toAt) OR (g.arrived_at IS NOT NULL AND g.departed_at IS NULL))"),
            scope.Parameters, cancellationToken: ct))).ToList();
    }
    private async Task<GateVisit> GetVisit(DbConnection db, DbTransaction tx, Actor actor, string id, CancellationToken ct)
    {
        var scope = Scope(actor, "r.property_id"); scope.Parameters.Add("id", id);
        return (await dapper.QueryAsync<GateVisit>(db, new CommandDefinition(sql.GetSqlQuery("MobileVisits")
            .Replace("{PropertyScope}", scope.Sql).Replace("{VisitFilter}", "AND a.id=@id"), scope.Parameters, tx, cancellationToken: ct)))
            .SingleOrDefault() ?? throw new ApiException(404, "Visit not found in your assigned buildings.");
    }
    public async Task<GateVisit> Presence(Actor actor, string id, GatePresenceInput input, DateTimeOffset now, CancellationToken ct)
    {
        actor.RequireWatchman();
        await using var db = await database.Open(ct); await using var tx = await db.BeginTransactionAsync(database.Provider == RepairLedger.Api.Enums.DatabaseConnectionType.MySql
            ? System.Data.IsolationLevel.ReadCommitted : System.Data.IsolationLevel.Serializable, ct);
        await GetVisit(db, tx, actor, id, ct); // Scope before acquiring any locks.
        var p = new { workspace = actor.WorkspaceId, id, actor = actor.Id, at = now.ToString("O"), input.Revision };
        await dapper.ExecuteAsync(db, new CommandDefinition(sql.GetSqlQuery("LockGateVisit"), p, tx, cancellationToken: ct));
        var visit = await GetVisit(db, tx, actor, id, ct);
        if (visit.Revision != input.Revision) throw new ApiException(409, "Visit changed. Refresh before retrying.");
        if (input.Action == "arrive")
        {
            if (visit.ArrivedAt != null || visit.AppointmentStatus != "confirmed" || visit.VendorDecision != "accepted"
                || visit.RepairState is "verification" or "completed" or "closed" or "cancelled" or "invoice_review"
                || !MobileBL.IsVisitDay(visit, now)) throw new ApiException(409, "Only a confirmed visit for today can be checked in once.");
            await dapper.ExecuteAsync(db, new CommandDefinition(sql.GetSqlQuery("InsertGatePresence"), p, tx, cancellationToken: ct));
            visit.ArrivedAt = p.at;
        }
        else if (input.Action == "depart")
        {
            if (visit.ArrivedAt == null || visit.DepartedAt != null) throw new ApiException(409, "Record arrival before departure. A finished visit cannot be checked out again.");
            if (await dapper.ExecuteAsync(db, new CommandDefinition(sql.GetSqlQuery("DepartGatePresence"), p, tx, cancellationToken: ct)) != 1)
                throw new ApiException(409, "Visit changed. Refresh before retrying.");
            visit.DepartedAt = p.at;
        }
        else throw new ApiException(400, "Select arrive or depart.");
        await tx.CommitAsync(ct); visit.Revision++; return visit;
    }
    public async Task<List<CommonAreaIssue>> Issues(Actor actor, CancellationToken ct)
    {
        var scope = Scope(actor, "i.property_id"); await using var db = await database.Open(ct);
        return (await dapper.QueryAsync<CommonAreaIssue>(db, new CommandDefinition(sql.GetSqlQuery("MobileIssues")
            .Replace("{PropertyScope}", scope.Sql).Replace("{IssueFilter}", ""), scope.Parameters, cancellationToken: ct))).ToList();
    }
    public async Task<CommonAreaIssue> Report(Actor actor, CommonAreaIssue issue, CancellationToken ct)
    {
        var scope = Scope(actor, "p.id"); scope.Parameters.Add("id", issue.PropertyId);
        await using var db = await database.Open(ct); await using var tx = await db.BeginTransactionAsync(database.Provider == RepairLedger.Api.Enums.DatabaseConnectionType.MySql
            ? System.Data.IsolationLevel.ReadCommitted : System.Data.IsolationLevel.Serializable, ct);
        var property = (await dapper.QueryAsync<MobileProperty>(db, new CommandDefinition(sql.GetSqlQuery("MobileProperties")
            .Replace("{PropertyScope}", scope.Sql + " AND p.id=@id"), scope.Parameters, tx, cancellationToken: ct)))
            .SingleOrDefault() ?? throw new ApiException(404, "Building not found in your assignments.");
        if (await dapper.ExecuteAsync(db, new CommandDefinition(sql.GetSqlQuery("LockProperty"),
            new { workspace = actor.WorkspaceId, id = issue.PropertyId }, tx, cancellationToken: ct)) != 1)
            throw new ApiException(409, "Building is no longer active.");
        var previous = (await dapper.QueryAsync<CommonAreaIssue>(db, new CommandDefinition(sql.GetSqlQuery("MobileSubmission"),
            issue, tx, cancellationToken: ct))).SingleOrDefault();
        if (previous != null)
        {
            if (previous.PropertyId != issue.PropertyId || previous.Location != issue.Location || previous.Title != issue.Title
                || previous.Description != issue.Description || previous.Category != issue.Category || previous.Priority != issue.Priority)
                throw new ApiException(409, "Submission ID was already used for a different report.");
            await tx.CommitAsync(ct); return previous;
        }
        issue.PropertyName = property.Name;
        await dapper.ExecuteAsync(db, new CommandDefinition(sql.GetSqlQuery("InsertMobileIssue"), issue, tx, cancellationToken: ct));
        await AppendIssueEvent(db, tx, actor, issue.Id, "reported", "Report received", issue.CreatedAt, ct);
        await tx.CommitAsync(ct); return issue;
    }
    public async Task<CommonAreaIssue> UpdateIssue(Actor actor, string id, UpdateCommonAreaInput input, string at, CancellationToken ct)
    {
        actor.RequireManager(); await using var db = await database.Open(ct); await using var tx = await db.BeginTransactionAsync(ct);
        var scope = Scope(actor, "i.property_id"); scope.Parameters.Add("id", id);
        var issue = (await dapper.QueryAsync<CommonAreaIssue>(db, new CommandDefinition(sql.GetSqlQuery("MobileIssues")
            .Replace("{PropertyScope}", scope.Sql).Replace("{IssueFilter}", "AND i.id=@id"), scope.Parameters, tx, cancellationToken: ct)))
            .SingleOrDefault() ?? throw new ApiException(404, "Common-area report not found.");
        if (input.Revision != issue.Revision) throw new ApiException(409, "Report changed. Refresh before retrying.");
        if (issue.Status == "resolved" || input.Status is not ("in_progress" or "resolved")) throw new ApiException(409, "This report cannot move to that status.");
        if (await dapper.ExecuteAsync(db, new CommandDefinition(sql.GetSqlQuery("UpdateMobileIssue"),
            new { workspace = actor.WorkspaceId, id, input.Status, input.Note, input.Revision, at, actor = actor.Id }, tx, cancellationToken: ct)) != 1)
            throw new ApiException(409, "Report changed. Refresh before retrying.");
        await AppendIssueEvent(db, tx, actor, id, input.Status, input.Note, at, ct);
        await tx.CommitAsync(ct); issue.Status = input.Status; issue.ResolutionNote = input.Note; issue.UpdatedAt = at; issue.Revision++;
        return issue;
    }
    private Task AppendIssueEvent(DbConnection db, DbTransaction tx, Actor actor, string issue, string status, string note, string at, CancellationToken ct)
        => dapper.ExecuteAsync(db, new CommandDefinition(sql.GetSqlQuery("AppendMobileIssueEvent"),
            new { workspace = actor.WorkspaceId, id = Guid.NewGuid().ToString("N"), issue, status, note, actor = actor.Id, at }, tx, cancellationToken: ct));
}
