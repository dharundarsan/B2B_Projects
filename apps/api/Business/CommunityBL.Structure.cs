namespace RepairLedger.Api.Business;
public sealed partial class CommunityBL
{
    public Task<CommunityBlock> Block(Actor actor,string property,BlockInput input,string? id,CancellationToken ct)=>Write(actor,property,(s,d)=>{
        actor.RequireManager();var name=Text(input.Name,100,"Block / tower name");
        Require(!d.Blocks.Any(b=>b.Id!=id&&b.Name.Equals(name,StringComparison.OrdinalIgnoreCase)),"This block / tower already exists.",409);
        if(id==null)return s.Insert("Block",new CommunityBlock{Name=name},Now);
        var row=Find(d.Blocks,id);row.Name=name;return s.Update("Block",row,input.Revision,"Block.renamed",Now);
    },ct);
    public Task<List<PropertyUnit>> Flats(Actor actor,string property,FlatBatchInput input,CancellationToken ct)=>Write(actor,property,async(s,d)=>{
        actor.RequireManager();Find(d.Blocks,input.BlockId);Require(input.Floor is >=-5 and <=150,"Choose a floor between -5 and 150.");
        var labels=(input.Labels??[]).Select(l=>Text(l,40,"Flat label")).ToArray();
        Require(labels.Length is >0 and <=200&&labels.Distinct(StringComparer.OrdinalIgnoreCase).Count()==labels.Length,"Enter 1–200 distinct flat labels.");
        Require(!d.Units.Any(u=>labels.Contains(u.Label,StringComparer.OrdinalIgnoreCase)),"One of these flats already exists. Use a block prefix such as A-101.",409);
        Require(d.Units.Count(u=>u.Archived==0)+labels.Length<=d.Property.Units,"Increase the community's declared flat capacity first.",409);
        foreach(var label in labels)Require(await s.RegisterUnit(label)==1,"A flat label was already registered.",409);
        var created=(await s.Load()).Units.Where(u=>labels.Contains(u.Label)).ToList();
        foreach(var u in created){await s.UnitLocation(u.Id,input.BlockId,input.Floor);u.BlockId=input.BlockId;u.Floor=input.Floor;}
        return created;
    },ct);
    public Task<PropertyUnit> FlatLocation(Actor actor,string property,string id,FlatLocationInput input,CancellationToken ct)=>Write(actor,property,async(s,d)=>{
        actor.RequireManager();Find(d.Blocks,input.BlockId);Require(input.Floor is >=-5 and <=150,"Choose a floor between -5 and 150.");
        var unit=d.Units.SingleOrDefault(u=>u.Id==id&&u.Archived==0)??throw new ApiException(404,"Flat not found.");
        Require(!d.Layouts.Where(l=>l.BlockId!=input.BlockId||l.Floor!=input.Floor).Any(l=>(System.Text.Json.JsonSerializer.Deserialize<List<LayoutShape>>(l.DraftJson)??[]).Concat(System.Text.Json.JsonSerializer.Deserialize<List<LayoutShape>>(l.PublishedJson)??[]).Any(sh=>sh.UnitId==id)),"Unlink this flat from its current floor map and publish that change before moving it.",409);
        await s.UnitLocation(id,input.BlockId,input.Floor);unit.BlockId=input.BlockId;unit.Floor=input.Floor;return unit;
    },ct);
    public Task<CommunityDelivery> Delivery(Actor actor,string property,DeliveryInput input,CancellationToken ct)=>Write(actor,property,(s,d)=>{
        Member(actor);Require(actor.Context is 1 or 3,"Open User or Seller view to request your delivery.",403);
        var seller=actor.Context==3?Find(d.Sellers,input.SellerId??""):null;
        if(seller!=null){SellerAccess(actor,seller);Require(seller.Status=="approved","Get your provider profile approved first.",409);}else{Buyer(actor);Require(input.SellerId==null&&!input.Bulk,"Personal deliveries cannot be bulk business stock.",403);}
        Require(input.Packages>=1&&input.Packages<=(seller==null?20:10000),"Check the number of packages (personal maximum 20; business maximum 10,000).");
        Require(input.Packages<=20||input.Bulk,"Mark large business shipments as bulk deliveries.");
        if(input.UnitId!=null)Require(seller==null&&d.Units.Any(u=>u.Id==input.UnitId&&u.Archived==0)&&(ResidentUnits(actor,d).Contains(input.UnitId)||actor.IsUnitOwner&&OwnedUnits(actor,d).Contains(input.UnitId)),"Choose your own flat, or community gate pickup.",403);
        var expected=Instant(input.ExpectedAt);Require(DateTimeOffset.Parse(expected)>=clock.GetUtcNow().AddMinutes(-30)&&DateTimeOffset.Parse(expected)<=clock.GetUtcNow().AddDays(90),"Choose a delivery within the next 90 days.");
        return s.Insert("Delivery",new CommunityDelivery{UserId=actor.Id,SellerId=seller?.Id,UnitId=input.UnitId,Name=Text(input.Name,200,"Carrier / supplier"),Reference=Text(input.Reference,200,"Order reference",true),Notes=Text(input.Notes,2000,"Handling instructions",!input.Bulk),Packages=input.Packages,Bulk=input.Bulk,ExpectedAt=expected,Approval=input.Bulk?"pending":"approved"},Now);
    },ct);
    public Task<CommunityDelivery> DeliveryAction(Actor actor,string property,string id,CommunityActionInput input,CancellationToken ct)=>Write(actor,property,(s,d)=>{
        var row=Find(d.Deliveries,id);var recipient=row.UserId==actor.Id&&((row.SellerId==null&&actor.Context==1&&actor.UserAccess!=false)||(row.SellerId!=null&&actor.Context==3&&actor.CanSell));
        var action=Choice(input.Action,"approve","deny","accept","receive","cancel");
        if(action is "approve" or "deny"){actor.RequireManager();Require(row.Approval=="pending"&&row.Status=="expected","This delivery has already been reviewed.",409);row.Approval=action=="approve"?"approved":"denied";}
        else if(action=="cancel"){Require(recipient||actor.IsManager,"Only the requester or administrator can cancel this delivery.",403);Require(row.Status=="expected","This delivery is already at the gate.",409);row.Status="cancelled";}
        else if(action=="receive"){Require(recipient,"Only the intended recipient can confirm receipt.",403);Require(row.Status=="accepted","The gate has not accepted this delivery yet.",409);row.Status="received";row.ReceivedAt=Now;}
        else{Gate(actor);Require(row.Status=="expected"&&row.Approval=="approved","Approve the delivery before accepting it.",409);Require(TimeZoneInfo.ConvertTime(DateTimeOffset.Parse(row.ExpectedAt),TimeZoneInfo.FindSystemTimeZoneById(d.Property.Timezone)).Date==TimeZoneInfo.ConvertTime(clock.GetUtcNow(),TimeZoneInfo.FindSystemTimeZoneById(d.Property.Timezone)).Date,"The delivery is not expected today.",409);if(row.SellerId!=null)Require(Find(d.Sellers,row.SellerId).Status=="approved","This store is no longer approved.",409);row.Status="accepted";row.AcceptedAt=Now;}
        return s.Update("Delivery",row,input.Revision,"Delivery."+action,Now);
    },ct);
}
