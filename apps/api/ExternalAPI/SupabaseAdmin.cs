using System.Net;
using System.Net.Http.Headers;
using System.Text.Json.Nodes;
namespace RepairLedger.Api.ExternalAPI;

public sealed class SupabaseAdmin(HttpClient client,IConfiguration config,IWebHostEnvironment environment)
{
    private HttpRequestMessage Request(HttpMethod method,string path)
    {
        var url=config["Supabase:Url"];var key=config["Supabase:ServiceRoleKey"];
        if(string.IsNullOrWhiteSpace(url)||string.IsNullOrWhiteSpace(key))throw new ApiException(503,"Configure backend Supabase account administration to create users.");
        var request=new HttpRequestMessage(method,url.TrimEnd('/')+"/auth/v1/"+path);
        request.Headers.Authorization=new AuthenticationHeaderValue("Bearer",key);request.Headers.Add("apikey",key);return request;
    }
    public async Task<string> Create(Actor actor,ManagedUserInput input,CancellationToken ct)
    {
        if(environment.IsDevelopment()&&config.GetValue<bool>("Demo:Enabled")&&actor.IsDemo)return Guid.NewGuid().ToString();
        using var request=Request(HttpMethod.Post,"admin/users");
        request.Content=JsonContent.Create(new{email=input.Email,password=input.Password,email_confirm=true,
            user_metadata=new{display_name=input.DisplayName},app_metadata=new{role=input.Role,workspace_id=actor.WorkspaceId}});
        using var response=await client.SendAsync(request,ct);
        if(response.StatusCode is HttpStatusCode.Conflict or HttpStatusCode.UnprocessableEntity or HttpStatusCode.BadRequest)throw new ApiException(409,"Account creation was rejected. Check the email and refresh the user list before retrying.");
        if(!response.IsSuccessStatusCode)throw new ApiException(503,"Account service unavailable. No local account was created.");
        var user=await response.Content.ReadFromJsonAsync<JsonObject>(ct);
        var id=user?["id"]?.GetValue<string>()??user?["user"]?["id"]?.GetValue<string>();
        if(!Guid.TryParse(id,out _))throw new ApiException(502,"Account service returned an invalid account ID.");
        return id!;
    }
    // Only a newly created account is compensated if its local transaction fails.
    public async Task RemoveNewAccount(Actor actor,string id)
    {
        if(environment.IsDevelopment()&&config.GetValue<bool>("Demo:Enabled")&&actor.IsDemo)return;
        using var request=Request(HttpMethod.Delete,"admin/users/"+Uri.EscapeDataString(id));
        using var response=await client.SendAsync(request,CancellationToken.None);
        if(!response.IsSuccessStatusCode)throw new ApiException(503,"The account was created in Auth but local setup failed. An administrator must reconcile it before retrying.");
    }
}
