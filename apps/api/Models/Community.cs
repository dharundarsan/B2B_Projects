using System.Text.Json.Serialization;
namespace RepairLedger.Api.Models;

public class CommunityRow
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    [JsonIgnore] public string WorkspaceId { get; set; } = "";
    public string PropertyId { get; set; } = "";
    public long Revision { get; set; }
    public string CreatedAt { get; set; } = "";
}
public sealed class CommunityParty : CommunityRow
{
    public string Name { get; set; } = "";
    public string Kind { get; set; } = "person";
    public string? UserId { get; set; }
}
public sealed class Ownership : CommunityRow
{
    public string UnitId { get; set; } = "";
    public string PartyId { get; set; } = "";
    public decimal Share { get; set; }
    public decimal IncomeShare { get; set; }
    public decimal ExpenseShare { get; set; }
    public string StartsOn { get; set; } = "";
    public string? EndsOn { get; set; }
}
public sealed class RentalAgreement : CommunityRow
{
    public string Kind { get; set; } = "direct";
    public string DebtorPartyId { get; set; } = "";
    public string CreditorPartyId { get; set; } = "";
    public string? ParentId { get; set; }
    public string? OccupancyId { get; set; }
    public string StartsOn { get; set; } = "";
    public string EndsOn { get; set; } = "";
    public decimal Rent { get; set; }
    public decimal Deposit { get; set; }
    public string Currency { get; set; } = "INR";
    public int DueDay { get; set; } = 5;
    public string Status { get; set; } = "active";
    public string[] UnitIds { get; set; } = [];
}
public sealed record AgreementUnit(string AgreementId, string UnitId);
public sealed class CommunityCharge : CommunityRow
{
    public string AgreementId { get; set; } = "";
    public string Kind { get; set; } = "rent";
    public string Period { get; set; } = "";
    public string DueOn { get; set; } = "";
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "INR";
    public decimal VerifiedPaid { get; set; }
}
public sealed class CommunityPayment : CommunityRow
{
    public string ChargeId { get; set; } = "";
    public decimal Amount { get; set; }
    public string Reference { get; set; } = "";
    public string Status { get; set; } = "pending";
    public string UserId { get; set; } = "";
    public string SubmissionId { get; set; } = "";
    public string? VerifiedBy { get; set; }
}
public sealed class CommunityExpense : CommunityRow
{
    public string Scope { get; set; } = "community";
    public string? UnitId { get; set; }
    public string? PartyId { get; set; }
    public string Category { get; set; } = "";
    public string Description { get; set; } = "";
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "INR";
    public string IncurredOn { get; set; } = "";
    public string PaidStatus { get; set; } = "unpaid";
    public string UserId { get; set; } = "";
    public List<ExpenseAllocation> Allocations { get; set; } = [];
}
public sealed class ExpenseAllocation
{
    public string ExpenseId { get; set; } = "";
    public string PartyId { get; set; } = "";
    public decimal Amount { get; set; }
}
public sealed class CommunitySeller : CommunityRow
{
    public string UserId { get; set; } = "";
    public string Name { get; set; } = "";
    public string Kind { get; set; } = "resident";
    public string Status { get; set; } = "pending";
    public string Pickup { get; set; } = "";
}
public sealed class CommunityProduct : CommunityRow
{
    public string SellerId { get; set; } = "";
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public string Kind { get; set; } = "product";
    public string Ingredients { get; set; } = "";
    public string Allergens { get; set; } = "";
    public decimal Price { get; set; }
    public string Currency { get; set; } = "INR";
    public int Stock { get; set; }
    public string Status { get; set; } = "active";
}
public sealed class CommunityOrder : CommunityRow
{
    public string ProductId { get; set; } = "";
    public string SellerId { get; set; } = "";
    public string UserId { get; set; } = "";
    public string? GroupId { get; set; }
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public string Currency { get; set; } = "INR";
    public string Status { get; set; } = "placed";
    public string PaymentStatus { get; set; } = "unpaid";
    public string SubmissionId { get; set; } = "";
}
public sealed class CommunityService : CommunityRow
{
    public string SellerId { get; set; } = "";
    public string Name { get; set; } = "";
    public string Category { get; set; } = "";
    public string Description { get; set; } = "";
    public decimal Price { get; set; }
    public string Currency { get; set; } = "INR";
    public string PriceUnit { get; set; } = "visit";
    public string Status { get; set; } = "active";
}
public sealed class CommunityServiceRequest : CommunityRow
{
    public string ServiceId { get; set; } = "";
    public string SellerId { get; set; } = "";
    public string UserId { get; set; } = "";
    public string ServiceName { get; set; } = "";
    public string Description { get; set; } = "";
    public string PreferredAt { get; set; } = "";
    public decimal Price { get; set; }
    public string Currency { get; set; } = "INR";
    public string PriceUnit { get; set; } = "visit";
    public string Status { get; set; } = "requested";
    public string SubmissionId { get; set; } = "";
}
public sealed class GroupBuy : CommunityRow
{
    public string ProductId { get; set; } = "";
    public string SellerId { get; set; } = "";
    public decimal UnitPrice { get; set; }
    public string Currency { get; set; } = "INR";
    public int Minimum { get; set; }
    public int Maximum { get; set; }
    public string ClosesAt { get; set; } = "";
    public string Pickup { get; set; } = "";
    public string Status { get; set; } = "open";
    public int Committed { get; set; }
    public int MyQuantity { get; set; }
}
public sealed class GroupPledge : CommunityRow
{
    public string GroupId { get; set; } = "";
    public string UserId { get; set; } = "";
    public int Quantity { get; set; }
}
public sealed class CommunityGateEntry : CommunityRow
{
    public string Kind { get; set; } = "visitor";
    public string Name { get; set; } = "";
    public string UnitId { get; set; } = "";
    [JsonIgnore] public string OccupancyId { get; set; } = "";
    [JsonIgnore] public string ResidentUserId { get; set; } = "";
    public string ExpectedAt { get; set; } = "";
    public string Approval { get; set; } = "pending";
    public string Status { get; set; } = "expected";
    public string? ArrivedAt { get; set; }
    public string? DepartedAt { get; set; }
    public string? AcceptedAt { get; set; }
    public string? ReceivedAt { get; set; }
    public string UserId { get; set; } = "";
}
public sealed class CommunityFacility : CommunityRow
{
    public string Name { get; set; } = "";
    public int Capacity { get; set; } = 1;
    public int SlotMinutes { get; set; } = 60;
    public decimal Price { get; set; }
    public string Currency { get; set; } = "INR";
    public string Rules { get; set; } = "";
    public string Status { get; set; } = "active";
}
public sealed class FacilityBooking : CommunityRow
{
    public string FacilityId { get; set; } = "";
    public string UserId { get; set; } = "";
    public string StartsAt { get; set; } = "";
    public string EndsAt { get; set; } = "";
    public string Status { get; set; } = "confirmed";
    public decimal Price { get; set; }
    public string Currency { get; set; } = "INR";
    public string SubmissionId { get; set; } = "";
}
public sealed class CommunityNote : CommunityRow
{
    public string Kind { get; set; } = "notice";
    public string Title { get; set; } = "";
    public string Body { get; set; } = "";
    public string UserId { get; set; } = "";
    public string? AssignedUserId { get; set; }
    public string Status { get; set; } = "open";
}
public sealed class CommunityLayout : CommunityRow
{
    public string? BlockId { get; set; }
    public int Floor { get; set; }
    public string Name { get; set; } = "";
    [JsonIgnore] public string DraftJson { get; set; } = "[]";
    [JsonIgnore] public string PublishedJson { get; set; } = "[]";
    public string? PublishedAt { get; set; }
    public List<LayoutShape> Shapes { get; set; } = [];
}
public sealed record LayoutPoint(double X, double Y);
public sealed record LayoutShape(string Id, string Kind, string Label, string? UnitId, List<LayoutPoint> Points);
public sealed class CommunityAudit : CommunityRow
{
    public string UserId { get; set; } = "";
    public string EntityId { get; set; } = "";
    public string Action { get; set; } = "";
}
public sealed class CommunityReceipt : CommunityRow
{
    public string ExpenseId { get; set; } = "";
    [JsonIgnore] public string Path { get; set; } = "";
    public string Name { get; set; } = "";
    public string ContentType { get; set; } = "";
    public long Size { get; set; }
    public string Status { get; set; } = "uploading";
}
public sealed class CommunityBlock : CommunityRow { public string Name { get; set; } = ""; }
public sealed class CommunityDelivery : CommunityRow
{
    public string RecipientName { get; set; } = "Community member";
    public string Destination { get; set; } = "Community gate pickup";
    public string UserId { get; set; } = "";
    public string? SellerId { get; set; }
    public string? UnitId { get; set; }
    public string Name { get; set; } = "";
    public string Reference { get; set; } = "";
    public string Notes { get; set; } = "";
    public int Packages { get; set; }
    public bool Bulk { get; set; }
    public string ExpectedAt { get; set; } = "";
    public string Approval { get; set; } = "pending";
    public string Status { get; set; } = "expected";
    public string? AcceptedAt { get; set; }
    public string? ReceivedAt { get; set; }
}
public sealed class CommunityData
{
    public int UserContext { get; set; }
    public string Role { get; set; } = "";
    public Property Property { get; set; } = new();
    public List<PropertyUnit> Units { get; set; } = [];
    public List<CommunityBlock> Blocks { get; set; } = [];
    public List<CommunityDelivery> Deliveries { get; set; } = [];
    public bool CanManage { get; set; }
    public bool CanGate { get; set; }
    public string UserId { get; set; } = "";
    public string[] MyPartyIds { get; set; } = [];
    public string[] MyUnitIds { get; set; } = [];
    public List<CommunityParty> Parties { get; set; } = [];
    public List<Ownership> Ownerships { get; set; } = [];
    public List<RentalAgreement> Agreements { get; set; } = [];
    public List<CommunityCharge> Charges { get; set; } = [];
    public List<CommunityPayment> Payments { get; set; } = [];
    public List<CommunityExpense> Expenses { get; set; } = [];
    public List<CommunitySeller> Sellers { get; set; } = [];
    public List<CommunityProduct> Products { get; set; } = [];
    public List<CommunityOrder> Orders { get; set; } = [];
    public List<CommunityService> Services { get; set; } = [];
    public List<CommunityServiceRequest> ServiceRequests { get; set; } = [];
    public List<GroupBuy> Groups { get; set; } = [];
    [JsonIgnore] public List<GroupPledge> Pledges { get; set; } = [];
    public List<CommunityGateEntry> GateEntries { get; set; } = [];
    public List<CommunityFacility> Facilities { get; set; } = [];
    public List<FacilityBooking> Bookings { get; set; } = [];
    public List<CommunityNote> Notes { get; set; } = [];
    public List<CommunityLayout> Layouts { get; set; } = [];
    public List<CommunityAudit> Audit { get; set; } = [];
    public List<CommunityReceipt> Receipts { get; set; } = [];
}
