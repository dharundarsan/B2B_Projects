using System.Data.Common;
using Dapper;
using Microsoft.Data.Sqlite;
using MySqlConnector;
using RepairLedger.Api.Enums;
namespace RepairLedger.Api.Helpers;

/// <summary>Owns the pool, not a shared open connection. A connection belongs to one DAL operation.</summary>
public sealed class DbConnectionHelper : IConnectionHelper, IAsyncDisposable
{
    private readonly string connectionString;
    private readonly MySqlDataSource? dataSource;
    public DatabaseConnectionType Provider { get; }
    static DbConnectionHelper()
    {
        DefaultTypeMap.MatchNamesWithUnderscores = true;
        SqlMapper.AddTypeHandler(new DecimalHandler());
    }
    public DbConnectionHelper(IConfiguration configuration, IWebHostEnvironment environment)
    {
        if (!Enum.TryParse<DatabaseConnectionType>(configuration["Database:Provider"], true, out var provider) || !Enum.IsDefined(provider))
            throw new InvalidOperationException("Database:Provider must be MySql or Sqlite. PostgreSQL is no longer supported.");
        Provider = provider;
        connectionString = configuration["Database:ConnectionString"] ?? "";
        if (string.IsNullOrWhiteSpace(connectionString)) throw new InvalidOperationException("Database:ConnectionString is required. Configure your MySQL credentials in appsettings.Local.json or environment variables.");
        if (!environment.IsDevelopment() && Provider != DatabaseConnectionType.MySql) throw new InvalidOperationException("Production requires MySQL.");
        if (Provider == DatabaseConnectionType.MySql)
        {
            var options = new MySqlConnectionStringBuilder(connectionString)
            {
                Pooling = true, ConnectionReset = true, UseAffectedRows = false,
                AllowUserVariables = false, AllowLoadLocalInfile = false
            };
            if (string.IsNullOrWhiteSpace(options.Database)) throw new InvalidOperationException("Select a dedicated MySQL database in Database:ConnectionString.");
            if (!environment.IsDevelopment() && options.SslMode != MySqlSslMode.VerifyFull)
                throw new InvalidOperationException("Production MySQL requires SslMode=VerifyFull.");
            connectionString = options.ConnectionString;
            dataSource = new MySqlDataSourceBuilder(connectionString).Build();
        }
        else connectionString = new SqliteConnectionStringBuilder(connectionString) { ForeignKeys = true }.ToString();
    }
    public async Task<DbConnection> Open(CancellationToken ct)
    {
        DbConnection connection = Provider == DatabaseConnectionType.Sqlite ? new SqliteConnection(connectionString) : dataSource!.CreateConnection();
        // SQLite's built-in LOWER is ASCII-only; keep literal search consistent with the API's Unicode case folding.
        if (connection is SqliteConnection sqlite)
            sqlite.CreateFunction<string?, string?>("lower", value => value?.ToLowerInvariant(), isDeterministic: true);
        try { await connection.OpenAsync(ct); return connection; }
        catch { await connection.DisposeAsync(); throw; }
    }
    public async ValueTask DisposeAsync() { if (dataSource != null) await dataSource.DisposeAsync(); }
    // SQLite NUMERIC affinity may return Int64/Double; MySQL uses exact DECIMAL.
    private sealed class DecimalHandler : SqlMapper.TypeHandler<decimal>
    {
        public override decimal Parse(object value) => Convert.ToDecimal(value, System.Globalization.CultureInfo.InvariantCulture);
        public override void SetValue(System.Data.IDbDataParameter parameter, decimal value)
        { parameter.DbType = System.Data.DbType.Decimal; parameter.Value = value; }
    }
}
