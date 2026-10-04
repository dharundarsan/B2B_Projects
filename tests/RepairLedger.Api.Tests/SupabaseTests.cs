using System.Net;
using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using RepairLedger.Api.Models;
using RepairLedger.Api.ExternalAPI;
using RepairLedger.Api.Errors;
using RepairLedger.Api.Business;
using RepairLedger.Api.DataAccess;
using RepairLedger.Api.Helpers;
using RepairLedger.Api.Utils;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace RepairLedger.Api.Tests;

public sealed class SupabaseTests
{
    private static ConfigurationManager Config()
    {
        var c = new ConfigurationManager(); c["Supabase:Url"] = "https://example.supabase.co";
        c["Supabase:PublicKey"] = "test-public"; c["Supabase:ServiceRoleKey"] = "test-private"; return c;
    }
    private sealed class Handler(string body, HttpStatusCode status = HttpStatusCode.OK) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            => Task.FromResult(new HttpResponseMessage(status) { Content = new StringContent(body, Encoding.UTF8, "application/json") });
    }
    private static DefaultHttpContext Context(bool signed = true)
    {
        var c = new DefaultHttpContext(); if (signed) c.Request.Headers.Authorization = "Bearer test-token"; return c;
    }
    [Fact]
    public async Task Authentication_never_trusts_editable_user_metadata()
    {
        using var client = new HttpClient(new Handler("""
            {"id":"resident-id","email":"resident@example.com","user_metadata":{"role":"owner","workspace_id":"stolen"},"app_metadata":{"role":"tenant","workspace_id":"real","property_ids":["allowed"],"property_units":{"allowed":["3B"],"not-allowed":["ALL"]}}}
            """));
        var identity = new SupabaseIdentity(client, Config(), new WorkflowTests.TestEnvironment { EnvironmentName = "Production" });
        var actor = await identity.Authenticate(Context()); Assert.Equal("tenant", actor.Role); Assert.Equal("real", actor.WorkspaceId);
        Assert.Single(actor.PropertyUnits); Assert.Equal("3B", actor.PropertyUnits["allowed"].Single()); Assert.False(actor.IsManager);
    }
    [Fact]
    public async Task Missing_role_metadata_never_creates_an_administrator()
    {
        using var client=new HttpClient(new Handler("""{"id":"unassigned","email":"new@example.test","user_metadata":{"role":"owner"}}"""));
        var actor=await new SupabaseIdentity(client,Config(),new WorkflowTests.TestEnvironment{EnvironmentName="Production"}).Authenticate(Context());
        Assert.Equal("member",actor.Role);Assert.False(actor.IsManager);Assert.Empty(actor.PropertyUnits);
    }
    private sealed class AdminHandler:HttpMessageHandler
    {
        public string? Payload;public string? Authorization;public string? Path;
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken ct)
        {
            Payload=await request.Content!.ReadAsStringAsync(ct);Authorization=request.Headers.Authorization?.ToString();Path=request.RequestUri!.AbsolutePath;
            return new(HttpStatusCode.OK){Content=new StringContent("""{"id":"12345678-1234-4234-8234-123456789abc"}""",Encoding.UTF8,"application/json")};
        }
    }
    [Fact]
    public async Task Account_creation_uses_server_auth_admin_and_trusted_workspace_metadata_without_invitation_email()
    {
        var handler=new AdminHandler();using var client=new HttpClient(handler);
        var actor=new Actor("admin","real-workspace","manager","admin@example.test",null,[]);
        var input=new ManagedUserInput("New member","new@example.test","member",true,false,true,1,[],"test-password-123");
        var id=await new SupabaseAdmin(client,Config(),new WorkflowTests.TestEnvironment{EnvironmentName="Production"}).Create(actor,input,default);
        Assert.Equal("12345678-1234-4234-8234-123456789abc",id);Assert.Equal("/auth/v1/admin/users",handler.Path);Assert.Equal("Bearer test-private",handler.Authorization);
        var body=System.Text.Json.Nodes.JsonNode.Parse(handler.Payload!);Assert.Equal("member",body!["app_metadata"]!["role"]!.GetValue<string>());Assert.Equal(actor.WorkspaceId,body["app_metadata"]!["workspace_id"]!.GetValue<string>());
        Assert.True(body["email_confirm"]!.GetValue<bool>());Assert.DoesNotContain("invite",handler.Path!);
    }
    [Fact]
    public async Task Watchman_buildings_come_only_from_verified_app_metadata()
    {
        using var client = new HttpClient(new Handler("""
            {"id":"guard","email":"guard@example.test","user_metadata":{"role":"owner","property_ids":["stolen"]},"app_metadata":{"role":"watchman","workspace_id":"real","property_ids":["p1"],"property_units":{"stolen":["ALL"]}}}
            """));
        var actor = await new SupabaseIdentity(client, Config(), new WorkflowTests.TestEnvironment { EnvironmentName = "Production" }).Authenticate(Context());
        Assert.Equal("watchman", actor.Role); Assert.Equal("p1", Assert.Single(actor.MobilePropertyIds)); Assert.False(actor.IsManager);
        Assert.Empty(actor.PropertyUnits); Assert.Equal(403, Assert.Throws<ApiException>(actor.RequireResident).Status);
    }
    [Fact]
    public async Task Missing_or_expired_tokens_are_rejected()
    {
        using var client = new HttpClient(new Handler("{}", HttpStatusCode.Unauthorized));
        var identity = new SupabaseIdentity(client, Config(), new WorkflowTests.TestEnvironment { EnvironmentName = "Production" });
        Assert.Equal(401, (await Assert.ThrowsAsync<ApiException>(() => identity.Authenticate(Context(false)))).Status);
        Assert.Equal(401, (await Assert.ThrowsAsync<ApiException>(() => identity.Authenticate(Context()))).Status);
    }
    [Fact]
    public async Task Production_never_uses_demo_identity_even_if_setting_is_true()
    {
        var config = Config(); config["Demo:Enabled"] = "true";
        using var client = new HttpClient(new Handler("{}", HttpStatusCode.Unauthorized));
        var identity = new SupabaseIdentity(client, config, new WorkflowTests.TestEnvironment { EnvironmentName = "Production" });
        Assert.Equal(401, (await Assert.ThrowsAsync<ApiException>(() => identity.Authenticate(Context(false)))).Status);
    }
    [Fact]
    public async Task Evidence_completion_checks_size_and_mime_before_marking_uploaded()
    {
        var evidence = new Evidence { Path = "workspace/request/file", Name = "photo.png", Size = 100, ContentType = "image/png" };
        using var good = new HttpClient(new Handler("""[{"name":"file","metadata":{"size":100,"mimetype":"image/png"}}]"""));
        await new EvidenceStorage(good, Config()).Verify(evidence, default);
        using var bad = new HttpClient(new Handler("""[{"name":"file","metadata":{"size":999,"mimetype":"image/png"}}]"""));
        Assert.Equal(409, (await Assert.ThrowsAsync<ApiException>(() => new EvidenceStorage(bad, Config()).Verify(evidence, default))).Status);
    }
}
