namespace RepairLedger.Api.DataAccess.Interfaces;

public interface IRepairDAL
{
    Task<List<Repair>> List(Actor actor, CancellationToken ct, string? search = null, string? state = null, string? priority = null, string? property = null);
    Task<Repair> Get(Actor actor, string id, CancellationToken ct);
    Task<Repair> Create(Actor actor, Repair repair, CancellationToken ct);
    Task<Repair> Mutate(Actor actor, string id, Action<Repair> change, CancellationToken ct, long? expectedRevision = null);
    Task<List<Property>> Properties(Actor actor, CancellationToken ct);
    Task<Property> SaveProperty(Actor actor, Property p, bool create, CancellationToken ct);
    Task ArchiveProperty(Actor actor, string id, CancellationToken ct);
    Task<List<Vendor>> Vendors(Actor actor, CancellationToken ct);
    Task<Vendor> SaveVendor(Actor actor, Vendor v, CancellationToken ct);
    Task<List<Notification>> Notifications(Actor actor, CancellationToken ct);
    Task<Notification> ReadNotification(Actor actor, string id, CancellationToken ct);
    Task<List<Message>> Messages(Actor actor, string id, CancellationToken ct);
    Task<Message> SendMessage(Actor actor, string id, string body, CancellationToken ct);
    Task Import(MigrationSnapshot snapshot, CancellationToken ct);
    Task<List<PropertyUnit>> Units(Actor actor, string property, CancellationToken ct);
    Task<PropertyUnit> AddUnit(Actor actor, string property, string label, CancellationToken ct);
}
