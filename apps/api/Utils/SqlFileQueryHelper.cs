using System.Collections.Concurrent;
using System.Reflection;
using RepairLedger.Api.Extensions;
namespace RepairLedger.Api.Utils;

/// <summary>Reference-style embedded SQL with thread-safe, lazy resource caching.</summary>
public sealed class SqlFileQueryHelper(IConnectionHelper connection) : ISqlFileQueryHelper
{
    private static readonly ConcurrentDictionary<string, Lazy<string>> Cache = new(StringComparer.Ordinal);
    private static readonly Assembly Assembly = typeof(SqlFileQueryHelper).Assembly;
    private static readonly HashSet<string> Resources = Assembly.GetManifestResourceNames().ToHashSet(StringComparer.Ordinal);
    public string ReadResource(string name) => Cache.GetOrAdd(name, static key =>
        new Lazy<string>(() => Assembly.ReadResource(key), LazyThreadSafetyMode.ExecutionAndPublication)).Value;

    public string GetSqlQuery(string fileName)
    {
        if (fileName.Length == 0 || fileName.Any(c => !char.IsAsciiLetterOrDigit(c) && c != '_'))
            throw new ArgumentException("SQL file names must be server-owned identifiers.", nameof(fileName));
        var providerResource = $"RepairLedger.Api.SQLFiles.{connection.Provider}.{fileName}.sql";
        return ReadResource(Resources.Contains(providerResource) ? providerResource : $"RepairLedger.Api.SQLFiles.Common.{fileName}.sql");
    }
    public Task<T> ExecuteQuery<T>(string fileName, Func<string, Task<T>> execute) => execute(GetSqlQuery(fileName));
}
