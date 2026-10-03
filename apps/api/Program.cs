using RepairLedger.Api.Extensions;
using RepairLedger.Api.Helpers;
using RepairLedger.Api.Middleware;

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true).AddEnvironmentVariables().AddCommandLine(args);
StartupHelper.ConfigureCommandOptions(builder.Configuration);
builder.Services.InstallServicesInAssembly(builder.Configuration);

var app = builder.Build();
if (await StartupHelper.Initialize(app, CancellationToken.None)) return;
app.UseMiddleware<ExceptionMiddleware>();
app.UseCors();
// Invalid-token attempts are rate-limited before contacting Supabase.
app.UseRateLimiter();
app.UseMiddleware<ActorMiddleware>();
if (app.Environment.IsDevelopment()) app.MapOpenApi();
app.MapControllers();
await app.RunAsync();

public partial class Program;
