using Microsoft.AspNetCore.Mvc;
namespace RepairLedger.Api.Controllers;

[ApiController]
public abstract class RepairLedgerController(Actor actor) : ControllerBase
{
    protected Actor Actor => actor;
    protected static object Data<T>(T data) => new { data };
    protected long? Revision()
    {
        var raw = Request.Headers.IfMatch.ToString().Trim('"');
        if (raw.Length == 0) return null;
        if (!long.TryParse(raw, out var revision) || revision < 0) throw new ApiException(400, "If-Match must contain the numeric repair revision.");
        return revision;
    }
}
