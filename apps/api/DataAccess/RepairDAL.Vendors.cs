using Dapper;
namespace RepairLedger.Api.DataAccess;

public sealed partial class RepairDAL
{
    public async Task<List<Vendor>> Vendors(Actor actor, CancellationToken ct)
    {
        actor.RequireManager(); await using var db = await database.Open(ct);
        return (await queryHelper.ExecuteQuery("ListVendors", sql =>
            dapper.QueryAsync<Vendor>(db, new CommandDefinition(sql, new { workspace = actor.WorkspaceId }, cancellationToken: ct)))).ToList();
    }
    public async Task<Vendor> SaveVendor(Actor actor, Vendor v, CancellationToken ct)
    {
        actor.RequireManager(); v.WorkspaceId = actor.WorkspaceId; await using var db = await database.Open(ct);
        await using var tx = await db.BeginTransactionAsync(ct);
        await EnsureWorkspace(db, tx, actor.WorkspaceId, ct);
        await dapper.ExecuteAsync(db, new CommandDefinition(queryHelper.GetSqlQuery("InsertVendor"), v, tx, cancellationToken: ct)); await tx.CommitAsync(ct); return v;
    }
}
