using System.Net;
using System.Net.Http.Headers;
using System.Text.Json.Nodes;
using RepairLedger.Api.Models;

namespace RepairLedger.Api.ExternalAPI;

public sealed class SupabaseIdentity(HttpClient client, IConfiguration configuration, IWebHostEnvironment environment)
{
    public async Task<Actor> Authenticate(HttpContext context)
    {
        if (environment.IsDevelopment() && configuration.GetValue<bool>("Demo:Enabled"))
            return new Actor("demo-owner", "demo-workspace", "demo", "demo@repairledger.local", null, []);
        var header = context.Request.Headers.Authorization.ToString();
        if (!header.StartsWith("Bearer ", StringComparison.Ordinal) || header.Length > 10000) throw new ApiException(401, "Sign in to access this workspace.");
        var url = configuration["Supabase:Url"];
        var key = configuration["Supabase:PublicKey"];
        if (string.IsNullOrWhiteSpace(url) || string.IsNullOrWhiteSpace(key)) throw new ApiException(503, "Authentication is not configured.");
        using var request = new HttpRequestMessage(HttpMethod.Get, url.TrimEnd('/') + "/auth/v1/user");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", header[7..]);
        request.Headers.Add("apikey", key);
        // Auth's user endpoint validates both legacy and asymmetric Supabase JWTs. Never decode unverified tokens.
        using var response = await client.SendAsync(request, context.RequestAborted);
        if (response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden) throw new ApiException(401, "Your session is invalid or expired.");
        if (!response.IsSuccessStatusCode) throw new ApiException(503, "Authentication service unavailable.");
        var user = await response.Content.ReadFromJsonAsync<JsonObject>(context.RequestAborted) ?? throw new ApiException(401, "Invalid session.");
        var id = user["id"]?.GetValue<string>() ?? throw new ApiException(401, "Invalid session.");
        var metadata = user["app_metadata"] as JsonObject ?? [];
        var role = metadata["role"]?.GetValue<string>() ?? "owner";
        if (role is not ("owner" or "manager" or "tenant" or "vendor" or "watchman")) throw new ApiException(403, "Account role is not supported.");
        var workspace = metadata["workspace_id"]?.GetValue<string>() ?? id;
        var units = new Dictionary<string, string[]>();
        var propertyIds = (metadata["property_ids"] as JsonArray)?.Select(x => x?.GetValue<string>()).ToHashSet();
        if (metadata["property_units"] is JsonObject properties)
            foreach (var (property, assignedUnits) in properties)
                if (assignedUnits is JsonArray array && propertyIds?.Contains(property) == true)
                    units[property] = array.OfType<JsonValue>().Select(x => x.GetValue<string>()).ToArray();
        return new Actor(id, workspace, role, user["email"]?.GetValue<string>() ?? id, metadata["vendor_id"]?.GetValue<string>(), units,
            propertyIds?.OfType<string>().Where(x => !string.IsNullOrWhiteSpace(x)).ToArray() ?? []);
    }
}
