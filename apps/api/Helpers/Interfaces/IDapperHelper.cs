using System.Data.Common;
using Dapper;
namespace RepairLedger.Api.Helpers.Interfaces;

public interface IDapperHelper
{
    Task<int> ExecuteAsync(DbConnection db, CommandDefinition command);
    Task<T?> ExecuteScalarAsync<T>(DbConnection db, CommandDefinition command);
    Task<IEnumerable<T>> QueryAsync<T>(DbConnection db, CommandDefinition command);
    Task<T> QuerySingleAsync<T>(DbConnection db, CommandDefinition command);
    Task<SqlMapper.GridReader> QueryMultipleAsync(DbConnection db, CommandDefinition command);
}
