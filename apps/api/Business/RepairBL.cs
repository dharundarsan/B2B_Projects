using System.Globalization;
using System.Net.Mail;



namespace RepairLedger.Api.Business;

public sealed class RepairBL(IRepairDAL repository) : IRepairBL
{
    public static string Text(string? value, string field, int min = 1, int max = 1000) => Helpers.ValidatorHelper.Text(value, field, min, max);
    public static TimeZoneInfo Zone(string? value) => Helpers.CommonHelper.Zone(value);
    public static Property PropertyFrom(PropertyInput input, string? id = null)
    {
        if (input.Units is < 1 or > 10000) throw new ApiException(400, "Units must be between 1 and 10000.");
        Zone(input.Timezone);
        return new Property { Id = id ?? Guid.NewGuid().ToString("N"), Name = Text(input.Name, "Name", 2, 160), Address = Text(input.Address, "Address", 4, 500), Units = input.Units, Timezone = input.Timezone };
    }
    public static Vendor VendorFrom(VendorInput input)
    {
        var email = Text(input.Email, "Email", 3, 254);
        if (!MailAddress.TryCreate(email, out var address) || address.Address != email) throw new ApiException(400, "A valid email address is required.");
        return new Vendor { Id = Guid.NewGuid().ToString("N"), Name = Text(input.Name, "Name", 2, 160), Email = email, Trade = Text(input.Trade, "Trade", 2, 100), Phone = Text(input.Phone, "Phone", 0, 60) };
    }
    public async Task<Repair> Create(Actor actor, CreateRepair input, CancellationToken ct)
    {
        if (actor.Role == "vendor") throw new ApiException(403, "Vendors cannot report resident repairs.");
        var property = (await repository.Properties(actor, ct)).SingleOrDefault(p => input.PropertyId != null ? p.Id == input.PropertyId : p.Name == input.Property);
        if (property == null) throw new ApiException(400, "Select an active property in your workspace.");
        var unit = Text(input.Unit, "Unit", 1, 40);
        if (!actor.IsManager && (!actor.PropertyUnits.TryGetValue(property.Id, out var units) || !units.Contains(unit))) throw new ApiException(403, "You can only report repairs for your assigned unit.");
        if (input.Priority is not ("routine" or "urgent")) throw new ApiException(400, "Invalid priority.");
        var safety = input.SafetyAnswers ?? [];
        if (safety.Count > 20 || safety.Any(x => x.Key.Length > 80 || x.Value == null || x.Value.Length > 200)) throw new ApiException(400, "Invalid safety answers.");
        var category = Text(input.Category, "Category", 2, 100);
        bool Yes(string key) => safety.TryGetValue(key, out var value) && value.Equals("yes", StringComparison.OrdinalIgnoreCase);
        var urgent = input.Priority == "urgent" || category.Equals("Plumbing", StringComparison.OrdinalIgnoreCase) && (Yes("waterFlowing") || Yes("waterNearElectricity")) || category.Equals("Electrical", StringComparison.OrdinalIgnoreCase) && Yes("sparksOrSmoke");
        if (!string.IsNullOrEmpty(input.PhotoUrl) && (!actor.IsDemo || !input.PhotoUrl.StartsWith('/') || input.PhotoUrl.StartsWith("//", StringComparison.Ordinal))) throw new ApiException(400, "Use private evidence uploads instead of external photo URLs.");
        var r = new Repair
        {
            Id = "RL-" + Guid.NewGuid().ToString("N"),
            WorkspaceId = actor.WorkspaceId,
            Title = Text(input.Title, "Title", 3, 200),
            Property = property.Name,
            PropertyId = property.Id,
            Unit = unit,
            Resident = Text(input.Resident, "Resident", 1, 160),
            Category = category,
            Description = Text(input.Description, "Description", 3, 4000),
            Priority = urgent ? "urgent" : "routine",
            State = urgent ? "urgent" : "submitted",
            Language = Text(input.Language, "Language", 1, 100),
            Access = Text(input.Access, "Access", 1, 500),
            AccessNotes = Text(input.AccessNotes, "Access notes", 0, 1000),
            PreferredWindow = Text(input.PreferredWindow, "Preferred window", 0, 200),
            Timezone = property.Timezone,
            SafetyAnswers = safety,
            PhotoUrl = input.PhotoUrl
        };
        Event(r, actor, "received", "Repair reported", r.Description);
        return await repository.Create(actor, r, ct);
    }
    public static void Event(Repair r, Actor actor, string type, string label, string detail)
        => r.Events.Add(new Activity { RequestId = r.Id, Type = type, Label = label, Detail = detail, Actor = actor.Email });
    private static void Guard(bool condition, string message) { if (!condition) throw new ApiException(409, message); }
    private static void Active(Repair r) => Guard(r.State is not ("closed" or "cancelled" or "verification" or "completed" or "invoice_review"), "This repair is not available for this action.");
    private static void Accepted(Repair r) => Guard(r.VendorDecision == "accepted", "The vendor must accept the offer first.");
    private static void Approved(Repair r) => Guard(r.Estimate?.Status == "approved", "A manager must approve the latest quote first.");
    private static readonly Dictionary<string, string[]> Transitions = new()
    {
        ["draft"] = ["submitted", "cancelled"],
        ["submitted"] = ["acknowledged", "urgent", "waiting", "cancelled"],
        ["urgent"] = ["acknowledged", "waiting", "cancelled"],
        ["acknowledged"] = ["waiting", "cancelled"],
        ["assigned"] = ["waiting", "acknowledged", "cancelled"],
        ["scheduled"] = ["waiting", "assigned", "cancelled"],
        ["approved"] = ["waiting", "cancelled"],
        ["waiting"] = ["acknowledged", "assigned", "cancelled"],
        ["in_progress"] = ["waiting", "cancelled"],
        ["completed"] = ["verification", "invoice_review"],
        ["verification"] = [],
        ["invoice_review"] = ["waiting"],
        ["closed"] = [],
        ["cancelled"] = []
    };
    public Task<Repair> Transition(Actor actor, string id, TransitionInput input, CancellationToken ct, long? revision)
    {
        actor.RequireManager(); Text(input.Note, "Note", 0, 1000);
        return repository.Mutate(actor, id, r =>
        {
            Guard(Transitions.TryGetValue(r.State, out var allowed) && allowed.Contains(input.State), "Use the dedicated assignment, quote, visit, work or resident-verification action for this state.");
            if (input.State == "assigned") Accepted(r);
            r.State = input.State; r.NextAction = input.State == "waiting" ? "Follow up on the outstanding detail" : input.State == "cancelled" ? "No further action" : "Review repair";
            if (input.State == "cancelled")
            {
                foreach (var visit in r.Appointments.Where(x => x.Status != "cancelled")) visit.Status = "cancelled";
                foreach (var offer in r.Offers.Where(x => x.Status is "pending" or "accepted")) offer.Status = "cancelled";
            }
            Event(r, actor, input.State, "Repair status updated", input.Note ?? input.State);
        }, ct, revision);
    }
    public async Task<Repair> Offer(Actor actor, string id, OfferInput input, CancellationToken ct, long? revision)
    {
        actor.RequireManager(); var vendor = (await repository.Vendors(actor, ct)).SingleOrDefault(v => v.Id == input.VendorId) ?? throw new ApiException(404, "Vendor not found.");
        Text(input.Note, "Note", 0, 1000); Text(input.PreferredWindow, "Preferred window", 0, 200);
        return await repository.Mutate(actor, id, r =>
        {
            Active(r); Guard(r.State != "in_progress", "Cannot reassign work in progress.");
            Guard(r.Estimate == null, "A quoted repair cannot be reassigned. Cancel it and create a linked follow-up to preserve vendor scope history.");
            Guard(r.AssignedVendorId != vendor.Id || r.VendorDecision != "pending", "This vendor already has a pending offer.");
            foreach (var a in r.Appointments) a.Status = "cancelled";
            foreach (var previous in r.Offers.Where(x => x.Status is "pending" or "accepted")) previous.Status = "superseded";
            r.Offers.Add(new VendorOffer
            {
                RequestId = id,
                VendorId = vendor.Id,
                Sequence = (r.Offers.LastOrDefault()?.Sequence ?? 0) + 1,
                OfferedAt = DateTimeOffset.UtcNow.ToString("O"),
                OfferedBy = actor.Id,
                Note = input.Note
            });
            r.AssignedVendorId = vendor.Id; r.AssignedVendorName = vendor.Name; r.VendorDecision = "pending";
            r.State = "assigned"; r.NextAction = "Await vendor response"; r.PreferredWindow = input.PreferredWindow ?? r.PreferredWindow;
            Event(r, actor, "offer", "Vendor offer recorded", $"{vendor.Name} · {input.Note}");
        }, ct, revision);
    }
    public Task<Repair> VendorResponse(Actor actor, string id, VendorResponseInput input, CancellationToken ct, long? revision)
    {
        actor.RequireVendor(); if (input.Decision is not ("accepted" or "declined")) throw new ApiException(400, "Decision must be accepted or declined.");
        Text(input.Reason, "Reason", 0, 1000);
        return repository.Mutate(actor, id, r =>
        {
            Guard(r.AssignedVendorId == input.VendorId && (actor.IsDemo || actor.VendorId == input.VendorId) && r.VendorDecision == "pending", "No matching pending offer."); Active(r);
            var offer = r.Offers.LastOrDefault(); Guard(offer?.Status == "pending" && offer.VendorId == input.VendorId, "No matching pending offer.");
            offer!.Status = input.Decision; offer.RespondedAt = DateTimeOffset.UtcNow.ToString("O"); offer.ResponseBy = actor.Id; offer.ResponseNote = input.Reason;
            r.VendorDecision = input.Decision; r.State = input.Decision == "accepted" ? "assigned" : "acknowledged";
            r.NextAction = input.Decision == "accepted" ? "Submit estimate" : "Find another vendor";
            Event(r, actor, "vendor-response", $"Vendor {input.Decision} offer", input.Reason ?? input.Decision);
        }, ct, revision);
    }
    public Task<Repair> SubmitEstimate(Actor actor, string id, EstimateInput input, CancellationToken ct, long? revision)
    {
        actor.RequireVendor(); var scope = Text(input.Scope, "Scope", 3, 4000);
        var currency = Helpers.CommonHelper.Currency(input.Currency);
        if (new[] { input.Labor, input.Parts, input.Tax }.Any(x => x < 0 || x > 10000000 || decimal.Round(x, 2) != x)) throw new ApiException(400, "Amounts must be non-negative with at most two decimal places and at most 10,000,000.");
        return repository.Mutate(actor, id, r =>
        {
            Active(r); Guard(r.State != "in_progress", "Work has already started."); Accepted(r);
            Guard(r.Estimate == null || r.Estimate.Status == "changes_requested", "Only a quote returned for changes can be revised.");
            if (r.Estimate != null) Guard(r.Estimate.Currency == currency, "Quote revisions must keep the original currency.");
            r.Estimates.Add(new Estimate { RequestId = id, VendorId = r.AssignedVendorId, Currency = currency, Version = (r.Estimate?.Version ?? 0) + 1, Scope = scope, Labor = input.Labor, Parts = input.Parts, Tax = input.Tax, Total = input.Labor + input.Parts + input.Tax });
            r.NextAction = "Review estimate"; Event(r, actor, "estimate", "Estimate submitted", $"Version {r.Estimate!.Version} · {r.Estimate.Total}");
        }, ct, revision);
    }
    public Task<Repair> ReviewEstimate(Actor actor, string id, string estimateId, bool approved, string? note, CancellationToken ct, long? revision)
    {
        actor.RequireManager(); if (!approved) Text(note, "Change request", 3, 1000);
        return repository.Mutate(actor, id, r =>
        {
            Active(r); var e = r.Estimate; Guard(e?.Id == estimateId && e.Status == "submitted", "Only the latest submitted quote can be reviewed.");
            e!.Status = approved ? "approved" : "changes_requested"; e.ApprovedAt = approved ? DateTimeOffset.UtcNow.ToString("O") : null; e.ApprovedBy = approved ? actor.Id : null;
            r.NextAction = approved ? "Schedule approved work" : "Await revised estimate"; Event(r, actor, "estimate-review", approved ? "Estimate approved" : "Estimate changes requested", note ?? e.Scope);
        }, ct, revision);
    }
    public Task<Repair> ProposeVisit(Actor actor, string id, AppointmentInput input, CancellationToken ct, long? revision)
    {
        actor.RequireManager(); var zone = Zone(input.Timezone);
        if (!DateTime.TryParseExact(input.LocalStart, "yyyy-MM-dd'T'HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var local)) throw new ApiException(400, "Local start must be YYYY-MM-DDTHH:mm.");
        if (zone.IsInvalidTime(local) || zone.IsAmbiguousTime(local)) throw new ApiException(400, "This local time is invalid or ambiguous due to daylight saving. Choose another time.");
        if (input.DurationMinutes is < 15 or > 480) throw new ApiException(400, "Visit duration must be 15–480 minutes.");
        var start = new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(local, DateTimeKind.Unspecified), zone));
        if (start <= DateTimeOffset.UtcNow) throw new ApiException(400, "Choose a future visit time.");
        return repository.Mutate(actor, id, r =>
        {
            Active(r); Guard(r.State != "in_progress", "Work has already started."); Accepted(r); Approved(r);
            Guard(input.Timezone == r.Timezone, "Use the property's timezone.");
            foreach (var a in r.Appointments) a.Status = "cancelled";
            r.Appointments.Add(new Appointment { RequestId = id, StartsAt = start.ToString("O"), EndsAt = start.AddMinutes(input.DurationMinutes).ToString("O"), Timezone = input.Timezone });
            r.State = "scheduled"; r.NextAction = "Await resident and vendor confirmation"; Event(r, actor, "visit", "Visit proposed", $"{input.LocalStart} · {input.Timezone}");
        }, ct, revision);
    }
    public Task<Repair> ConfirmVisit(Actor actor, string id, string appointmentId, ConfirmationInput input, CancellationToken ct, long? revision)
    {
        var confirmed = input.Confirmed ?? throw new ApiException(400, "Confirmed must be explicitly true or false.");
        if (actor.Role is not ("tenant" or "vendor" or "demo")) throw new ApiException(403, "The resident or assigned vendor must confirm.");
        var party = actor.IsDemo ? input.Party : actor.Role == "tenant" ? "resident" : "vendor";
        if (party is not ("resident" or "vendor")) throw new ApiException(400, "Select resident or vendor confirmation.");
        return repository.Mutate(actor, id, r =>
        {
            var a = r.Appointment; Guard(r.State == "scheduled" && a?.Id == appointmentId && a.Status == "proposed", "Only the current proposed visit can be confirmed."); Accepted(r);
            Guard(DateTimeOffset.Parse(a!.StartsAt, CultureInfo.InvariantCulture) > DateTimeOffset.UtcNow, "This visit is in the past. Request another time.");
            if (!confirmed) { a.Status = "cancelled"; r.State = "assigned"; r.NextAction = "Propose another visit"; }
            else
            {
                if (party == "resident") { Guard(a.ResidentConfirmedAt == null, "Resident already confirmed."); a.ResidentConfirmedAt = DateTimeOffset.UtcNow.ToString("O"); }
                else { Guard(a.VendorConfirmedAt == null, "Vendor already confirmed."); a.VendorConfirmedAt = DateTimeOffset.UtcNow.ToString("O"); }
                if (a.ResidentConfirmedAt != null && a.VendorConfirmedAt != null) { a.Status = "confirmed"; r.NextAction = "Vendor starts approved work at the visit"; }
            }
            Event(r, actor, "visit-response", $"{party} {(confirmed ? "confirmed" : "declined")} visit", a.StartsAt);
        }, ct, revision);
    }
    public Task<Repair> StartWork(Actor actor, string id, CancellationToken ct, long? revision)
    {
        actor.RequireVendor(); return repository.Mutate(actor, id, r =>
        {
            Guard(r.State is "assigned" or "scheduled" or "approved", "Work cannot start from this state."); Accepted(r); Approved(r);
            if (r.Appointment != null) Guard(r.Appointment.Status == "confirmed", "Both parties must confirm the proposed visit before work starts.");
            r.State = "in_progress"; r.NextAction = "Complete approved work"; Event(r, actor, "work-start", "Vendor started approved work", r.Estimate!.Scope);
        }, ct, revision);
    }
    public Task<Repair> CompleteWork(Actor actor, string id, CancellationToken ct, long? revision)
    {
        actor.RequireVendor(); return repository.Mutate(actor, id, r =>
        {
            Guard(r.State == "in_progress", "Only work in progress can be completed."); Accepted(r); Approved(r);
            r.VerificationHistory.Add(new VerificationRecord { RequestId = id, Revision = r.Revision + 1, Status = "pending", ActorId = actor.Id });
            r.State = "verification"; r.ResidentVerification = new("pending"); r.NextAction = "Resident verifies repair";
            Event(r, actor, "completion", "Vendor reported work complete", "Resident confirmation is required before closure.");
        }, ct, revision);
    }
    public Task<Repair> Verify(Actor actor, string id, VerifyInput input, CancellationToken ct, long? revision)
    {
        var fixedRepair = input.Fixed ?? throw new ApiException(400, "Fixed must be explicitly true or false.");
        actor.RequireResident(); var note = Text(input.Note, "Note", 0, 1000);
        return repository.Mutate(actor, id, r =>
        {
            Guard(r.State == "verification", "This repair is not waiting for resident verification.");
            r.ResidentVerification = new(fixedRepair ? "verified" : "unresolved", note, DateTimeOffset.UtcNow.ToString("O"));
            r.VerificationHistory.Add(new VerificationRecord
            {
                RequestId = id,
                Revision = r.Revision + 1,
                Status = fixedRepair ? "verified" : "unresolved",
                Note = note,
                ActorId = actor.Id
            });
            r.State = fixedRepair ? "closed" : "in_progress"; r.NextAction = fixedRepair ? "No further action" : "Vendor follows up on unresolved issue";
            Event(r, actor, "verification", fixedRepair ? "Resident verified repair" : "Resident reported unresolved issue", note);
        }, ct, revision);
    }

