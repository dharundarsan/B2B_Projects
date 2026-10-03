using System.Data.Common;
using RepairLedger.Api.Enums;
namespace RepairLedger.Api.Helpers.Interfaces;

public interface IConnectionHelper
{
    DatabaseConnectionType Provider { get; }
    Task<DbConnection> Open(CancellationToken ct);
}
