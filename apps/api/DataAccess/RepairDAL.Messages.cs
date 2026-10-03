using Dapper;
namespace RepairLedger.Api.DataAccess;

public sealed partial class RepairDAL
{
    public async Task<List<Message>> Messages(Actor actor, string id, CancellationToken ct)
    {
        await Get(actor, id, ct); await using var db = await database.Open(ct);
        return (await dapper.QueryAsync<Message>(db, new CommandDefinition(queryHelper.GetSqlQuery("ListMessages"), new { workspace = actor.WorkspaceId, id }, cancellationToken: ct))).ToList();
    }
    public async Task<Message> SendMessage(Actor actor, string id, string body, CancellationToken ct)
    {
        await using var db = await database.Open(ct); await using var tx = await db.BeginTransactionAsync(ct);
        var r = (await Load(db, tx, actor, id, ct)).SingleOrDefault() ?? throw new ApiException(404, "Repair not found.");
        // Revision check prevents a vendor from posting after a concurrent reassignment.
        if (await dapper.ExecuteAsync(db, new CommandDefinition(queryHelper.GetSqlQuery("IncrementRevision"), r, tx, cancellationToken: ct)) != 1) throw new ApiException(409, "Repair changed. Refresh before retrying.");
        var m = new Message { WorkspaceId = actor.WorkspaceId, RequestId = id, Body = body, Sender = actor.Email, Role = actor.Role == "tenant" ? "resident" : actor.Role == "vendor" ? "vendor" : "manager" };
        await dapper.ExecuteAsync(db, new CommandDefinition(queryHelper.GetSqlQuery("InsertMessage"), m, tx, cancellationToken: ct));
        await Notify(db, tx, r, "New repair message", "message", ct); await tx.CommitAsync(ct); return m;
    }
}
