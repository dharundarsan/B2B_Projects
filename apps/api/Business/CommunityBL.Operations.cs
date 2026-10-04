using System.Text.Json;
namespace RepairLedger.Api.Business;

public sealed partial class CommunityBL
{
    public Task<CommunityGateEntry> GateEntry(Actor actor, string property, GateInput input, CancellationToken ct) => Write(actor, property, (s, d) =>
    {
        Require(actor.IsManager || (actor.IsResident || actor.Role == "watchman"), "Resident or watchman access required.", 403);
        var unit = d.Units.SingleOrDefault(u => u.Id == input.UnitId && u.Archived == 0) ?? throw new ApiException(400, "Choose a registered unit.");
        string user, occupancy;
        if (actor.IsResident)
        {
            var binding = actor.ActiveResidentOccupancies.SingleOrDefault(o => o.PropertyId == property && o.Unit == unit.Label) ?? throw new ApiException(403, "This unit is outside your active occupancy.");
            user = actor.Id; occupancy = binding.Id;
            Require(d.Agreements.Any(a => a.Kind != "master" && Active(a, Day(d)) && a.OccupancyId == occupancy && a.UnitIds.Contains(unit.Id) && Find(d.Parties, a.DebtorPartyId).UserId == user), "Ask the manager to bind your active rental agreement before registering gate entries.", 409);
        }
        else
        {
            var bindings = d.Agreements.Where(a => a.Kind != "master" && Active(a, Day(d)) && a.UnitIds.Contains(unit.Id) && a.OccupancyId != null).ToList();
            Require(bindings.Count == 1, "A single active resident lease with a bound occupancy is required for this unit.", 409);
            var binding = bindings.Single(); user = Find(d.Parties, binding.DebtorPartyId).UserId ?? throw new ApiException(409, "Bind the resident party to an account first."); occupancy = binding.OccupancyId!;
        }
        Require(input.ResidentUserId == null || input.ResidentUserId == user, "Resident account does not match this unit.");
        Require(input.OccupancyId == null || input.OccupancyId == occupancy, "Occupancy does not match this unit.");
        var expected = Instant(input.ExpectedAt); Require(DateTimeOffset.Parse(expected) >= clock.GetUtcNow().AddMinutes(-30) && DateTimeOffset.Parse(expected) <= clock.GetUtcNow().AddDays(90), "Choose an arrival within the next 90 days.");
        return s.Insert("Gate", new CommunityGateEntry { Kind = Choice(input.Kind, "visitor", "delivery", "contractor", "parcel"), Name = Text(input.Name, 200, "Visitor or delivery name"), UnitId = unit.Id, ResidentUserId = user, OccupancyId = occupancy, ExpectedAt = expected, Approval = actor.IsResident ? "approved" : "pending", UserId = actor.Id }, Now);
    }, ct);
    public Task<CommunityGateEntry> GateAction(Actor actor, string property, string id, CommunityActionInput input, CancellationToken ct) => Write(actor, property, (s, d) =>
    {
        var row = Find(d.GateEntries, id); var resident = actor.IsResident && row.ResidentUserId == actor.Id && actor.ActiveResidentOccupancies.Any(o => o.Id == row.OccupancyId && o.PropertyId == property && d.Units.Any(u => u.Id == row.UnitId && u.Label == o.Unit));
        var action = Choice(input.Action, "approve", "deny", "arrive", "depart", "accept-parcel", "receive-parcel");
        if (action is "approve" or "deny")
        {
            Require(resident || actor.IsManager, "Only the resident or manager can approve entry.", 403); Require(row.Approval == "pending" && row.Status == "expected", "This entry has already been decided.", 409); row.Approval = action == "approve" ? "approved" : "denied";
        }
        else if (action == "receive-parcel")
        {
            Require(resident, "Only the bound resident can acknowledge receipt.", 403); Require(row.Kind == "parcel" && row.Status == "accepted", "The watchman has not accepted this parcel yet.", 409); row.Status = "received"; row.ReceivedAt = Now;
        }
        else
        {
            Gate(actor); Require(row.Approval == "approved", "Resident or manager approval is required.", 409);
            if (action is "arrive" or "accept-parcel")
            {
                Require(row.Status == "expected", "This entry has already arrived.", 409);
                var timezone = TimeZoneInfo.FindSystemTimeZoneById(d.Property.Timezone);
                Require(TimeZoneInfo.ConvertTime(DateTimeOffset.Parse(row.ExpectedAt), timezone).Date == TimeZoneInfo.ConvertTime(clock.GetUtcNow(), timezone).Date, "This arrival is not expected today in the building's timezone.", 409);
                Require(d.Agreements.Any(a => a.Kind != "master" && Active(a, Day(d)) && a.OccupancyId == row.OccupancyId && a.UnitIds.Contains(row.UnitId) && Find(d.Parties, a.DebtorPartyId).UserId == row.ResidentUserId), "The resident lease is no longer active.", 409);
                if (action == "accept-parcel") { Require(row.Kind == "parcel", "Only parcels can be accepted at the desk."); row.Status = "accepted"; row.AcceptedAt = Now; }
                else { Require(row.Kind != "parcel", "Use parcel acceptance for this entry."); row.Status = "arrived"; row.ArrivedAt = Now; }
            }
            else { Require(row.Status == "arrived", "Only an arrived visitor can depart.", 409); row.Status = "departed"; row.DepartedAt = Now; }
        }
        return s.Update("Gate", row, input.Revision, "Gate." + action, Now);
    }, ct);
    public Task<CommunityFacility> Facility(Actor actor, string property, FacilityInput input, CancellationToken ct) => Write(actor, property, (s, d) =>
    {
        actor.RequireManager(); Require(input.Capacity is > 0 and <= 1000 && input.SlotMinutes is >= 15 and <= 1440, "Check the facility capacity and slot length (15–1,440 minutes).");
        return s.Insert("Facility", new CommunityFacility { Name = Text(input.Name, 200, "Facility name"), Capacity = input.Capacity, SlotMinutes = input.SlotMinutes, Price = Money(input.Price, true), Currency = Currency(input.Currency), Rules = Text(input.Rules, 2000, "Facility rules", true) }, Now);
    }, ct);
    public Task<CommunityFacility> FacilityAction(Actor actor, string property, string id, CommunityActionInput input, CancellationToken ct) => Write(actor, property, (s, d) =>
    {
        actor.RequireManager(); var row = Find(d.Facilities, id); row.Status = Choice(input.Action, "active", "paused"); return s.Update("Facility", row, input.Revision, "Facility." + input.Action, Now);
    }, ct);
    public Task<FacilityBooking> Booking(Actor actor, string property, BookingInput input, CancellationToken ct) => Write(actor, property, (s, d) =>
    {
        Buyer(actor); var facility = Find(d.Facilities, input.FacilityId); var start = Instant(input.StartsAt); var submission = Submission(input.SubmissionId);
        var previous = d.Bookings.SingleOrDefault(b => b.UserId == actor.Id && b.SubmissionId == submission);
        if (previous != null) { Require(previous.FacilityId == facility.Id && previous.StartsAt == start, "Submission ID was used for another booking.", 409); return Task.FromResult(previous); }
        var date = DateTimeOffset.Parse(start); var end = date.AddMinutes(facility.SlotMinutes).ToString("O");
        Require(facility.Status == "active" && date > clock.GetUtcNow() && date <= clock.GetUtcNow().AddDays(90), "Choose an active facility and a slot within the next 90 days.");
        var overlapping = d.Bookings.Where(b => b.FacilityId == facility.Id && b.Status == "confirmed" && Overlaps(b.StartsAt, b.EndsAt, start, end)).ToList();
        Require(!overlapping.Any(b => b.UserId == actor.Id), "You already have an overlapping booking here.", 409);
        // Count simultaneous reservations, rather than all reservations intersecting a longer slot.
        var points = overlapping.SelectMany(b => new[] { b.StartsAt, b.EndsAt }).Append(start).Where(t => string.CompareOrdinal(t, start) >= 0 && string.CompareOrdinal(t, end) < 0).Distinct();
        Require(points.All(t => overlapping.Count(b => string.CompareOrdinal(b.StartsAt, t) <= 0 && string.CompareOrdinal(t, b.EndsAt) < 0) < facility.Capacity), "This facility is fully booked during part of this slot.", 409);
        return s.Insert("Booking", new FacilityBooking { FacilityId = facility.Id, UserId = actor.Id, StartsAt = start, EndsAt = end, Price = facility.Price, Currency = facility.Currency, SubmissionId = submission }, Now);
    }, ct);
    public Task<FacilityBooking> BookingAction(Actor actor, string property, string id, CommunityActionInput input, CancellationToken ct) => Write(actor, property, (s, d) =>
    {
        Member(actor); if(!actor.IsManager) Buyer(actor); var row = Find(d.Bookings, id); Require(actor.IsManager || row.UserId == actor.Id, "This is another resident's booking.", 403);
        Require(input.Action == "cancel" && row.Status == "confirmed" && DateTimeOffset.Parse(row.StartsAt) > clock.GetUtcNow(), "Only future confirmed bookings can be cancelled.", 409);
        row.Status = "cancelled"; return s.Update("Booking", row, input.Revision, "Booking.cancelled", Now);
    }, ct);
    public Task<CommunityNote> Note(Actor actor, string property, CommunityNoteInput input, CancellationToken ct) => Write(actor, property, (s, d) =>
    {
        var kind = Choice(input.Kind, "notice", "round", "shift"); if (kind is "notice" or "round") actor.RequireManager(); else Gate(actor);
        var assigned = string.IsNullOrWhiteSpace(input.AssignedUserId) ? null : input.AssignedUserId.Trim(); Require(assigned == null || Guid.TryParse(assigned, out _), "Use a watchman account UUID.");
        return s.Insert("Note", new CommunityNote { Kind = kind, Title = Text(input.Title, 200, "Title"), Body = Text(input.Body, 2000, "Note"), AssignedUserId = kind == "round" ? assigned : null, UserId = actor.Id, Status = kind == "round" ? "open" : "posted" }, Now);
    }, ct);
    public Task<CommunityNote> NoteAction(Actor actor, string property, string id, CommunityActionInput input, CancellationToken ct) => Write(actor, property, (s, d) =>
    {
        Gate(actor); var row = Find(d.Notes, id); Require(row.Kind == "round" && (actor.IsManager || row.AssignedUserId == null || row.AssignedUserId == actor.Id), "This round is assigned to another watchman.", 403);
        row.Status = Choice(input.Action, "done", "open"); return s.Update("Note", row, input.Revision, "Round." + row.Status, Now);
    }, ct);
    public Task<CommunityLayout> Layout(Actor actor, string property, LayoutInput input, CancellationToken ct) => Write(actor, property, (s, d) =>
    {
        actor.RequireManager(); Require(input.Floor is >= -5 and <= 150, "Choose a floor between -5 and 150."); var shapes = input.Shapes ?? [];
        if(input.BlockId!=null)Find(d.Blocks,input.BlockId);
        Require(shapes.Count <= 150 && shapes.Select(x => x.Id).Distinct().Count() == shapes.Count, "Use at most 150 shapes with unique IDs.");
        foreach (var shape in shapes)
        {
            Require(Guid.TryParse(shape.Id, out _), "Each shape requires a stable UUID."); Choice(shape.Kind, "outline", "flat", "shop", "common", "stairs", "lift"); Text(shape.Label, 120, "Shape label");
            Require(shape.Points != null && shape.Points.Count is >= 3 and <= 50 && shape.Points.All(p => double.IsFinite(p.X) && double.IsFinite(p.Y) && p.X >= 0 && p.X <= 1000 && p.Y >= 0 && p.Y <= 600), "Draw polygons with 3–50 points within the 1,000 × 600 canvas.");
            var points = shape.Points!;
            var area = points.Select((p, i) => p.X * points[(i + 1) % points.Count].Y - points[(i + 1) % points.Count].X * p.Y).Sum(); Require(Math.Abs(area) >= 2, "A shape must have a nonzero area.");
            Require(shape.UnitId == null || shape.Kind is "flat" or "shop" && d.Units.Any(u => u.Id == shape.UnitId && u.Archived == 0), "Only flats and shops can link to registered units.");
            Require(shape.UnitId==null||d.Units.Any(u=>u.Id==shape.UnitId&&u.BlockId==input.BlockId&&(u.Floor==null||u.Floor==input.Floor)),"Link a flat from this block and floor only.");
        }
        var linked = shapes.Where(x => x.UnitId != null).Select(x => x.UnitId).ToArray(); Require(linked.Distinct().Count() == linked.Length, "Link each unit to one shape on this floor.");
        Require(!d.Layouts.Where(l => l.Floor != input.Floor||l.BlockId!=input.BlockId).SelectMany(l => JsonSerializer.Deserialize<List<LayoutShape>>(l.DraftJson) ?? []).Any(shape => shape.UnitId != null && linked.Contains(shape.UnitId)), "A linked unit already belongs to another floor.", 409);
        var row = d.Layouts.SingleOrDefault(l => l.Floor == input.Floor&&l.BlockId==input.BlockId); var json = JsonSerializer.Serialize(shapes); Require(json.Length <= 50000, "The layout is too large.");
        var kind=input.BlockId==null?"Layout":"BlockLayout";
        if (row == null) { Require(input.Revision == 0, "This floor no longer exists. Refresh.", 409); return s.Insert(kind, new CommunityLayout { BlockId=input.BlockId,Floor = input.Floor, Name = Text(input.Name, 200, "Floor name"), DraftJson = json, Shapes = shapes }, Now); }
        row.Name = Text(input.Name, 200, "Floor name"); row.DraftJson = json; row.Shapes = shapes; return s.Update(kind, row, input.Revision, "Layout.draft_saved", Now);
    }, ct);
    public Task<CommunityLayout> LayoutAction(Actor actor, string property, string id, CommunityActionInput input, CancellationToken ct) => Write(actor, property, (s, d) =>
    {
        actor.RequireManager(); var row = Find(d.Layouts, id); Choice(input.Action, "publish"); row.PublishedJson = row.DraftJson; row.PublishedAt = Now; row.Shapes = JsonSerializer.Deserialize<List<LayoutShape>>(row.DraftJson) ?? [];
        Require(row.Shapes.Count > 0, "Draw the floor before publishing."); return s.Update(row.BlockId==null?"Layout":"BlockLayout", row, input.Revision, "Layout.published", Now);
    }, ct);
}
