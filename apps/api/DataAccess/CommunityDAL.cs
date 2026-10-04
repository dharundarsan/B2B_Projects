using System.Data;
using System.Data.Common;
using Dapper;
namespace RepairLedger.Api.DataAccess;

public sealed class CommunityDAL(IConnectionHelper database, ISqlFileQueryHelper sql, IDapperHelper dapper)
{
    public async Task<(List<Property> Properties, string[] Related)> Context(Actor actor, string today, CancellationToken ct)
    {
        await using var db = await database.Open(ct);
        using var grid = await dapper.QueryMultipleAsync(db, new CommandDefinition(sql.GetSqlQuery("CommunityContext"),
            new { workspace = actor.WorkspaceId, user = actor.Id, today }, cancellationToken: ct));
        return ((await grid.ReadAsync<Property>()).ToList(), (await grid.ReadAsync<string>()).ToArray());
    }
    public async Task<CommunityData> Read(Actor actor, string property, CancellationToken ct)
    {
        await using var db = await database.Open(ct);
        await using var tx = await db.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var data = await new Session(db, tx, sql, dapper, actor, property, ct).Load();
        await tx.CommitAsync(ct); return data;
    }
    public async Task<T> Write<T>(Actor actor, string property, Func<Session, CommunityData, Task<T>> action, CancellationToken ct)
    {
        await using var db = await database.Open(ct);
        await using var tx = await db.BeginTransactionAsync(database.Provider == Enums.DatabaseConnectionType.MySql ? IsolationLevel.ReadCommitted : IsolationLevel.Serializable, ct);
        if (await dapper.ExecuteAsync(db, new CommandDefinition(sql.GetSqlQuery("LockProperty"),
            new { workspace = actor.WorkspaceId, id = property }, tx, cancellationToken: ct)) != 1)
            throw new ApiException(404, "Building not found.");
        // Property locking keeps share totals, stock, payments and bookings atomic across API instances.
        var session = new Session(db, tx, sql, dapper, actor, property, ct);
        var result = await action(session, await session.Load());
        await tx.CommitAsync(ct); return result;
    }
    public sealed class Session(DbConnection db, DbTransaction tx, ISqlFileQueryHelper sql, IDapperHelper dapper, Actor actor, string property, CancellationToken ct)
    {
        public async Task<CommunityData> Load()
        {
            using var grid = await dapper.QueryMultipleAsync(db, new CommandDefinition(sql.GetSqlQuery("CommunityRead"),
                new { workspace = actor.WorkspaceId, property }, tx, cancellationToken: ct));
            var data = new CommunityData
            {
                Property = await grid.ReadSingleOrDefaultAsync<Property>() ?? throw new ApiException(404, "Building not found."),
                Units = (await grid.ReadAsync<PropertyUnit>()).ToList(),
                Parties = (await grid.ReadAsync<CommunityParty>()).ToList(),
                Ownerships = (await grid.ReadAsync<Ownership>()).ToList(),
                Agreements = (await grid.ReadAsync<RentalAgreement>()).ToList(),
                Charges = (await grid.ReadAsync<CommunityCharge>()).ToList(),
                Payments = (await grid.ReadAsync<CommunityPayment>()).ToList(),
                Expenses = (await grid.ReadAsync<CommunityExpense>()).ToList(),
                Sellers = (await grid.ReadAsync<CommunitySeller>()).ToList(),
                Products = (await grid.ReadAsync<CommunityProduct>()).ToList(),
                Orders = (await grid.ReadAsync<CommunityOrder>()).ToList(),
                Groups = (await grid.ReadAsync<GroupBuy>()).ToList(),
                Pledges = (await grid.ReadAsync<GroupPledge>()).ToList(),
                GateEntries = (await grid.ReadAsync<CommunityGateEntry>()).ToList(),
                Facilities = (await grid.ReadAsync<CommunityFacility>()).ToList(),
                Bookings = (await grid.ReadAsync<FacilityBooking>()).ToList(),
                Notes = (await grid.ReadAsync<CommunityNote>()).ToList(),
                Layouts = (await grid.ReadAsync<CommunityLayout>()).ToList(),
                Audit = (await grid.ReadAsync<CommunityAudit>()).ToList(),
                Receipts = (await grid.ReadAsync<CommunityReceipt>()).ToList()
            };
            var units = (await grid.ReadAsync<AgreementUnit>()).ToList();
            var allocations = (await grid.ReadAsync<ExpenseAllocation>()).ToList();
            data.Services=(await grid.ReadAsync<CommunityService>()).ToList();
            data.ServiceRequests=(await grid.ReadAsync<CommunityServiceRequest>()).ToList();
            data.Blocks=(await grid.ReadAsync<CommunityBlock>()).ToList();
            data.Layouts.AddRange(await grid.ReadAsync<CommunityLayout>());
            data.Deliveries=(await grid.ReadAsync<CommunityDelivery>()).ToList();
            foreach (var agreement in data.Agreements) agreement.UnitIds = units.Where(u => u.AgreementId == agreement.Id).Select(u => u.UnitId).ToArray();
            foreach (var expense in data.Expenses) expense.Allocations = allocations.Where(a => a.ExpenseId == expense.Id).ToList();
            return data;
        }
        public async Task<T> Insert<T>(string kind, T row, string at) where T : CommunityRow
        {
            row.WorkspaceId = actor.WorkspaceId; row.PropertyId = property; row.CreatedAt = at;
            await dapper.ExecuteAsync(db, new CommandDefinition(sql.GetSqlQuery("Community" + kind + "Insert"), row, tx, cancellationToken: ct));
            if (kind != "Audit") await Audit(row.Id, kind + ".created", at);
            return row;
        }
        public async Task<T> Update<T>(string kind, T row, long expected, string action, string at) where T : CommunityRow
        {
            if (row.Revision != expected) throw new ApiException(409, "This record changed. Refresh and try again.");
            row.Revision++;
            if (await dapper.ExecuteAsync(db, new CommandDefinition(sql.GetSqlQuery("Community" + kind + "Update"), row, tx, cancellationToken: ct)) != 1)
                throw new ApiException(409, "This record changed. Refresh and try again.");
            await Audit(row.Id, action, at); return row;
        }
        private Task<CommunityAudit> Audit(string id, string action, string at) => Insert("Audit", new CommunityAudit { UserId = actor.Id, EntityId = id, Action = action }, at);
        public Task<int> AgreementUnit(string agreement, string unit) => dapper.ExecuteAsync(db, new CommandDefinition(sql.GetSqlQuery("CommunityAgreementUnitInsert"),
            new { workspace = actor.WorkspaceId, property, agreement, unit }, tx, cancellationToken: ct));
        public Task<int> Allocation(string expense, string party, decimal amount) => dapper.ExecuteAsync(db, new CommandDefinition(sql.GetSqlQuery("CommunityAllocationInsert"),
            new { workspace = actor.WorkspaceId, property, expense, party, amount }, tx, cancellationToken: ct));
        public Task<int> UnitLocation(string unit,string block,int floor) => dapper.ExecuteAsync(db,new CommandDefinition(sql.GetSqlQuery("CommunityUnitLocation"),new{workspace=actor.WorkspaceId,property,unit,block,floor},tx,cancellationToken:ct));
        public Task<int> RegisterUnit(string label) => dapper.ExecuteAsync(db,new CommandDefinition(sql.GetSqlQuery("InsertUnit"),new{workspace=actor.WorkspaceId,property,label,id=Guid.NewGuid().ToString("N"),at=DateTimeOffset.UtcNow.ToString("O")},tx,cancellationToken:ct));
        public async Task<bool> SellerAccount(string user) => await dapper.ExecuteScalarAsync<int>(db,new CommandDefinition(sql.GetSqlQuery("CommunitySellerAccount"),new{workspace=actor.WorkspaceId,user,property},tx,cancellationToken:ct))==1;
    }
}
