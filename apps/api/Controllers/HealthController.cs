using Microsoft.AspNetCore.Mvc;
using RepairLedger.Api.Helpers;
namespace RepairLedger.Api.Controllers;

[ApiController, Route("api/health")]
public sealed class HealthController(DatabaseHealthHelper health) : ControllerBase
{
    [HttpGet] public object Health() => new { ok = true, service = "repairledger-api", timestamp = DateTimeOffset.UtcNow };
    [HttpGet("ready")]
    public async Task<IActionResult> Ready(CancellationToken ct)
    {
        var version = await health.GetVersion(ct);
        return version == DatabaseMigrationHelper.CurrentVersion ? Ok(new { ok = true, schemaVersion = version })
            : StatusCode(503, new { message = "Database migrations are required." });
    }
}
