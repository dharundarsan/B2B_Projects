using RepairLedger.Api.Business;
using RepairLedger.Api.Errors;
using RepairLedger.Api.Models;
using Xunit;
namespace RepairLedger.Api.Tests;
public sealed partial class CommunityTests
{
    [Fact] public async Task Active_view_enforces_buyer_provider_and_administrator_boundaries()
    {
        var product=await Item();
        var input=new RepairLedger.Api.Models.Inputs.ProductInput(product.SellerId,"Test","","product","","",10,"INR",5,"active");
        var service=await business.Service(SellerResident,"p",new(product.SellerId,"Help","Home","Help at home",10,"INR","visit","active"),null,default);
        foreach(var buyer in new[]{Admin,Admin with{UserContext=3},SellerResident})
            Assert.Equal(403,(await Assert.ThrowsAsync<ApiException>(()=>business.Order(buyer,"p",new(product.Id,1,Guid.NewGuid().ToString()),default))).Status);
        foreach(var user in new[]{BuyerAdmin,Resident with{SellerAccess=true}}){
            Assert.Equal(403,(await Assert.ThrowsAsync<ApiException>(()=>business.Product(user,"p",input,null,default))).Status);
            Assert.Equal(403,(await Assert.ThrowsAsync<ApiException>(()=>users.Save(user,Guid.NewGuid().ToString(),MemberInput("manager",true,2),true,default))).Status);
        }
        var order=await business.Order(BuyerAdmin,"p",new(product.Id,1,Guid.NewGuid().ToString()),default);
        Assert.Equal(403,(await Assert.ThrowsAsync<ApiException>(()=>business.OrderAction(Resident with{SellerAccess=true},"p",order.Id,new("accept",order.Revision),default))).Status);
        order=await business.OrderAction(SellerResident,"p",order.Id,new("accept",order.Revision),default);
        Assert.Equal("accepted",order.Status);
        Assert.False(SellerResident.IsResident);Assert.False((Owner with{UserContext=3}).IsUnitOwner);Assert.False((Operator with{UserContext=3}).IsOperator);
        Assert.Equal(403,(await Assert.ThrowsAsync<ApiException>(()=>business.GateEntry(SellerResident,"p",new("visitor","Guest",unit.Id,clock.GetUtcNow().AddDays(1).ToString("O"),null,null),default))).Status);
        Assert.Empty(SellerResident.MobilePropertyIds);Assert.Equal(403,Assert.Throws<ApiException>(()=>SellerResident.RequireResident()).Status);
        Assert.Equal(403,(await Assert.ThrowsAsync<ApiException>(()=>business.RequestService(Admin,"p",new(service.Id,"Help",clock.GetUtcNow().AddDays(1).ToString("O"),Guid.NewGuid().ToString()),default))).Status);
    }
    [Fact] public async Task Newly_created_administrator_can_create_another_administrator_only_in_admin_view()
    {
        await users.Save(Admin,Operator.Id,MemberInput("manager",true,2),true,default);
        var administrator=await users.Resolve(Operator,default);
        await users.Save(administrator,Owner.Id,MemberInput("manager",true,2) with{Email="second-admin@test.local"},true,default);
        var second=await users.Resolve(Owner,default);
        Assert.True(second.IsManager);Assert.Equal(new[]{1,2,3},(await users.Read(second,default)).AvailableContexts);
        foreach(var context in new[]{1,3}){
            var view=await users.Read(administrator,default);await users.Switch(administrator,new(context,view.Revision),default);
            administrator=await users.Resolve(Operator,default);
            Assert.Equal(403,(await Assert.ThrowsAsync<ApiException>(()=>users.Save(administrator,Guid.NewGuid().ToString(),MemberInput("manager",true,2),true,default))).Status);
        }
    }
    private ManagedUserInput MemberInput(string role="member",bool seller=false,int context=1,long revision=0)=>
        UserManagementBL.Validate(new("Community member","member@test.local",role,true,role=="manager",seller||role=="manager",context,[new(){PropertyId="p"}],"long-password-for-test",revision),true);
    [Fact] public async Task Managed_members_have_no_admin_view_and_permissions_come_from_the_database()
    {
        await users.Save(Admin,Resident.Id,MemberInput(),true,default);
        var verifiedIdentity=Resident with {Role="owner",PropertyUnits=new(){["other"]=["ALL"]}};
        var actor=await users.Resolve(verifiedIdentity,default);var view=await users.Read(actor,default);
        Assert.Equal("member",actor.Role);Assert.False(actor.CanAdmin);Assert.False(actor.CanSell);Assert.Equal(new[]{1},view.AvailableContexts);Assert.False(view.CanSwitchContext);
        Assert.Empty(actor.PropertyUnits);Assert.Equal("p",Assert.Single(actor.CommunityPropertyIds!));
        await business.Read(actor,"p",default);
        Assert.Equal(403,(await Assert.ThrowsAsync<ApiException>(()=>business.Read(actor,"other",default))).Status);
        Assert.Equal(403,(await Assert.ThrowsAsync<ApiException>(()=>users.Switch(actor,new(2,view.Revision),default))).Status);
        Assert.Equal(403,(await Assert.ThrowsAsync<ApiException>(()=>users.List(actor,default))).Status);
        Assert.Equal(403,(await Assert.ThrowsAsync<ApiException>(()=>business.Seller(actor,"p",new("Forbidden","resident","Lobby",null),default))).Status);
    }
    [Fact] public async Task Admin_creation_enables_all_views_and_member_updates_are_revision_guarded()
    {
        var account=await users.Save(Admin,Operator.Id,MemberInput("manager",true,2),true,default);
        var actor=await users.Resolve(Operator,default);var view=await users.Read(actor,default);
        Assert.Equal(new[]{1,2,3},view.AvailableContexts);Assert.True(actor.IsManager);
        view=await users.Switch(actor,new(3,view.Revision),default);Assert.Equal(3,view.UserContext);
        actor=await users.Resolve(Operator,default);Assert.False(actor.IsManager);Assert.True(actor.CanSell);
        Assert.Equal(403,(await Assert.ThrowsAsync<ApiException>(()=>users.List(actor,default))).Status);
        await Assert.ThrowsAsync<ApiException>(()=>users.Save(Admin,Operator.Id,MemberInput(revision:account.Revision),false,default));
        await users.Save(Admin,Operator.Id,MemberInput(revision:view.Revision),false,default);
        actor=await users.Resolve(Operator,default);Assert.False(actor.CanAdmin);Assert.Equal(1,actor.Context);
        Assert.Equal(403,(await Assert.ThrowsAsync<ApiException>(()=>users.Switch(actor,new(2,view.Revision+1),default))).Status);
    }
    [Fact] public async Task Profile_only_edits_preserve_memberships_without_rewriting_them()
    {
        var saved=await users.Save(Admin,Resident.Id,MemberInput(),true,default);
        // Simulate a runtime allowed to update accounts but forbidden to delete assignments.
        await using(var db=await database.Open(default)){
            var query=mysql==null?"CREATE TRIGGER protect_assignments BEFORE DELETE ON user_memberships BEGIN SELECT RAISE(ABORT, 'Assignments cannot be deleted'); END;":"CREATE TRIGGER protect_assignments BEFORE DELETE ON user_memberships FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Assignments cannot be deleted'";
            await Dapper.SqlMapper.ExecuteAsync(db,query);
        }
        var updated=await users.Save(Admin,Resident.Id,MemberInput(revision:saved.Revision) with {DisplayName="Updated member"},false,default);
        Assert.Equal("Updated member",updated.DisplayName);
        Assert.Equal("p",Assert.Single(updated.Memberships).PropertyId);
        Assert.Equal("p",Assert.Single((await users.Resolve(Resident,default)).CommunityPropertyIds!));
        await Assert.ThrowsAnyAsync<Exception>(()=>users.Save(Admin,Resident.Id,MemberInput(revision:updated.Revision) with {Memberships=[]},false,default));
        Assert.Equal("p",Assert.Single((await users.Resolve(Resident,default)).CommunityPropertyIds!));
    }
    [Fact] public async Task Suspension_blocks_existing_sessions_and_self_suspension_is_rejected()
    {
        var saved=await users.Save(Admin,Resident.Id,MemberInput(),true,default);
        await users.Status(Admin,Resident.Id,new("suspend",saved.Revision),default);
        Assert.Equal(403,(await Assert.ThrowsAsync<ApiException>(()=>users.Resolve(Resident,default))).Status);
        await users.Status(Admin,Resident.Id,new("activate",saved.Revision+1),default);
        Assert.Equal(1,(await users.Resolve(Resident,default)).Context);
        await Assert.ThrowsAsync<ApiException>(()=>users.Status(Admin,Admin.Id,new("suspend",0),default));
        await Assert.ThrowsAsync<ApiException>(()=>users.Status(Admin with{WorkspaceId="elsewhere"},Resident.Id,new("suspend",saved.Revision+2),default));
    }
    [Fact] public async Task Managed_resident_occupancy_replaces_untrusted_or_stale_assignments()
    {
        var occupancy=Guid.NewGuid().ToString();var input=MemberInput("tenant") with {Memberships=[new(){PropertyId="p",UnitId=unit.Id,OccupancyId=occupancy,StartsAt=DateTimeOffset.UtcNow.AddDays(-1).ToString("O")}]};
        await users.Save(Admin,Resident.Id,UserManagementBL.Validate(input,true),true,default);
        var actor=await users.Resolve(Resident with{AssignedPropertyIds=["other"]},default);
        Assert.Equal(occupancy,Assert.Single(actor.ActiveResidentOccupancies).Id);Assert.Equal("101",actor.ResidentUnits["p"].Single());Assert.DoesNotContain("other",actor.AssignedPropertyIds!);
        await Assert.ThrowsAsync<ApiException>(()=>users.Save(Admin,Owner.Id,MemberInput() with{Memberships=[new(){PropertyId="other",UnitId=unit.Id}]},true,default));
        var invalid=input with {Memberships=[new(){PropertyId="p",UnitId=unit.Id,OccupancyId=occupancy,StartsAt="2026-10-05T09:00:00"}]};
        Assert.Throws<ApiException>(()=>UserManagementBL.Validate(invalid,true));
        Assert.Throws<ApiException>(()=>UserManagementBL.Validate(MemberInput() with{AllowAdmin=true},true));
    }
    [Fact] public async Task Service_requests_snapshot_price_are_idempotent_private_and_follow_provider_steps()
    {
        var product=await Item();
        var service=await business.Service(SellerResident,"p",new(product.SellerId,"Tuition","Education","Maths lessons",500,"INR","hour","active"),null,default);
        var buyer=Admin with{UserContext=1};var input=new RepairLedger.Api.Models.Inputs.ServiceRequestInput(service.Id,"Algebra lesson",clock.GetUtcNow().AddDays(1).ToString("O"),Guid.NewGuid().ToString());
        var request=await business.RequestService(buyer,"p",input,default);
        Assert.Equal(request.Id,(await business.RequestService(buyer,"p",input,default)).Id);
        await business.Service(SellerResident,"p",new(service.SellerId,service.Name,service.Category,service.Description,900,"INR","hour","active",service.Revision),service.Id,default);
        Assert.Equal(500,(await business.Read(buyer,"p",default)).ServiceRequests.Single().Price);
        Assert.Empty((await business.Read(Guard,"p",default)).ServiceRequests);
        Assert.Equal(403,(await Assert.ThrowsAsync<ApiException>(()=>business.ServiceRequestAction(buyer,"p",request.Id,new("accept",0),default))).Status);
        await Assert.ThrowsAsync<ApiException>(()=>business.ServiceRequestAction(SellerResident,"p",request.Id,new("complete",0),default));
        request=await business.ServiceRequestAction(SellerResident,"p",request.Id,new("accept",0),default);
        await Assert.ThrowsAsync<ApiException>(()=>business.ServiceRequestAction(SellerResident,"p",request.Id,new("complete",0),default));
        request=await business.ServiceRequestAction(SellerResident,"p",request.Id,new("complete",request.Revision),default);Assert.Equal("completed",request.Status);
        await Assert.ThrowsAsync<ApiException>(()=>business.ServiceRequestAction(buyer,"p",request.Id,new("cancel",request.Revision),default));
    }
    [Fact] public async Task Seller_view_contains_only_own_business_and_cannot_buy_or_enter_admin_flows()
    {
        var product=await Item();await Lease();await business.GenerateRent(Admin,"p",new(Month),default);
        var another=await business.Seller(Admin,"p",new("Other store","shop","Lobby",null),default);
        await business.Product(Admin,"p",new(another.Id,"Another product","","product","","",10,"INR",10,"active"),null,default);
        var provider=Resident with{UserContext=3,SellerAccess=true,UserAccess=false};
        var data=await business.Read(provider,"p",default);Assert.Equal(3,data.UserContext);Assert.Equal(product.SellerId,Assert.Single(data.Sellers).Id);Assert.Single(data.Products);Assert.Empty(data.Charges);Assert.Empty(data.Parties);Assert.Empty(data.GateEntries);Assert.Empty(data.Facilities);Assert.Empty(data.Layouts);Assert.Empty(data.Notes);
        Assert.Equal(403,(await Assert.ThrowsAsync<ApiException>(()=>business.Order(provider,"p",new(product.Id,1,Guid.NewGuid().ToString()),default))).Status);
        await Assert.ThrowsAsync<ApiException>(()=>business.Product(provider,"p",new(another.Id,"Forbidden","","product","","",1,"INR",1,"active"),null,default));
        var revoked=provider with {SellerAccess=false,UserContext=1};
        await Assert.ThrowsAsync<ApiException>(()=>business.Product(revoked,"p",new(product.SellerId,"Forbidden","","product","","",1,"INR",1,"active"),null,default));
        var order=await business.Order(BuyerAdmin,"p",new(product.Id,1,Guid.NewGuid().ToString()),default);
        Assert.Empty((await business.Read(revoked,"p",default)).Orders);
        Assert.Empty((await business.Read(provider with{UserContext=1,UserAccess=true},"p",default)).Orders);
        Assert.Single((await business.Read(provider,"p",default)).Orders);
        await Assert.ThrowsAsync<ApiException>(()=>business.OrderAction(revoked,"p",order.Id,new("accept",order.Revision),default));
    }
    [Fact] public async Task Active_service_requests_prevent_building_archival()
    {
        var product=await Item();var service=await business.Service(SellerResident,"p",new(product.SellerId,"Help","Home","Home help",10,"INR","visit","active"),null,default);
        var request=await business.RequestService(BuyerAdmin,"p",new(service.Id,"Help please",clock.GetUtcNow().AddDays(1).ToString("O"),Guid.NewGuid().ToString()),default);
        await Assert.ThrowsAsync<ApiException>(()=>repairs.ArchiveProperty(Admin,"p",default));
        await business.ServiceRequestAction(SellerResident,"p",request.Id,new("decline",0),default);
        await repairs.ArchiveProperty(Admin,"p",default);
    }
}
