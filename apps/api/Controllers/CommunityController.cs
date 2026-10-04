using Microsoft.AspNetCore.Mvc;
namespace RepairLedger.Api.Controllers;

[Route("api/community")]
public sealed class CommunityController(CommunityBL business, Actor actor) : RepairLedgerController(actor)
{
    [HttpGet("context")] public async Task<object> Context(CancellationToken ct) => Data(await business.Context(Actor, ct));
    [HttpGet("{property}")] public async Task<object> Read(string property, CancellationToken ct) => Data(await business.Read(Actor, property, ct));
    [HttpPost("{property}/blocks")] public async Task<object> Block(string property,BlockInput input,CancellationToken ct)=>Data(await business.Block(Actor,property,input,null,ct));
    [HttpPatch("{property}/blocks/{id}")] public async Task<object> BlockUpdate(string property,string id,BlockInput input,CancellationToken ct)=>Data(await business.Block(Actor,property,input,id,ct));
    [HttpPost("{property}/flats")] public async Task<object> Flats(string property,FlatBatchInput input,CancellationToken ct)=>Data(await business.Flats(Actor,property,input,ct));
    [HttpPatch("{property}/flats/{id}/location")] public async Task<object> FlatLocation(string property,string id,FlatLocationInput input,CancellationToken ct)=>Data(await business.FlatLocation(Actor,property,id,input,ct));
    [HttpPost("{property}/deliveries")] public async Task<object> Delivery(string property,DeliveryInput input,CancellationToken ct)=>Data(await business.Delivery(Actor,property,input,ct));
    [HttpPost("{property}/deliveries/{id}/actions")] public async Task<object> DeliveryAction(string property,string id,CommunityActionInput input,CancellationToken ct)=>Data(await business.DeliveryAction(Actor,property,id,input,ct));
    [HttpPost("{property}/parties")] public async Task<object> Party(string property, PartyInput input, CancellationToken ct) => Data(await business.Party(Actor, property, input, ct));
    [HttpPost("{property}/ownerships")] public async Task<object> Ownership(string property, OwnershipInput input, CancellationToken ct) => Data(await business.Ownership(Actor, property, input, ct));
    [HttpPost("{property}/ownerships/{id}/end")] public async Task<object> EndOwnership(string property, string id, EndOwnershipInput input, CancellationToken ct) => Data(await business.EndOwnership(Actor, property, id, input, ct));
    [HttpPost("{property}/agreements")] public async Task<object> Agreement(string property, AgreementInput input, CancellationToken ct) => Data(await business.Agreement(Actor, property, input, ct));
    [HttpPost("{property}/agreements/{id}/end")] public async Task<object> EndAgreement(string property, string id, EndAgreementInput input, CancellationToken ct) => Data(await business.EndAgreement(Actor, property, id, input, ct));
    [HttpPost("{property}/rent/generate")] public async Task<object> Rent(string property, GenerateRentInput input, CancellationToken ct) => Data(await business.GenerateRent(Actor, property, input, ct));
    [HttpPost("{property}/payments")] public async Task<object> Payment(string property, PaymentInput input, CancellationToken ct) => Data(await business.Payment(Actor, property, input, ct));
    [HttpPost("{property}/payments/{id}/actions")] public async Task<object> PaymentAction(string property, string id, CommunityActionInput input, CancellationToken ct) => Data(await business.PaymentAction(Actor, property, id, input, ct));
    [HttpPost("{property}/expenses")] public async Task<object> Expense(string property, ExpenseInput input, CancellationToken ct) => Data(await business.Expense(Actor, property, input, ct));
    [HttpPost("{property}/expenses/{id}/actions")] public async Task<object> ExpenseAction(string property, string id, CommunityActionInput input, CancellationToken ct) => Data(await business.ExpenseAction(Actor, property, id, input, ct));
    [HttpPost("{property}/expenses/{expense}/receipts")] public async Task<object> Receipt(string property, string expense, ReceiptInput input, CancellationToken ct) => Data(await business.ReceiptUpload(Actor, property, expense, input, ct));
    [HttpPost("{property}/receipts/{id}/complete")] public async Task<object> CompleteReceipt(string property, string id, CommunityActionInput input, CancellationToken ct) => Data(await business.CompleteReceipt(Actor, property, id, input, ct));
    [HttpGet("{property}/receipts/{id}/url")] public async Task<object> ReceiptUrl(string property, string id, CancellationToken ct) => Data(await business.ReceiptUrl(Actor, property, id, ct));
    [HttpPost("{property}/sellers")] public async Task<object> Seller(string property, SellerInput input, CancellationToken ct) => Data(await business.Seller(Actor, property, input, ct));
    [HttpPost("{property}/sellers/{id}/actions")] public async Task<object> SellerAction(string property, string id, CommunityActionInput input, CancellationToken ct) => Data(await business.SellerAction(Actor, property, id, input, ct));
    [HttpPost("{property}/products")] public async Task<object> Product(string property, ProductInput input, CancellationToken ct) => Data(await business.Product(Actor, property, input, null, ct));
    [HttpPatch("{property}/products/{id}")] public async Task<object> ProductUpdate(string property, string id, ProductInput input, CancellationToken ct) => Data(await business.Product(Actor, property, input, id, ct));
    [HttpPost("{property}/orders")] public async Task<object> Order(string property, OrderInput input, CancellationToken ct) => Data(await business.Order(Actor, property, input, ct));
    [HttpPost("{property}/services")] public async Task<object> Service(string property,ServiceInput input,CancellationToken ct)=>Data(await business.Service(Actor,property,input,null,ct));
    [HttpPatch("{property}/services/{id}")] public async Task<object> UpdateService(string property,string id,ServiceInput input,CancellationToken ct)=>Data(await business.Service(Actor,property,input,id,ct));
    [HttpPost("{property}/service-requests")] public async Task<object> RequestService(string property,ServiceRequestInput input,CancellationToken ct)=>Data(await business.RequestService(Actor,property,input,ct));
    [HttpPost("{property}/service-requests/{id}/actions")] public async Task<object> ServiceRequestAction(string property,string id,CommunityActionInput input,CancellationToken ct)=>Data(await business.ServiceRequestAction(Actor,property,id,input,ct));
    [HttpPost("{property}/orders/{id}/actions")] public async Task<object> OrderAction(string property, string id, CommunityActionInput input, CancellationToken ct) => Data(await business.OrderAction(Actor, property, id, input, ct));
    [HttpPost("{property}/groups")] public async Task<object> Group(string property, GroupInput input, CancellationToken ct) => Data(await business.Group(Actor, property, input, ct));
    [HttpPost("{property}/groups/{id}/pledge")] public async Task<object> Pledge(string property, string id, PledgeInput input, CancellationToken ct) => Data(await business.Pledge(Actor, property, id, input, ct));
    [HttpPost("{property}/groups/{id}/actions")] public async Task<object> GroupAction(string property, string id, CommunityActionInput input, CancellationToken ct) => Data(await business.GroupAction(Actor, property, id, input, ct));
    [HttpPost("{property}/gate")] public async Task<object> Gate(string property, GateInput input, CancellationToken ct) => Data(await business.GateEntry(Actor, property, input, ct));
    [HttpPost("{property}/gate/{id}/actions")] public async Task<object> GateAction(string property, string id, CommunityActionInput input, CancellationToken ct) => Data(await business.GateAction(Actor, property, id, input, ct));
    [HttpPost("{property}/facilities")] public async Task<object> Facility(string property, FacilityInput input, CancellationToken ct) => Data(await business.Facility(Actor, property, input, ct));
    [HttpPost("{property}/facilities/{id}/actions")] public async Task<object> FacilityAction(string property, string id, CommunityActionInput input, CancellationToken ct) => Data(await business.FacilityAction(Actor, property, id, input, ct));
    [HttpPost("{property}/bookings")] public async Task<object> Booking(string property, BookingInput input, CancellationToken ct) => Data(await business.Booking(Actor, property, input, ct));
    [HttpPost("{property}/bookings/{id}/actions")] public async Task<object> BookingAction(string property, string id, CommunityActionInput input, CancellationToken ct) => Data(await business.BookingAction(Actor, property, id, input, ct));
    [HttpPost("{property}/notes")] public async Task<object> Note(string property, CommunityNoteInput input, CancellationToken ct) => Data(await business.Note(Actor, property, input, ct));
    [HttpPost("{property}/notes/{id}/actions")] public async Task<object> NoteAction(string property, string id, CommunityActionInput input, CancellationToken ct) => Data(await business.NoteAction(Actor, property, id, input, ct));
    [HttpPost("{property}/layouts")] public async Task<object> Layout(string property, LayoutInput input, CancellationToken ct) => Data(await business.Layout(Actor, property, input, ct));
    [HttpPost("{property}/layouts/{id}/actions")] public async Task<object> LayoutAction(string property, string id, CommunityActionInput input, CancellationToken ct) => Data(await business.LayoutAction(Actor, property, id, input, ct));
}
