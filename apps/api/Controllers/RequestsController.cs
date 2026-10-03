using Microsoft.AspNetCore.Mvc;
namespace RepairLedger.Api.Controllers;

[Route("api/requests")]
public sealed class RequestsController(IRepairBL business, Actor actor) : RepairLedgerController(actor)
{
    [HttpGet]
    public async Task<object> List(CancellationToken ct, [FromQuery] string? search = null, [FromQuery] string? state = null,
        [FromQuery] string? priority = null, [FromQuery] string? property = null) => Data(await business.List(Actor, ct, search, state, priority, property));
    [HttpGet("{id}")]
    public async Task<object> Get(string id, CancellationToken ct)
    { var repair = await business.Get(Actor, id, ct); Response.Headers.ETag = $"\"{repair.Revision}\""; return Data(repair); }
    [HttpPost]
    public async Task<object> Create(CreateRepair input, CancellationToken ct) => Data(await business.Create(Actor, input, ct));
    [HttpPost("{id}/transition")]
    public async Task<object> Transition(string id, TransitionInput input, CancellationToken ct) => Data(await business.Transition(Actor, id, input, ct, Revision()));
    [HttpPost("{id}/offer")]
    public async Task<object> Offer(string id, OfferInput input, CancellationToken ct) => Data(await business.Offer(Actor, id, input, ct, Revision()));
    [HttpPost("{id}/vendor-response")]
    public async Task<object> VendorResponse(string id, VendorResponseInput input, CancellationToken ct) => Data(await business.VendorResponse(Actor, id, input, ct, Revision()));
    [HttpPost("{id}/estimates")]
    public async Task<object> Estimate(string id, EstimateInput input, CancellationToken ct) => Data((await business.SubmitEstimate(Actor, id, input, ct, Revision())).Estimate);
    [HttpPost("{id}/estimates/{estimateId}/approve")]
    public async Task<object> Approve(string id, string estimateId, CancellationToken ct) => Data(await business.ReviewEstimate(Actor, id, estimateId, true, null, ct, Revision()));
    [HttpPost("{id}/estimates/{estimateId}/request-changes")]
    public async Task<object> RequestChanges(string id, string estimateId, NoteInput input, CancellationToken ct) => Data(await business.ReviewEstimate(Actor, id, estimateId, false, input.Note, ct, Revision()));
    [HttpPost("{id}/appointments")]
    public async Task<object> ProposeVisit(string id, AppointmentInput input, CancellationToken ct) => Data(await business.ProposeVisit(Actor, id, input, ct, Revision()));
    [HttpPost("{id}/appointments/{appointmentId}/confirm")]
    public async Task<object> ConfirmVisit(string id, string appointmentId, ConfirmationInput input, CancellationToken ct) => Data(await business.ConfirmVisit(Actor, id, appointmentId, input, ct, Revision()));
    [HttpPost("{id}/start-work")]
    public async Task<object> StartWork(string id, CancellationToken ct) => Data(await business.StartWork(Actor, id, ct, Revision()));
    [HttpPost("{id}/complete-work")]
    public async Task<object> CompleteWork(string id, CancellationToken ct) => Data(await business.CompleteWork(Actor, id, ct, Revision()));
    [HttpPost("{id}/verify")]
    public async Task<object> Verify(string id, VerifyInput input, CancellationToken ct) => Data(await business.Verify(Actor, id, input, ct, Revision()));
    [HttpGet("{id}/messages")]
    public async Task<object> Messages(string id, CancellationToken ct) => Data(await business.Messages(Actor, id, ct));
    [HttpPost("{id}/messages")]
    public async Task<object> Message(string id, MessageInput input, CancellationToken ct) => Data(await business.SendMessage(Actor, id, input, ct));
}
