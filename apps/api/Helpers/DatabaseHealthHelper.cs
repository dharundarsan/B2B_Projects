using Dapper;
namespace RepairLedger.Api.Helpers;

public sealed class DatabaseHealthHelper(IConnectionHelper connection, ISqlFileQueryHelper sql, IDapperHelper dapper)
{
    public async Task<int> GetVersion(CancellationToken ct)
    {
        await using var db = await connection.Open(ct);
        return await dapper.ExecuteScalarAsync<int>(db, new CommandDefinition(sql.GetSqlQuery("SchemaVersion"), cancellationToken: ct));
    }
}
