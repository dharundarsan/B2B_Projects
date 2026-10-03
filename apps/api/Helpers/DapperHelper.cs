using System.Data.Common;
using Dapper;
namespace RepairLedger.Api.Helpers;

/// <summary>Bound parameters, async cancellation and a finite timeout on every SQL command.</summary>
public sealed class DapperHelper : IDapperHelper
{
    private readonly int timeout;
    public DapperHelper(IConfiguration configuration)
    {
        timeout = configuration.GetValue("Database:CommandTimeoutSeconds", 30);
        if (timeout is < 1 or > 120) throw new InvalidOperationException("SQL command timeout must be 1–120 seconds.");
    }
    private CommandDefinition Configure(CommandDefinition c) => new(c.CommandText, c.Parameters, c.Transaction,
        c.CommandTimeout ?? timeout, c.CommandType, c.Flags, c.CancellationToken);
    public Task<int> ExecuteAsync(DbConnection db, CommandDefinition c) => db.ExecuteAsync(Configure(c));
    public Task<T?> ExecuteScalarAsync<T>(DbConnection db, CommandDefinition c) => db.ExecuteScalarAsync<T>(Configure(c));
    public Task<IEnumerable<T>> QueryAsync<T>(DbConnection db, CommandDefinition c) => db.QueryAsync<T>(Configure(c));
    public Task<T> QuerySingleAsync<T>(DbConnection db, CommandDefinition c) => db.QuerySingleAsync<T>(Configure(c));
    public Task<SqlMapper.GridReader> QueryMultipleAsync(DbConnection db, CommandDefinition c) => db.QueryMultipleAsync(Configure(c));
}
