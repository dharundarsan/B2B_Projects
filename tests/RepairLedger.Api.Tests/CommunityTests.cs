using Dapper;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using RepairLedger.Api.Business;
using RepairLedger.Api.DataAccess;
using RepairLedger.Api.Errors;
using RepairLedger.Api.ExternalAPI;
using RepairLedger.Api.Helpers;
using RepairLedger.Api.Models;
using RepairLedger.Api.Models.Inputs;
using RepairLedger.Api.Utils;
using Xunit;
namespace RepairLedger.Api.Tests;

public sealed partial class CommunityTests : IAsyncLifetime
{
    private readonly string? mysql=Environment.GetEnvironmentVariable("REPAIRLEDGER_TEST_MYSQL");
    private readonly string schema="rl_test_"+Guid.NewGuid().ToString("N");
    private readonly string path=Path.Combine(Path.GetTempPath(),"community-"+Guid.NewGuid().ToString("N")+".db");
    private DbConnectionHelper database=null!;
    private CommunityBL business=null!;
    private CommunityDAL repository=null!;
    private RepairDAL repairs=null!;
    private UserDAL users=null!;
    private readonly TestClock clock=new();
    private static readonly Actor Admin=new("11111111-1111-4111-8111-111111111111","w","owner","admin@test.local",null,[]);
    private static readonly Actor Operator=new("22222222-2222-4222-8222-222222222222","w","operator","operator@test.local",null,[]);
    private static readonly Actor Owner=new("33333333-3333-4333-8333-333333333333","w","unit_owner","owner@test.local",null,[]);
    private static readonly Actor Resident=new("44444444-4444-4444-8444-444444444444","w","tenant","resident@test.local",null,new(){["p"]=["101"]},
        ResidentOccupancies:[new("55555555-5555-4555-8555-555555555555","p","101",DateTimeOffset.UtcNow.AddYears(-1),null)]);
    private static readonly Actor Guard=new("66666666-6666-4666-8666-666666666666","w","watchman","guard@test.local",null,[],["p"]);
    private static Actor BuyerAdmin => Admin with {UserContext=1};
    private static Actor SellerResident => Resident with {UserContext=3,SellerAccess=true};
    private CommunityParty owner=null!,op=null!,resident=null!;
    private PropertyUnit unit=null!;
    public async Task InitializeAsync()
    {
        try
        {
            var config=new ConfigurationManager{["Database:Provider"]=mysql==null?"Sqlite":"MySql",["Database:AutoMigrate"]="true"};
            if(mysql!=null) { await using var setup=new MySqlConnector.MySqlConnection(mysql); await setup.OpenAsync(); await setup.ExecuteAsync($"CREATE DATABASE {schema} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs"); }
            config["Database:ConnectionString"]=mysql==null?$"Data Source={path};Foreign Keys=True;Default Timeout=15":new MySqlConnector.MySqlConnectionStringBuilder(mysql){Database=schema}.ConnectionString;
            database=new(config,new WorkflowTests.TestEnvironment()); var sql=new SqlFileQueryHelper(database); var dapper=new DapperHelper(config);
            await new DatabaseMigrationHelper(database,sql,dapper,config,NullLogger<DatabaseMigrationHelper>.Instance).Initialize(default);
            repairs=new(database,sql,dapper); repository=new(database,sql,dapper); business=new(repository,clock,new EvidenceStorage(new HttpClient(),config)); users=new(database,sql,dapper);
            foreach(var id in new[]{"p","other"}) await repairs.SaveProperty(Admin,new Property{Id=id,Name=id,Address="Test",Units=10,Timezone="UTC"},true,default);
            unit=await repairs.AddUnit(Admin,"p","101",default);
            owner=await business.Party(Admin,"p",new("Owner","person",Owner.Id),default);
            op=await business.Party(Admin,"p",new("Operator","person",Operator.Id),default);
            resident=await business.Party(Admin,"p",new("Resident","person",Resident.Id),default);
        }
        catch { await DisposeAsync(); throw; }
    }
    public async Task DisposeAsync()
    {
        if(database!=null) await database.DisposeAsync(); Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
        if(mysql!=null) { if(!System.Text.RegularExpressions.Regex.IsMatch(schema,"^rl_test_[a-f0-9]{32}$")) throw new InvalidOperationException(); await using var db=new MySqlConnector.MySqlConnection(mysql); await db.OpenAsync(); await db.ExecuteAsync($"DROP DATABASE IF EXISTS {schema}"); }
        foreach(var suffix in new[]{"","-wal","-shm"}) if(File.Exists(path+suffix)) File.Delete(path+suffix);
    }
    private string Start=>clock.GetUtcNow().AddMonths(-1).ToString("yyyy-MM")+"-01";
    private string End=>clock.GetUtcNow().AddYears(1).ToString("yyyy-MM")+"-01";
    private string Month=>clock.GetUtcNow().ToString("yyyy-MM");
    private Task<Ownership> Own(decimal share=100,decimal income=100,decimal expense=100,string? party=null)=>business.Ownership(Admin,"p",new(unit.Id,party??owner.Id,share,income,expense,Start,null),default);
    private async Task<(RentalAgreement Master,RentalAgreement Sub)> Lease()
    {
        await Own(); var master=await business.Agreement(Admin,"p",new("master",op.Id,owner.Id,null,null,[unit.Id],Start,End,10000,20000,"INR",5),default);
        var sub=await business.Agreement(Operator,"p",new("sublease",resident.Id,op.Id,master.Id,Resident.ActiveResidentOccupancies.Single().Id,[unit.Id],Start,End,14000,25000,"INR",3),default); return(master,sub);
    }
    private async Task<CommunityProduct> Item(int stock=10)
    {
        var seller=await business.Seller(SellerResident,"p",new("Home kitchen","resident","Lobby",null),default);
        seller=await business.SellerAction(Admin,"p",seller.Id,new("approve",seller.Revision),default);
        return await business.Product(SellerResident,"p",new(seller.Id,"Idli","Fresh","food","Rice, lentils","None declared",20,"INR",stock,"active"),null,default);
    }
    [Fact] public async Task Ownership_shares_cannot_overlap_above_100_and_scopes_stay_private()
    {
        await Own(60,60,60); await Own(40,40,40,op.Id);
        await Assert.ThrowsAsync<ApiException>(()=>Own(1,1,1,resident.Id));
        Assert.Equal(2,(await business.Read(Owner,"p",default)).Ownerships.Count);
        Assert.Empty((await business.Read(Guard,"p",default)).Parties);
        await Assert.ThrowsAsync<ApiException>(()=>business.Read(Guard,"other",default));
        await Assert.ThrowsAsync<ApiException>(()=>business.Read(Resident,"other",default));
    }
    [Fact] public async Task Master_and_sublease_produce_separate_rent_deposits_and_partial_verification()
    {
        var leases=await Lease(); var charges=await business.GenerateRent(Admin,"p",new(Month),default); Assert.Equal(2,charges.Count);
        Assert.Empty(await business.GenerateRent(Admin,"p",new(Month),default));
        var rent=charges.Single(c=>c.AgreementId==leases.Sub.Id); var payment=await business.Payment(Resident,"p",new(rent.Id,5000,"UPI ref",Guid.NewGuid().ToString()),default);
        Assert.Equal("pending",payment.Status); Assert.Equal(0,(await business.Read(Resident,"p",default)).Charges.Single(c=>c.Id==rent.Id).VerifiedPaid);
        await Assert.ThrowsAsync<ApiException>(()=>business.PaymentAction(Resident,"p",payment.Id,new("verify",0),default));
        await business.PaymentAction(Operator,"p",payment.Id,new("verify",0),default);
        var view=await business.Read(Resident,"p",default); Assert.Single(view.Agreements); Assert.Equal(5000,view.Charges.Single(c=>c.Id==rent.Id).VerifiedPaid); Assert.Single(view.Charges,c=>c.Kind=="deposit");
        Assert.DoesNotContain(view.Charges,c=>c.AgreementId==leases.Master.Id);
        await Assert.ThrowsAsync<ApiException>(()=>business.Payment(Resident,"p",new(rent.Id,10000,"Too much",Guid.NewGuid().ToString()),default));
        Assert.Empty((await business.Read(Guard,"p",default)).Charges);
    }
    [Fact] public async Task Invalid_sublease_and_parent_shortening_are_rejected()
    {
        var leases=await Lease();
        await Assert.ThrowsAsync<ApiException>(()=>business.Agreement(Operator,"p",new("sublease",resident.Id,op.Id,leases.Master.Id,Resident.ActiveResidentOccupancies.Single().Id,[unit.Id],Start,DateOnly.Parse(End).AddDays(1).ToString("yyyy-MM-dd"),100,0,"INR",5),default));
        await Assert.ThrowsAsync<ApiException>(()=>business.EndAgreement(Admin,"p",leases.Master.Id,new(clock.GetUtcNow().AddDays(10).ToString("yyyy-MM-dd"),0),default));
        var rebound=Resident with { ResidentOccupancies=[new("77777777-7777-4777-8777-777777777777","p","101",DateTimeOffset.UtcNow.AddDays(-1),null)] };
        Assert.Empty((await business.Read(rebound,"p",default)).Agreements);
    }
    [Fact] public async Task Expense_allocation_uses_effective_shares_without_mixing_scope()
    {
        await Own(60,60,60); await Own(40,40,40,op.Id);
        var expense=await business.Expense(Admin,"p",new("unit",unit.Id,null,"Repair","Door",1001,"INR",clock.GetUtcNow().ToString("yyyy-MM-dd"),"unpaid",[]),default);
        Assert.Equal(1001,expense.Allocations.Sum(a=>a.Amount)); Assert.Equal(600.6m,expense.Allocations.Single(a=>a.PartyId==owner.Id).Amount);
        Assert.Empty((await business.Read(Resident,"p",default)).Expenses);
        await Assert.ThrowsAsync<ApiException>(()=>business.Expense(Resident,"p",new("community",null,null,"Test","Test",1,"INR",Start,"paid",[]),default));
    }
    [Fact] public async Task Stock_and_idempotency_survive_competing_orders_and_cancellation()
    {
        var item=await Item(1); var input=new OrderInput(item.Id,1,Guid.NewGuid().ToString()); var first=await business.Order(Resident,"p",input,default);
        Assert.Equal(first.Id,(await business.Order(Resident,"p",input,default)).Id);
        await Assert.ThrowsAsync<ApiException>(()=>business.Order(BuyerAdmin,"p",new(item.Id,1,Guid.NewGuid().ToString()),default));
        await business.OrderAction(Resident,"p",first.Id,new("cancel",0),default);
        await Assert.ThrowsAsync<ApiException>(()=>business.OrderAction(Resident,"p",first.Id,new("cancel",1),default));
        Assert.Equal(1,(await business.Read(Admin,"p",default)).Products.Single().Stock);
    }
    [Fact] public async Task Concurrent_orders_never_oversell()
    {
        var item=await Item(1);
        async Task<bool> Place() { try { await business.Order(Resident,"p",new(item.Id,1,Guid.NewGuid().ToString()),default); return true; } catch(ApiException){return false;} }
        var outcomes=await Task.WhenAll(Place(),Place()); Assert.Single(outcomes,x=>x); Assert.Equal(0,(await business.Read(Admin,"p",default)).Products.Single().Stock);
    }
    [Fact] public async Task Group_buy_locks_price_and_creates_orders_only_after_threshold_and_deadline()
    {
        var item=await Item(); var group=await business.Group(SellerResident,"p",new(item.Id,15,3,10,clock.GetUtcNow().AddMinutes(5).ToString("O"),"Lobby at 6"),default);
        group=await business.Pledge(Resident,"p",group.Id,new(3,0),default); Assert.Empty((await business.Read(Admin,"p",default)).Orders);
        await Assert.ThrowsAsync<ApiException>(()=>business.GroupAction(SellerResident,"p",group.Id,new("finalize",group.Revision),default));
        clock.Advance(TimeSpan.FromMinutes(6)); group=await business.GroupAction(SellerResident,"p",group.Id,new("finalize",group.Revision),default); Assert.Equal("confirmed",group.Status);
        var order=Assert.Single((await business.Read(Resident,"p",default)).Orders); Assert.Equal(15,order.UnitPrice); Assert.Equal("unpaid",order.PaymentStatus);
        await Assert.ThrowsAsync<ApiException>(()=>business.GroupAction(SellerResident,"p",group.Id,new("finalize",group.Revision),default));
    }
    [Fact] public async Task Failed_group_has_no_order_or_payment_and_withdrawal_stops_at_deadline()
    {
        var item=await Item(); var group=await business.Group(SellerResident,"p",new(item.Id,15,5,10,clock.GetUtcNow().AddMinutes(5).ToString("O"),"Lobby"),default);
        group=await business.Pledge(Resident,"p",group.Id,new(1,0),default); clock.Advance(TimeSpan.FromMinutes(6));
        await Assert.ThrowsAsync<ApiException>(()=>business.Pledge(Resident,"p",group.Id,new(0,group.Revision),default));
        group=await business.GroupAction(SellerResident,"p",group.Id,new("finalize",group.Revision),default); Assert.Equal("failed",group.Status); Assert.Empty((await business.Read(Admin,"p",default)).Orders); Assert.Equal(10,(await business.Read(Admin,"p",default)).Products.Single().Stock);
    }
    [Fact] public async Task Parcel_acceptance_and_resident_receipt_are_distinct_and_private()
    {
        await Lease(); var entry=await business.GateEntry(Guard,"p",new("parcel","Grocery box",unit.Id,clock.GetUtcNow().ToString("O"),null,null),default);
        await Assert.ThrowsAsync<ApiException>(()=>business.GateAction(Guard,"p",entry.Id,new("accept-parcel",0),default));
        entry=await business.GateAction(Resident,"p",entry.Id,new("approve",0),default); entry=await business.GateAction(Guard,"p",entry.Id,new("accept-parcel",entry.Revision),default);
        Assert.Equal("accepted",entry.Status); Assert.Null(entry.ReceivedAt);
        await Assert.ThrowsAsync<ApiException>(()=>business.GateAction(Guard,"p",entry.Id,new("receive-parcel",entry.Revision),default));
        entry=await business.GateAction(Resident,"p",entry.Id,new("receive-parcel",entry.Revision),default); Assert.Equal("received",entry.Status);
    }
    [Fact] public async Task Facility_capacity_and_revisions_prevent_double_booking()
    {
        var facility=await business.Facility(Admin,"p",new("Guest room",1,60,200,"INR","One room"),default); var start=clock.GetUtcNow().AddHours(1).ToString("O");
        var booking=await business.Booking(Resident,"p",new(facility.Id,start,Guid.NewGuid().ToString()),default);
        await Assert.ThrowsAsync<ApiException>(()=>business.Booking(BuyerAdmin,"p",new(facility.Id,start,Guid.NewGuid().ToString()),default));
        await business.BookingAction(Resident,"p",booking.Id,new("cancel",0),default); await business.Booking(BuyerAdmin,"p",new(facility.Id,start,Guid.NewGuid().ToString()),default);
    }
    [Fact] public async Task Draft_map_is_private_publishing_and_stable_unit_links_are_revision_guarded()
    {
        var shape=new LayoutShape(Guid.NewGuid().ToString(),"flat","101",unit.Id,[new(20,20),new(100,20),new(100,100),new(20,100)]);
        var layout=await business.Layout(Admin,"p",new(1,"First floor",[shape],0),default); Assert.Empty((await business.Read(Resident,"p",default)).Layouts);
        layout=await business.LayoutAction(Admin,"p",layout.Id,new("publish",0),default); Assert.Single((await business.Read(Resident,"p",default)).Layouts);
        await business.Layout(Admin,"p",new(1,"First floor",[shape with {Label="Draft change"}],layout.Revision),default);
        Assert.Equal("101",(await business.Read(Resident,"p",default)).Layouts.Single().Shapes.Single().Label);
        await Assert.ThrowsAsync<ApiException>(()=>business.Layout(Admin,"p",new(1,"First floor",[shape],layout.Revision),default));
        await Assert.ThrowsAsync<ApiException>(()=>business.Layout(Guard,"p",new(2,"Other",[],0),default));
    }
    [Fact] public async Task Active_community_records_prevent_property_archival()
    {
        await Lease(); await Assert.ThrowsAsync<ApiException>(()=>repairs.ArchiveProperty(Admin,"p",default));
        Assert.Contains((await repairs.Properties(Admin,default)),p=>p.Id=="p");
    }
    [Fact] public async Task Guard_payload_never_exposes_party_or_financial_records()
    {
        await Lease(); await Item(); await business.GenerateRent(Admin,"p",new(Month),default);
        var data=await business.Read(Guard,"p",default);
        Assert.Empty(data.Parties); Assert.Empty(data.Ownerships); Assert.Empty(data.Agreements); Assert.Empty(data.Charges);
        Assert.Empty(data.Payments); Assert.Empty(data.Expenses); Assert.Empty(data.Orders); Assert.Empty(data.Products);
        var entry=await business.GateEntry(Resident,"p",new("visitor","Guest",unit.Id,clock.GetUtcNow().ToString("O"),null,null),default);
        var json=System.Text.Json.JsonSerializer.Serialize(entry);
        Assert.DoesNotContain("ResidentUserId",json); Assert.DoesNotContain("OccupancyId",json);
    }
    [Fact] public async Task Ending_ownership_and_leases_uses_the_building_calendar_day()
    {
        clock.Set(DateTimeOffset.Parse("2026-10-04T00:30:00Z"));
        await repairs.SaveProperty(Admin,new Property{Id="p",Name="p",Address="Test",Units=10,Timezone="America/New_York"},false,default);
        var ownership=await Own();
        await business.EndOwnership(Admin,"p",ownership.Id,new("2026-10-03",ownership.Revision),default);
        var second=await repairs.AddUnit(Admin,"p","102",default);
        await business.Ownership(Admin,"p",new(second.Id,owner.Id,100,100,100,Start,null),default);
        var master=await business.Agreement(Admin,"p",new("master",op.Id,owner.Id,null,null,[second.Id],Start,End,10000,0,"INR",5),default);
        await business.EndAgreement(Admin,"p",master.Id,new("2026-10-03",master.Revision),default);

        clock.Set(DateTimeOffset.Parse("2026-10-03T20:30:00Z"));
        await repairs.SaveProperty(Admin,new Property{Id="p",Name="p",Address="Test",Units=10,Timezone="Asia/Tokyo"},false,default);
        var third=await repairs.AddUnit(Admin,"p","103",default);
        var tokyo=await business.Ownership(Admin,"p",new(third.Id,owner.Id,100,100,100,Start,null),default);
        await Assert.ThrowsAsync<ApiException>(()=>business.EndOwnership(Admin,"p",tokyo.Id,new("2026-10-03",tokyo.Revision),default));
        await business.EndOwnership(Admin,"p",tokyo.Id,new("2026-10-04",tokyo.Revision),default);
    }
    [Fact] public async Task User_context_is_persisted_scoped_and_never_grants_admin_permission()
    {
        var view=await users.Read(Admin,default); Assert.Equal(2,view.UserContext); Assert.True(view.CanSwitchContext);
        view=await users.Switch(Admin,new(1,view.Revision),default);
        Assert.Equal(1,(await users.Read(Admin,default)).UserContext);
        Assert.Equal(2,(await users.Read(Admin with {WorkspaceId="different"},default)).UserContext);
        Assert.False((Admin with {UserContext=1}).IsManager);
        await Assert.ThrowsAsync<ApiException>(()=>users.Switch(Admin,new(2,0),default));
        view=await users.Switch(Admin,new(2,view.Revision),default); Assert.Equal(2,view.UserContext);
        var downgraded=Admin with {Role="tenant"};
        var downgradedView=await users.Read(downgraded,default); Assert.Equal(1,downgradedView.UserContext);Assert.False(downgradedView.CanSwitchContext);
        await Assert.ThrowsAsync<ApiException>(()=>users.Switch(downgraded,new(2,downgradedView.Revision),default));
        var residentView=await users.Read(Resident,default); Assert.Equal(1,residentView.UserContext);
        await Assert.ThrowsAsync<ApiException>(()=>users.Switch(Resident,new(2,residentView.Revision),default));
        Assert.False((Resident with {UserContext=2}).IsManager);
    }
    [Fact] public async Task Admin_user_view_limits_data_and_actions_to_personal_membership()
    {
        await Lease(); var item=await Item(); await business.GenerateRent(Admin,"p",new(Month),default);
        var member=Admin with {UserContext=1}; var data=await business.Read(member,"p",default);
        Assert.False(data.CanManage);Assert.False(data.CanGate);Assert.Equal("member",data.Role);
        Assert.Empty(data.Agreements);Assert.Empty(data.Charges);Assert.Empty(data.Parties);Assert.Empty(data.Audit);
        await Assert.ThrowsAsync<ApiException>(()=>business.Party(member,"p",new("No","person",null),default));
        await Assert.ThrowsAsync<ApiException>(()=>business.Facility(member,"p",new("No",1,60,0,"INR",""),default));
        await Assert.ThrowsAsync<ApiException>(()=>repairs.AddUnit(member,"p","Forbidden",default));
        var order=await business.Order(member,"p",new(item.Id,1,Guid.NewGuid().ToString()),default); Assert.Equal(Admin.Id,order.UserId);
        var party=await business.Party(Admin,"p",new("Admin's own ownership","person",Admin.Id),default);
        var ownUnit=await repairs.AddUnit(Admin,"p","202",default);
        await business.Ownership(Admin,"p",new(ownUnit.Id,party.Id,100,100,100,Start,null),default);
        var formerUnit=await repairs.AddUnit(Admin,"p","203",default);
        await business.Ownership(Admin,"p",new(formerUnit.Id,owner.Id,100,100,100,Start,null),default);
        var unassignedLease=await business.Agreement(Admin,"p",new("direct",party.Id,owner.Id,null,Guid.NewGuid().ToString(),[formerUnit.Id],Start,End,1000,0,"INR",5),default);
        var unassignedCharge=Assert.Single(await business.GenerateRent(Admin,"p",new(Month),default),c=>c.AgreementId==unassignedLease.Id);
        await Assert.ThrowsAsync<ApiException>(()=>business.Payment(member,"p",new(unassignedCharge.Id,100,"No trusted occupancy",Guid.NewGuid().ToString()),default));
        data=await business.Read(member,"p",default); Assert.Equal("unit_owner",data.Role);Assert.Single(data.Ownerships);Assert.Equal(ownUnit.Id,data.Ownerships.Single().UnitId);
        Assert.Empty(data.Charges);Assert.Empty(data.Agreements);
    }
    private sealed class TestClock : TimeProvider
    {
        private DateTimeOffset current=DateTimeOffset.UtcNow;
        public override DateTimeOffset GetUtcNow()=>current;
        public void Set(DateTimeOffset value)=>current=value;
        public void Advance(TimeSpan value)=>current+=value;
    }
}
