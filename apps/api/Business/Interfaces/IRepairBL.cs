namespace RepairLedger.Api.Business.Interfaces;

public interface IRepairBL
{
    Task<List<Repair>> List(Actor actor, CancellationToken ct, string? search = null, string? state = null, string? priority = null, string? property = null);
    Task<Repair> Create(Actor actor, CreateRepair input, CancellationToken ct);
    Task<Repair> LinkResident(Actor actor, string id, ResidentLinkInput input, CancellationToken ct, long? revision);
    Task<Repair> Transition(Actor actor, string id, TransitionInput input, CancellationToken ct, long? revision);
    Task<Repair> Offer(Actor actor, string id, OfferInput input, CancellationToken ct, long? revision);
    Task<Repair> VendorResponse(Actor actor, string id, VendorResponseInput input, CancellationToken ct, long? revision);
    Task<Repair> SubmitEstimate(Actor actor, string id, EstimateInput input, CancellationToken ct, long? revision);
    Task<Repair> ReviewEstimate(Actor actor, string id, string estimateId, bool approved, string? note, CancellationToken ct, long? revision);
    Task<Repair> ProposeVisit(Actor actor, string id, AppointmentInput input, CancellationToken ct, long? revision);
    Task<Repair> ConfirmVisit(Actor actor, string id, string appointmentId, ConfirmationInput input, CancellationToken ct, long? revision);
    Task<Repair> StartWork(Actor actor, string id, CancellationToken ct, long? revision);
    Task<Repair> CompleteWork(Actor actor, string id, CancellationToken ct, long? revision);
    Task<Repair> Verify(Actor actor, string id, VerifyInput input, CancellationToken ct, long? revision);
    Task<Repair> Get(Actor actor, string id, CancellationToken ct);
    Task<object> Dashboard(Actor actor, CancellationToken ct);
    Task<List<Property>> Properties(Actor actor, CancellationToken ct);
    Task<Property> SaveProperty(Actor actor, PropertyInput input, string? id, CancellationToken ct);
    Task ArchiveProperty(Actor actor, string id, CancellationToken ct);
    Task<List<PropertyUnit>> Units(Actor actor, string property, CancellationToken ct);
    Task<PropertyUnit> AddUnit(Actor actor, string property, UnitInput input, CancellationToken ct);
    Task<List<Vendor>> Vendors(Actor actor, CancellationToken ct);
    Task<Vendor> InviteVendor(Actor actor, VendorInput input, CancellationToken ct);
    Task<List<Notification>> Notifications(Actor actor, CancellationToken ct);
    Task<Notification> ReadNotification(Actor actor, string id, CancellationToken ct);
    Task<List<Message>> Messages(Actor actor, string id, CancellationToken ct);
    Task<Message> SendMessage(Actor actor, string id, MessageInput input, CancellationToken ct);
}