    public Task<List<Repair>> List(Actor actor, CancellationToken ct, string? search = null, string? state = null, string? priority = null, string? property = null)
    {
        if (search?.Length > 200) throw new ApiException(400, "Search is too long.");
        return repository.List(actor, ct, search, state, priority, property);
    }
    public Task<Repair> Get(Actor actor, string id, CancellationToken ct) => repository.Get(actor, id, ct);
    public async Task<object> Dashboard(Actor actor, CancellationToken ct)
    {
        actor.RequireManager();
        var repairs = await repository.List(actor, ct);
        var visits = Helpers.RepairAttentionHelper.ConfirmedVisitsToday(repairs, DateTimeOffset.UtcNow);
        var attention = repairs.Select(r => Helpers.RepairAttentionHelper.ManagerAction(r)).ToList();
        var closed = repairs.Where(r => r.State == "closed").ToList();
        return new
        {
            urgent = repairs.Count(r => r.Priority == "urgent" && Helpers.RepairAttentionHelper.IsOpen(r)),
            awaitingYou = attention.Count(action => action != null),
            openRequests = repairs.Count(Helpers.RepairAttentionHelper.IsOpen),
            pendingQuotes = attention.Count(action => action == "review_quote"),
            awaitingVerification = repairs.Count(Helpers.RepairAttentionHelper.AwaitsVerification),
            visitsToday = visits.Count,
            residentVerified = closed.Count == 0 ? (int?)null : (int)Math.Round(closed.Count(r => r.ResidentVerification?.Status == "verified") * 100.0 / closed.Count),
            requests = repairs,
            schedule = visits.Select(r => new
            {
                requestId = r.Id,
                startsAt = r.Appointment!.StartsAt,
                timezone = r.Appointment.Timezone,
                time = TimeZoneInfo.ConvertTime(DateTimeOffset.Parse(r.Appointment.StartsAt, CultureInfo.InvariantCulture), Zone(r.Appointment.Timezone)).ToString("HH:mm", CultureInfo.InvariantCulture),
                vendor = r.AssignedVendorName,
                detail = $"{r.Property} · {r.Unit} · {r.Title}"
            })
        };
    }
    public Task<List<Property>> Properties(Actor actor, CancellationToken ct) => repository.Properties(actor, ct);
    public Task<Property> SaveProperty(Actor actor, PropertyInput input, string? id, CancellationToken ct) =>
        repository.SaveProperty(actor, PropertyFrom(input, id), id == null, ct);
    public Task ArchiveProperty(Actor actor, string id, CancellationToken ct) => repository.ArchiveProperty(actor, id, ct);
    public Task<List<PropertyUnit>> Units(Actor actor, string property, CancellationToken ct) => repository.Units(actor, property, ct);
    public Task<PropertyUnit> AddUnit(Actor actor, string property, UnitInput input, CancellationToken ct) =>
        repository.AddUnit(actor, property, Text(input.Label, "Unit label", 1, 40), ct);
    public Task<List<Vendor>> Vendors(Actor actor, CancellationToken ct) => repository.Vendors(actor, ct);
    public Task<Vendor> InviteVendor(Actor actor, VendorInput input, CancellationToken ct) => repository.SaveVendor(actor, VendorFrom(input), ct);
    public Task<List<Notification>> Notifications(Actor actor, CancellationToken ct) => repository.Notifications(actor, ct);
    public Task<Notification> ReadNotification(Actor actor, string id, CancellationToken ct) => repository.ReadNotification(actor, id, ct);
    public Task<List<Message>> Messages(Actor actor, string id, CancellationToken ct) => repository.Messages(actor, id, ct);
    public Task<Message> SendMessage(Actor actor, string id, MessageInput input, CancellationToken ct) =>
        repository.SendMessage(actor, id, Text(input.Body, "Message", 1, 4000), ct);

}
