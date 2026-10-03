using Microsoft.Data.Sqlite;
using MySqlConnector;
namespace RepairLedger.Api.Middleware;

public sealed class ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        context.Response.Headers.XContentTypeOptions = "nosniff";
        context.Response.Headers.CacheControl = "no-store";
        try { await next(context); }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested) { }
        catch (Exception exception)
        {
            if (context.Response.HasStarted) throw;
            var (status, message) = exception switch
            {
                ApiException error => (error.Status, error.Message),
                BadHttpRequestException => (400, "Invalid request body."),
                System.Text.Json.JsonException => (400, "Invalid JSON request body."),
                SqliteException { SqliteErrorCode: 5 or 6 } => (409, "Another operation is updating this repair. Refresh and retry."),
                MySqlException { Number: 1205 or 1213 } => (409, "Concurrent update. Refresh and retry."),
                MySqlException { Number: 1062 or 1451 or 1452 or 3819 } => (409, "Record changed or conflicts with an existing record."),
                SqliteException { SqliteErrorCode: 19 } => (409, "Record changed or conflicts with an existing record."),
                MySqlException or SqliteException => (503, "Database unavailable. Retry shortly."),
                HttpRequestException or TaskCanceledException => (503, "An external service is unavailable. Retry shortly."),
                _ => (500, "An unexpected error occurred.")
            };
            if (status >= 500) logger.LogError(exception, "Request failed {TraceId}", context.TraceIdentifier);
            context.Response.StatusCode = status;
            await context.Response.WriteAsJsonAsync(new { message, traceId = context.TraceIdentifier }, context.RequestAborted);
        }

    }
}
