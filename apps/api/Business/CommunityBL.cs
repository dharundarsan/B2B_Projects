using System.Globalization;
using System.Text.Json;
using RepairLedger.Api.DataAccess;
using RepairLedger.Api.ExternalAPI;
namespace RepairLedger.Api.Business;

public sealed partial class CommunityBL(CommunityDAL repository, TimeProvider clock, EvidenceStorage storage)
{
    private string Now => clock.GetUtcNow().ToString("O");
    private string Today => clock.GetUtcNow().ToString("yyyy-MM-dd");
    private static void Require(bool condition, string message, int status = 400) { if (!condition) throw new ApiException(status, message); }
    private static string Text(string? value, int max, string label, bool optional = false)
    {
        var text = value?.Trim() ?? "";
        Require(text.Length <= max && (optional || text.Length > 0), $"{label} must contain {(optional ? "0" : "1")}–{max} characters."); return text;
    }
    private static decimal Money(decimal value, bool zero = false)
    { Require(value >= (zero ? 0 : 0.01m) && value <= 999999999999.99m && decimal.Round(value, 2) == value, "Enter a valid amount with at most two decimal places."); return value; }
    private static string Currency(string? value)
    { var result = value?.ToUpperInvariant() ?? ""; Require(result.Length == 3 && result.All(c => c is >= 'A' and <= 'Z'), "Use a three-letter currency code."); return result; }
    private static string Date(string? value)
    { Require(DateOnly.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _), "Use a calendar date in YYYY-MM-DD format."); return value!; }
    private static string Instant(string? value)
    { Require(DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.None, out var date) && value!.Contains('T') && (value.EndsWith('Z') || System.Text.RegularExpressions.Regex.IsMatch(value, @"[+-]\d{2}:\d{2}$")), "Use a date and time with a timezone."); return date.ToUniversalTime().ToString("O"); }
    private static string Choice(string value, params string[] options)
    { Require(options.Contains(value), "Unsupported option."); return value; }
    private static string Submission(string value)
    { Require(Guid.TryParse(value, out _), "A submission UUID is required."); return value.ToLowerInvariant(); }
    private static T Find<T>(IEnumerable<T> rows, string id) where T : CommunityRow => rows.SingleOrDefault(x => x.Id == id) ?? throw new ApiException(404, "Record not found in this building.");
    private static bool Covers(string start, string? end, string from, string to) => string.CompareOrdinal(start, from) <= 0 && (end == null || string.CompareOrdinal(end, to) >= 0);
    private static bool Overlaps(string start, string? end, string from, string? to) => (end == null || string.CompareOrdinal(from, end) < 0) && (to == null || string.CompareOrdinal(start, to) < 0);
    private string Day(CommunityData data) => TimeZoneInfo.ConvertTime(clock.GetUtcNow(), TimeZoneInfo.FindSystemTimeZoneById(data.Property.Timezone)).ToString("yyyy-MM-dd");
    private static bool Active(Ownership o, string day) => Covers(o.StartsOn, o.EndsOn, day, DateOnly.Parse(day).AddDays(1).ToString("yyyy-MM-dd"));
    private static bool Active(RentalAgreement a, string day) => a.Status == "active" && Covers(a.StartsOn, a.EndsOn, day, DateOnly.Parse(day).AddDays(1).ToString("yyyy-MM-dd"));
    private static string[] Parties(Actor actor, CommunityData data) => data.Parties.Where(p => p.UserId == actor.Id).Select(p => p.Id).ToArray();
    private string[] OwnedUnits(Actor actor, CommunityData data) => data.Ownerships.Where(o => Parties(actor, data).Contains(o.PartyId) && Active(o, Day(data))).Select(o => o.UnitId).Distinct().ToArray();
    private static string[] ResidentUnits(Actor actor, CommunityData data) => data.Units.Where(u => (actor.ResidentUnits.GetValueOrDefault(data.Property.Id) ?? []).Contains(u.Label)).Select(u => u.Id).ToArray();
    private void Access(Actor actor, CommunityData data)
    {
        var allowed = actor.CanAdmin || (actor.CommunityPropertyIds??[]).Contains(data.Property.Id) || actor.Role == "tenant" && ResidentUnits(actor, data).Length > 0 ||
            actor.Role == "watchman" && (actor.AssignedPropertyIds ?? []).Contains(data.Property.Id) ||
            actor.Role == "unit_owner" && OwnedUnits(actor, data).Length > 0 ||
            actor.Role == "operator" && data.Agreements.Any(a => a.Kind == "master" && Active(a, Day(data)) && Parties(actor, data).Contains(a.DebtorPartyId));
        Require(allowed, "You do not have access to this building.", 403);
    }
    private static void Member(Actor actor) => Require(actor.HasAdminRole || actor.Role is "member" or "tenant" or "unit_owner" or "operator", "Community member access required.", 403);
    private static void Gate(Actor actor) => Require(actor.IsManager || actor.Role == "watchman", "Assigned watchman access required.", 403);
    private bool ResidentAgreement(Actor actor, CommunityData data, RentalAgreement a) => actor.IsResident && Parties(actor, data).Contains(a.DebtorPartyId) &&
        actor.ActiveResidentOccupancies.Any(o => o.Id == a.OccupancyId && o.PropertyId == data.Property.Id && a.UnitIds.All(id => data.Units.Any(u => u.Id == id && u.Label == o.Unit)));
    private bool CanReadAgreement(Actor actor, CommunityData data, RentalAgreement a) => actor.IsManager || ResidentAgreement(actor, data, a) ||
        actor.IsOperator && (a.Kind == "master" && Parties(actor, data).Contains(a.DebtorPartyId) || Parties(actor, data).Contains(a.CreditorPartyId)) ||
        actor.IsUnitOwner && (Parties(actor, data).Contains(a.CreditorPartyId) || a.UnitIds.All(OwnedUnits(actor, data).Contains));
    private static void Buyer(Actor actor) { Member(actor); Require(actor.UserAccess!=false && actor.Context==1,"Open an enabled User view to buy or book.",403); }
    private static void Provider(Actor actor)
    { Member(actor); Require(actor.IsManager || actor.Context==3 && actor.CanSell, "Open an enabled Seller / Provider view to manage your business.",403); }
    private static void SellerAccess(Actor actor, CommunitySeller seller)
    { Provider(actor); Require(actor.IsManager || seller.UserId == actor.Id, "This store belongs to another seller.", 403); }
    private Task<T> Write<T>(Actor actor, string property, Func<CommunityDAL.Session, CommunityData, Task<T>> action, CancellationToken ct) => repository.Write(actor, property, async (session, data) => { Access(actor, data); return await action(session, data); }, ct);

    public async Task<object> Context(Actor actor, CancellationToken ct)
    {
        var context = await repository.Context(actor, Today, ct);
        var ids = actor.Role == "tenant" ? actor.ResidentUnits.Keys.ToArray() : actor.Role == "watchman" ? actor.AssignedPropertyIds ?? [] : actor.Role is "unit_owner" or "operator" ? context.Related : [];
        var properties = context.Properties.Where(p => actor.CanAdmin || ids.Contains(p.Id) || (actor.CommunityPropertyIds??[]).Contains(p.Id)).ToList();
        if (actor.Role is "unit_owner" or "operator")
            foreach (var property in properties.ToArray())
                try { Access(actor, await repository.Read(actor, property.Id, ct)); }
                catch (ApiException error) when (error.Status == 403) { properties.Remove(property); }
        return new { role = actor.Role, userId = actor.Id, userContext = actor.Context, canSwitchContext = actor.CanAdmin, properties };
    }
    public async Task<CommunityData> Read(Actor actor, string property, CancellationToken ct)
    {
        var data = await repository.Read(actor, property, ct); Access(actor, data);
        data.UserContext=actor.Context; data.CanManage = actor.IsManager; data.CanGate = actor.IsManager || actor.Role == "watchman"; data.UserId = actor.Id;
        data.MyPartyIds = Parties(actor, data); data.MyUnitIds = ResidentUnits(actor, data).Concat(OwnedUnits(actor, data)).Distinct().ToArray();
        data.Role = actor.IsManager || !actor.CanAdmin ? actor.Role : OwnedUnits(actor, data).Length > 0 ? "unit_owner" :
            data.Agreements.Any(a => a.Kind == "master" && Active(a, Day(data)) && data.MyPartyIds.Contains(a.DebtorPartyId)) ? "operator" :
            ResidentUnits(actor, data).Length > 0 ? "tenant" : "member";
        foreach (var group in data.Groups) { group.Committed = data.Pledges.Where(p => p.GroupId == group.Id).Sum(p => p.Quantity); group.MyQuantity = data.Pledges.SingleOrDefault(p => p.GroupId == group.Id && p.UserId == actor.Id)?.Quantity ?? 0; }
        foreach (var layout in data.Layouts) layout.Shapes = JsonSerializer.Deserialize<List<LayoutShape>>(actor.IsManager ? layout.DraftJson : layout.PublishedJson) ?? [];
        foreach(var delivery in data.Deliveries)
        {
            var seller=data.Sellers.FirstOrDefault(s=>s.Id==delivery.SellerId);
            delivery.Destination=seller!=null?$"{seller.Name} · {seller.Pickup}":delivery.UnitId!=null?$"Flat {data.Units.FirstOrDefault(u=>u.Id==delivery.UnitId)?.Label}":"Community gate pickup";
        }
        if (!actor.IsManager)
        {
            data.Deliveries=data.Deliveries.Where(x=>actor.Role=="watchman"||x.UserId==actor.Id&&(actor.Context==3?x.SellerId!=null:x.SellerId==null)).ToList();
            data.Property.OpenRequests = 0; data.Property.UrgentRequests = 0;
            data.Agreements = data.Agreements.Where(a => CanReadAgreement(actor, data, a)).ToList();
            data.Charges = data.Charges.Where(c => data.Agreements.Any(a => a.Id == c.AgreementId)).ToList();
            data.Payments = data.Payments.Where(p => data.Charges.Any(c => c.Id == p.ChargeId)).ToList();
            data.Expenses = data.Expenses.Where(e => actor.IsUnitOwner && e.Scope == "unit" && data.MyUnitIds.Contains(e.UnitId) ||
                actor.IsOperator && e.Scope == "operator" && data.MyPartyIds.Contains(e.PartyId)).ToList();
            foreach (var expense in data.Expenses) expense.Allocations = expense.Allocations.Where(a => data.MyPartyIds.Contains(a.PartyId)).ToList();
            data.Ownerships = data.Ownerships.Where(o => data.MyUnitIds.Contains(o.UnitId) && actor.IsUnitOwner).ToList();
            var visibleParties = data.Agreements.SelectMany(a => new[] { a.DebtorPartyId, a.CreditorPartyId }).Concat(data.Ownerships.Select(o => o.PartyId)).Concat(data.MyPartyIds).ToHashSet();
            data.Parties = data.Parties.Where(p => visibleParties.Contains(p.Id)).ToList();
            foreach (var p in data.Parties.Where(p => p.UserId != actor.Id)) p.UserId = null;
            data.Sellers = data.Sellers.Where(s => s.Status == "approved" || s.UserId == actor.Id).ToList();
            data.Products = data.Products.Where(p => data.Sellers.Any(s => s.Id == p.SellerId && (s.Status == "approved" && p.Status == "active" || s.UserId == actor.Id))).ToList();
            data.Services = data.Services.Where(p => data.Sellers.Any(s => s.Id == p.SellerId && (s.Status == "approved" && p.Status == "active" || s.UserId == actor.Id))).ToList();
            data.ServiceRequests=data.ServiceRequests.Where(r=>r.UserId==actor.Id||actor.Context==3&&data.Sellers.Any(s=>s.Id==r.SellerId&&s.UserId==actor.Id&&actor.CanSell)).ToList();
            data.Orders = data.Orders.Where(o => o.UserId == actor.Id || actor.Context==3 && data.Sellers.Any(s => s.Id == o.SellerId && s.UserId == actor.Id && actor.CanSell)).ToList();
            data.GateEntries = data.GateEntries.Where(g => actor.Role == "watchman" || g.ResidentUserId == actor.Id && actor.ActiveResidentOccupancies.Any(o => o.Id == g.OccupancyId)).ToList();
            data.Bookings = data.Bookings.Where(b => b.UserId == actor.Id).ToList();
            data.Notes = data.Notes.Where(n => n.Kind == "notice" || actor.Role == "watchman" && (n.Kind == "shift" || n.Kind == "round" && (n.AssignedUserId == actor.Id || n.AssignedUserId == null))).ToList();
            data.Layouts = data.Layouts.Where(l => l.PublishedAt != null).ToList(); data.Audit = [];
        }
        data.Receipts = data.Receipts.Where(r => data.Expenses.Any(e => e.Id == r.ExpenseId)).ToList();
        if(actor.Context==3)
        {
            data.Sellers=data.Sellers.Where(s=>s.UserId==actor.Id).ToList();var stores=data.Sellers.Select(s=>s.Id).ToHashSet();
            data.Products=data.Products.Where(p=>stores.Contains(p.SellerId)).ToList();data.Services=data.Services.Where(p=>stores.Contains(p.SellerId)).ToList();
            data.Orders=data.Orders.Where(o=>stores.Contains(o.SellerId)).ToList();data.ServiceRequests=data.ServiceRequests.Where(r=>stores.Contains(r.SellerId)).ToList();data.Groups=data.Groups.Where(g=>stores.Contains(g.SellerId)).ToList();
            data.Facilities=[];data.Notes=[];data.Layouts=[];data.Blocks=[];data.Audit=[];data.Units=[];data.MyPartyIds=[];data.MyUnitIds=[];data.Parties=[];data.Ownerships=[];data.Agreements=[];data.Charges=[];data.Payments=[];data.Expenses=[];data.Receipts=[];data.GateEntries=[];data.Bookings=[];
        }
        if (actor.Role == "watchman")
        {
            data.MyPartyIds = []; data.MyUnitIds = []; data.Parties = []; data.Sellers = []; data.Products = []; data.Groups = [];
            data.Orders = []; data.Services=[];data.ServiceRequests=[];data.Facilities = []; data.Bookings = [];
        }
        return data;
    }
    public Task<CommunityParty> Party(Actor actor, string property, PartyInput input, CancellationToken ct) => Write(actor, property, (s, d) =>
    {
        actor.RequireManager(); var user = string.IsNullOrWhiteSpace(input.UserId) ? null : input.UserId.Trim();
        Require(user == null || Guid.TryParse(user, out _) || actor.IsDemo && user == actor.Id, "Bind a party to a valid account UUID.");
        Require(user == null || !d.Parties.Any(p => p.UserId == user), "This account already has a party in this building.", 409);
        return s.Insert("Party", new CommunityParty { Name = Text(input.Name, 200, "Party name"), Kind = Choice(input.Kind, "person", "company"), UserId = user }, Now);
    }, ct);
}
