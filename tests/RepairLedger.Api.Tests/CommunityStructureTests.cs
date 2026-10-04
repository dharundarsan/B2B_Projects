using RepairLedger.Api.Errors;
using RepairLedger.Api.Models;
using Xunit;
namespace RepairLedger.Api.Tests;
public sealed partial class CommunityTests
{
    [Fact] public async Task Administrator_assigns_provider_to_an_active_seller_in_this_community()
    {
        var account=await users.Save(Admin,Resident.Id,MemberInput(seller:true,context:3),true,default);
        var profile=await business.Seller(Admin,"p",new("Resident service","resident","Block A",Resident.Id),default);
        Assert.Equal(Resident.Id,profile.UserId);Assert.Equal("approved",profile.Status);
        await Assert.ThrowsAsync<ApiException>(()=>business.Seller(Admin,"other",new("Wrong community","resident","Gate",Resident.Id),default));
        await users.Save(Admin,Resident.Id,MemberInput(seller:false,revision:account.Revision),false,default);
        await Assert.ThrowsAsync<ApiException>(()=>business.Seller(Admin,"p",new("Disabled seller","resident","Gate",Resident.Id),default));
    }
    [Fact] public async Task Blocks_flats_and_floor_plans_are_scoped_and_batch_registration_is_atomic()
    {
        var a=await business.Block(Admin,"p",new("Block A"),null,default);
        var b=await business.Block(Admin,"p",new("Block B"),null,default);
        var flats=await business.Flats(Admin,"p",new(a.Id,1,["A-101","A-102"]),default);
        Assert.All(flats,u=>{Assert.Equal(a.Id,u.BlockId);Assert.Equal(1,u.Floor);});
        await Assert.ThrowsAsync<ApiException>(()=>business.Flats(Admin,"p",new(a.Id,1,["A-103","A-101"]),default));
        Assert.DoesNotContain((await business.Read(Admin,"p",default)).Units,u=>u.Label=="A-103");
        await Assert.ThrowsAsync<ApiException>(()=>business.Flats(Resident,"p",new(a.Id,1,["A-103"]),default));
        await Assert.ThrowsAsync<ApiException>(()=>business.Flats(Admin,"other",new(a.Id,1,["A-103"]),default));
        var shape=new LayoutShape(Guid.NewGuid().ToString(),"flat","A-101",flats[0].Id,[new(0,0),new(200,0),new(200,200),new(0,200)]);
        var plan=await business.Layout(Admin,"p",new(1,"A first floor",[shape],0,a.Id),default);
        await Assert.ThrowsAsync<ApiException>(()=>business.Layout(Admin,"p",new(1,"Wrong block",[shape],0,b.Id),default));
        await business.Layout(Admin,"p",new(1,"B first floor",[shape with {Id=Guid.NewGuid().ToString(),UnitId=null}],0,b.Id),default);
        await business.LayoutAction(Admin,"p",plan.Id,new("publish",plan.Revision),default);
        Assert.Equal(2,(await business.Read(Admin,"p",default)).Layouts.Count);
        Assert.Single((await business.Read(Resident,"p",default)).Layouts);
        var moved=await business.FlatLocation(Admin,"p",unit.Id,new(b.Id,0),default);
        Assert.Equal(unit.Id,moved.Id);Assert.Equal("101",moved.Label);
        await Assert.ThrowsAsync<ApiException>(()=>business.FlatLocation(Admin,"p",flats[0].Id,new(b.Id,1),default));
    }
    [Fact] public async Task Bulk_stock_requires_admin_approval_and_only_seller_can_confirm_receipt()
    {
        var product=await Item();
        var input=new RepairLedger.Api.Models.Inputs.DeliveryInput("Stock supplier","PO-001","Van arriving; reserve unloading space",60,true,clock.GetUtcNow().AddMinutes(5).ToString("O"),product.SellerId);
        var delivery=await business.Delivery(SellerResident,"p",input,default);
        Assert.Equal("pending",delivery.Approval);
        Assert.Single((await business.Read(Guard,"p",default)).Deliveries);
        Assert.Empty((await business.Read(Resident,"p",default)).Deliveries);
        Assert.Empty((await business.Read(BuyerAdmin,"p",default)).Deliveries);
        await Assert.ThrowsAsync<ApiException>(()=>business.DeliveryAction(Guard,"p",delivery.Id,new("accept",0),default));
        await Assert.ThrowsAsync<ApiException>(()=>business.DeliveryAction(SellerResident,"p",delivery.Id,new("approve",0),default));
        delivery=await business.DeliveryAction(Admin,"p",delivery.Id,new("approve",0),default);
        delivery=await business.DeliveryAction(Guard,"p",delivery.Id,new("accept",delivery.Revision),default);
        await Assert.ThrowsAsync<ApiException>(()=>business.DeliveryAction(Guard,"p",delivery.Id,new("receive",delivery.Revision),default));
        await Assert.ThrowsAsync<ApiException>(()=>business.DeliveryAction(Resident,"p",delivery.Id,new("receive",delivery.Revision),default));
        delivery=await business.DeliveryAction(SellerResident,"p",delivery.Id,new("receive",delivery.Revision),default);
        Assert.Equal("received",delivery.Status);
        Assert.NotNull(delivery.ReceivedAt);
    }
    [Fact] public async Task Personal_deliveries_enforce_recipient_view_quantity_flat_and_expected_day()
    {
        var input=new RepairLedger.Api.Models.Inputs.DeliveryInput("Courier","","",1,false,clock.GetUtcNow().AddMinutes(5).ToString("O"));
        var delivery=await business.Delivery(Resident,"p",input with {UnitId=unit.Id},default);
        Assert.Equal("approved",delivery.Approval);
        await Assert.ThrowsAsync<ApiException>(()=>business.Delivery(Admin,"p",input,default));
        await Assert.ThrowsAsync<ApiException>(()=>business.Delivery(Resident,"p",input with {Bulk=true},default));
        await Assert.ThrowsAsync<ApiException>(()=>business.Delivery(Resident,"p",input with {Packages=21},default));
        await Assert.ThrowsAsync<ApiException>(()=>business.Delivery(BuyerAdmin,"p",input with {UnitId=unit.Id},default));
        await Assert.ThrowsAsync<ApiException>(()=>business.DeliveryAction(BuyerAdmin,"p",delivery.Id,new("cancel",0),default));
        var tomorrow=await business.Delivery(Resident,"p",input with {ExpectedAt=clock.GetUtcNow().AddDays(1).ToString("O")},default);
        await Assert.ThrowsAsync<ApiException>(()=>business.DeliveryAction(Guard,"p",tomorrow.Id,new("accept",0),default));
        Assert.Empty((await business.Read(SellerResident,"p",default)).Deliveries);
    }
}
