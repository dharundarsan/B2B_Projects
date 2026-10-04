namespace RepairLedger.Api.Business;
public sealed partial class CommunityBL
{
    public Task<CommunityService> Service(Actor actor,string property,ServiceInput input,string? id,CancellationToken ct)=>Write(actor,property,(s,d)=>
    {
        var seller=Find(d.Sellers,input.SellerId);SellerAccess(actor,seller);Require(seller.Status=="approved","The provider must be approved first.",409);
        var row=id==null?new CommunityService():Find(d.Services,id);Require(id==null||row.SellerId==seller.Id,"A service cannot move to another provider.");
        row.SellerId=seller.Id;row.Name=Text(input.Name,200,"Service name");row.Category=Text(input.Category,100,"Category");row.Description=Text(input.Description,2000,"Description");
        row.Price=Money(input.Price);row.Currency=Currency(input.Currency);row.PriceUnit=Choice(input.PriceUnit,"visit","hour","fixed");row.Status=Choice(input.Status,"active","paused");
        return id==null?s.Insert("Service",row,Now):s.Update("Service",row,input.Revision,"Service.updated",Now);
    },ct);
    public Task<CommunityServiceRequest> RequestService(Actor actor,string property,ServiceRequestInput input,CancellationToken ct)=>Write(actor,property,(s,d)=>
    {
        Buyer(actor);var service=Find(d.Services,input.ServiceId);var seller=Find(d.Sellers,service.SellerId);var submission=Submission(input.SubmissionId);
        var preferred=Instant(input.PreferredAt);var description=Text(input.Description,2000,"Request details");
        var previous=d.ServiceRequests.SingleOrDefault(r=>r.UserId==actor.Id&&r.SubmissionId==submission);
        if(previous!=null){Require(previous.ServiceId==service.Id&&previous.Description==description&&previous.PreferredAt==preferred,"This submission was used for another request.",409);return Task.FromResult(previous);}
        Require(service.Status=="active"&&seller.Status=="approved","This service is unavailable.",409);
        Require(DateTimeOffset.Parse(preferred)>clock.GetUtcNow()&&DateTimeOffset.Parse(preferred)<=clock.GetUtcNow().AddDays(90),"Choose a preferred time within the next 90 days.");
        return s.Insert("ServiceRequest",new CommunityServiceRequest{ServiceId=service.Id,SellerId=seller.Id,UserId=actor.Id,ServiceName=service.Name,Description=description,PreferredAt=preferred,Price=service.Price,Currency=service.Currency,PriceUnit=service.PriceUnit,SubmissionId=submission},Now);
    },ct);
    public Task<CommunityServiceRequest> ServiceRequestAction(Actor actor,string property,string id,CommunityActionInput input,CancellationToken ct)=>Write(actor,property,(s,d)=>
    {
        Member(actor);var row=Find(d.ServiceRequests,id);var provider=actor.IsManager||actor.Context==3&&actor.CanSell&&Find(d.Sellers,row.SellerId).UserId==actor.Id;
        var action=Choice(input.Action,"accept","decline","complete","cancel");
        if(action=="cancel"){if(!provider)Buyer(actor);if(provider&&row.UserId!=actor.Id)SellerAccess(actor,Find(d.Sellers,row.SellerId));Require(provider||row.UserId==actor.Id,"This request belongs to another account.",403);Require(row.Status is "requested" or "accepted","This request can no longer be cancelled.",409);row.Status="cancelled";}
        else{Require(provider,"Provider access required.",403);SellerAccess(actor,Find(d.Sellers,row.SellerId));Require(action=="complete"?row.Status=="accepted":row.Status=="requested","Complete the preceding service step first.",409);row.Status=action=="accept"?"accepted":action=="decline"?"declined":"completed";}
        return s.Update("ServiceRequest",row,input.Revision,"ServiceRequest."+action,Now);
    },ct);
}
