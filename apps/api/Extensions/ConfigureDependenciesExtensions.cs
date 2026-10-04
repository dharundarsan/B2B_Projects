using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using RepairLedger.Api.DataAccess;
using RepairLedger.Api.ExternalAPI;
using RepairLedger.Api.Helpers;
using RepairLedger.Api.Utils;
namespace RepairLedger.Api.Extensions;

public static class ConfigureDependenciesExtensions
{
    public static void ConfigureDependencyInjections(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddSingleton<IConnectionHelper, DbConnectionHelper>();
        services.AddSingleton<ISqlFileQueryHelper, SqlFileQueryHelper>();
        services.AddSingleton<IDapperHelper, DapperHelper>();
        services.AddSingleton<DatabaseMigrationHelper>();
        services.AddSingleton<DatabaseHealthHelper>();
        services.AddSingleton<DatabasePreflightHelper>();
        services.AddScoped<IRepairDAL, RepairDAL>();
        services.AddScoped<IRepairBL, RepairBL>();
        services.AddScoped<IMobileDAL, MobileDAL>();
        services.AddScoped<IMobileBL, MobileBL>();
        services.AddScoped<CommunityDAL>();
        services.AddScoped<CommunityBL>();
        services.AddScoped<UserDAL>();
        services.AddScoped<UserManagementBL>();
        services.AddSingleton(TimeProvider.System);
        services.AddScoped<IEvidenceBL, EvidenceBL>();
        services.AddHttpClient<SupabaseIdentity>(client => client.Timeout = TimeSpan.FromSeconds(10));
        services.AddHttpClient<SupabaseAdmin>(client => client.Timeout = TimeSpan.FromSeconds(20));
        services.AddHttpClient<EvidenceStorage>(client => client.Timeout = TimeSpan.FromSeconds(20));
        services.AddHttpContextAccessor();
        services.AddScoped<Actor>(provider => provider.GetRequiredService<IHttpContextAccessor>().HttpContext?.Items["actor"] as Actor
            ?? throw new ApiException(401, "Sign in to access this workspace."));
        services.AddOpenApi();
        services.Configure<Microsoft.AspNetCore.Server.Kestrel.Core.KestrelServerOptions>(options => options.Limits.MaxRequestBodySize = 64 * 1024);
        services.AddControllers().AddJsonOptions(options => options.JsonSerializerOptions.DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull);
        services.Configure<Microsoft.AspNetCore.Mvc.ApiBehaviorOptions>(options => options.InvalidModelStateResponseFactory = context =>
            new Microsoft.AspNetCore.Mvc.BadRequestObjectResult(new
            {
                message = "Invalid request body.",
                traceId = context.HttpContext.TraceIdentifier,
                errors = context.ModelState.Where(x => x.Value?.Errors.Count > 0).ToDictionary(x => x.Key, x => x.Value!.Errors.Select(e => string.IsNullOrEmpty(e.ErrorMessage) ? "Invalid value." : e.ErrorMessage).ToArray())
            }));
        var origins = configuration.GetSection("Cors:Origins").Get<string[]>() ?? [];
        services.AddCors(options => options.AddDefaultPolicy(policy => policy.WithOrigins(origins).WithHeaders("Content-Type", "Authorization", "If-Match").WithMethods("GET", "POST", "PATCH", "DELETE").WithExposedHeaders("ETag")));
        services.AddRateLimiter(options =>
        {
            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
                RateLimitPartition.GetFixedWindowLimiter(context.Items["actor"] is Actor a ? a.Id : context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                    _ => new FixedWindowRateLimiterOptions { PermitLimit = 120, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
            options.OnRejected = async (context, ct) => { context.HttpContext.Response.StatusCode = 429; context.HttpContext.Response.Headers.RetryAfter = "60"; await context.HttpContext.Response.WriteAsJsonAsync(new { message = "Too many requests. Retry in a minute." }, ct); };
        });

    }
}
