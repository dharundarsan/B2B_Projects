using RepairLedger.Api.ExternalAPI;
namespace RepairLedger.Api.Middleware;

public sealed class ActorMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, SupabaseIdentity identity)
    {
        if (context.Request.Path.StartsWithSegments("/api") && context.Request.Path != "/api/health" && context.Request.Path != "/api/health/ready")
            context.Items["actor"] = await identity.Authenticate(context);
        await next(context);
    }
}
