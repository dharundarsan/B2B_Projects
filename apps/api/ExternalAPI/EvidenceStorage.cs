using System.Net;
using System.Net.Http.Headers;
using System.Text.Json.Nodes;
using RepairLedger.Api.Models;

namespace RepairLedger.Api.ExternalAPI;

public sealed class EvidenceStorage(HttpClient client, IConfiguration configuration)
{
    public static readonly HashSet<string> ContentTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/quicktime", "application/pdf"];
    private string BaseUrl => (configuration["Supabase:Url"] ?? "").TrimEnd('/');
    private string Bucket => Uri.EscapeDataString(configuration["Supabase:EvidenceBucket"] ?? "repair-evidence");
    private static string EscapePath(string path) => string.Join('/', path.Split('/').Select(Uri.EscapeDataString));
    private async Task<JsonNode> Call(string path, object body, CancellationToken ct)
    {
        var key = configuration["Supabase:ServiceRoleKey"];
        if (string.IsNullOrWhiteSpace(BaseUrl) || string.IsNullOrWhiteSpace(key)) throw new ApiException(503, "Configure Supabase private evidence storage before uploading files.");
        using var request = new HttpRequestMessage(HttpMethod.Post, BaseUrl + "/storage/v1/" + path) { Content = JsonContent.Create(body) };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key); request.Headers.Add("apikey", key);
        using var response = await client.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode) throw new ApiException(502, "Evidence storage rejected the request. Retry or contact the workspace administrator.");
        return await response.Content.ReadFromJsonAsync<JsonNode>(ct) ?? throw new ApiException(502, "Invalid storage response.");
    }
    public async Task<(string Url, string Token)> Upload(string path, CancellationToken ct)
    {
        var response = await Call($"object/upload/sign/{Bucket}/{EscapePath(path)}", new { }, ct);
        var url = response["url"]?.GetValue<string>() ?? throw new ApiException(502, "No upload URL returned.");
        var token = new Uri(BaseUrl + "/storage/v1" + url).Query.TrimStart('?').Split('&').Single(x => x.StartsWith("token=", StringComparison.Ordinal))[6..];
        return (BaseUrl + "/storage/v1" + url, Uri.UnescapeDataString(token));
    }
    public async Task<string> Download(string path, CancellationToken ct)
    {
        var response = await Call($"object/sign/{Bucket}/{EscapePath(path)}", new { expiresIn = 900 }, ct);
        return BaseUrl + "/storage/v1" + response["signedURL"]!.GetValue<string>();
    }
    public async Task Verify(Evidence evidence, CancellationToken ct)
    {
        var separator = evidence.Path.LastIndexOf('/');
        var files = await Call($"object/list/{Bucket}", new { prefix = evidence.Path[..separator], search = evidence.Path[(separator + 1)..], limit = 100, offset = 0 }, ct);
        var file = files.AsArray().SingleOrDefault(x => x?["name"]?.GetValue<string>() == evidence.Path[(separator + 1)..]);
        if (file == null) throw new ApiException(409, "File upload is not complete.");
        var metadata = file["metadata"];
        if (metadata?["size"]?.GetValue<long>() != evidence.Size || metadata?["mimetype"]?.GetValue<string>() != evidence.ContentType)
            throw new ApiException(409, "Uploaded file does not match the declared size and content type.");
    }
}
