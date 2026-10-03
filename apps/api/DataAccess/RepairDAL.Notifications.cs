using Dapper;
namespace RepairLedger.Api.DataAccess;

public sealed partial class RepairDAL
{
    public async Task<List<Notification>> Notifications(Actor actor, CancellationToken ct)
    {
        actor.RequireManager(); await using var db = await database.Open(ct);
        return (await dapper.QueryAsync<Notification>(db, new CommandDefinition(queryHelper.GetSqlQuery("ListNotifications"), new { workspace = actor.WorkspaceId, user = actor.Id }, cancellationToken: ct))).ToList();
    }
    public async Task<Notification> ReadNotification(Actor actor, string id, CancellationToken ct)
    {
        actor.RequireManager(); await using var db = await database.Open(ct);
        var p = new { workspace = actor.WorkspaceId, id, user = actor.Id, at = DateTimeOffset.UtcNow.ToString("O") };
        if (await dapper.ExecuteAsync(db, new CommandDefinition(queryHelper.GetSqlQuery("ReadNotification"), p, cancellationToken: ct)) < 1) throw new ApiException(404, "Notification not found.");
        return await dapper.QuerySingleAsync<Notification>(db, new CommandDefinition(queryHelper.GetSqlQuery("GetNotification"), p, cancellationToken: ct));
    }
}
