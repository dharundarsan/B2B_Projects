using RepairLedger.Api.Models;
namespace RepairLedger.Api.Models;

public sealed record MigrationSnapshot(List<MigrationWorkspace> Workspaces);
public sealed record MigrationWorkspace(string Id, List<Property> Properties, List<Vendor> Vendors,
    List<Repair> Requests, List<Message> Messages, List<Notification> Notifications);
