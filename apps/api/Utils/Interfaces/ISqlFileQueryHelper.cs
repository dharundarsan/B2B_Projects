namespace RepairLedger.Api.Utils.Interfaces;

/// <summary>Names are server-owned resource identifiers, never request input.</summary>
public interface ISqlFileQueryHelper
{
    string GetSqlQuery(string fileName);
    string ReadResource(string resourceName);
    Task<T> ExecuteQuery<T>(string fileName, Func<string, Task<T>> execute);
}
