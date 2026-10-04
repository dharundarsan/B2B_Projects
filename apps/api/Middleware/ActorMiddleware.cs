using RepairLedger.Api.ExternalAPI;
using RepairLedger.Api.DataAccess;
namespace RepairLedger.Api.Middleware;

public sealed class ActorMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, SupabaseIdentity identity, UserDAL users)
    {
        if (context.Request.Path.StartsWithSegments("/api") && context.Request.Path != "/api/health" && context.Request.Path != "/api/health/ready")
        {
            var actor = await identity.Authenticate(context);
            context.Items["actor"] = await users.Resolve(actor, context.RequestAborted);
        }
        await next(context);
    }
}
