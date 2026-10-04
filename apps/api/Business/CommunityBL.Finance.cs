using RepairLedger.Api.ExternalAPI;
namespace RepairLedger.Api.Business;

public sealed partial class CommunityBL
{
    public Task<Ownership> Ownership(Actor actor, string property, OwnershipInput input, CancellationToken ct) => Write(actor, property, (s, d) =>
    {
        actor.RequireManager(); Require(d.Units.Any(u => u.Id == input.UnitId && u.Archived == 0), "Choose a registered unit."); Find(d.Parties, input.PartyId);
        var start = Date(input.StartsOn); var end = input.EndsOn == null ? null : Date(input.EndsOn);
        Require(end == null || string.CompareOrdinal(start, end) < 0, "The end date must be after the start date (end dates are exclusive).");
        var row = new Ownership { UnitId = input.UnitId, PartyId = input.PartyId, Share = Money(input.Share), IncomeShare = Money(input.IncomeShare, true), ExpenseShare = Money(input.ExpenseShare, true), StartsOn = start, EndsOn = end };
        Require(new[] { row.Share, row.IncomeShare, row.ExpenseShare }.All(v => v <= 100), "Shares cannot exceed 100%.");
        var existing = d.Ownerships.Where(o => o.UnitId == row.UnitId && Overlaps(o.StartsOn, o.EndsOn, start, end)).ToList();
        Require(!existing.Any(o => o.PartyId == row.PartyId), "This party already owns a share during that period.", 409);
        var dates = existing.SelectMany(o => new[] { o.StartsOn, o.EndsOn }).Append(start).Where(x => x != null).Cast<string>().Distinct();
        foreach (var date in dates.Where(date => string.CompareOrdinal(date, start) >= 0 && (end == null || string.CompareOrdinal(date, end) < 0)))
        {
            var active = existing.Where(o => string.CompareOrdinal(o.StartsOn, date) <= 0 && (o.EndsOn == null || string.CompareOrdinal(date, o.EndsOn) < 0)).Append(row).ToList();
            Require(active.Sum(o => o.Share) <= 100 && active.Sum(o => o.IncomeShare) <= 100 && active.Sum(o => o.ExpenseShare) <= 100, "Overlapping ownership, income or expense shares exceed 100%.", 409);
        }
        return s.Insert("Ownership", row, Now);
    }, ct);
    public Task<Ownership> EndOwnership(Actor actor, string property, string id, EndOwnershipInput input, CancellationToken ct) => Write(actor, property, (s, d) =>
    {
        actor.RequireManager(); var row = Find(d.Ownerships, id); var end = Date(input.EndsOn);
        Require(row.EndsOn == null && string.CompareOrdinal(end, row.StartsOn) > 0 && string.CompareOrdinal(end, Day(d)) >= 0, "An open ownership can end today or later, after its start date.");
        Require(!d.Agreements.Any(a => a.CreditorPartyId == row.PartyId && a.UnitIds.Contains(row.UnitId) && a.Status == "active" && string.CompareOrdinal(a.EndsOn, end) > 0), "End or transfer this owner's active rental agreements first.", 409);
        row.EndsOn = end; return s.Update("Ownership", row, input.Revision, "Ownership.ended", Now);
    }, ct);
    public Task<RentalAgreement> Agreement(Actor actor, string property, AgreementInput input, CancellationToken ct) => Write(actor, property, async (s, d) =>
    {
        Member(actor); var kind = Choice(input.Kind, "direct", "master", "sublease");
        Require(actor.IsManager || actor.IsOperator && kind == "sublease" || actor.IsUnitOwner && kind is "direct" or "master", "Rental management access required.", 403);
        Find(d.Parties, input.DebtorPartyId); Find(d.Parties, input.CreditorPartyId);
        Require(input.DebtorPartyId != input.CreditorPartyId, "Tenant and landlord must be different parties.");
        var units = input.UnitIds?.Distinct().ToArray() ?? [];
        Require(units.Length is > 0 and <= 100 && units.All(id => d.Units.Any(u => u.Id == id && u.Archived == 0)), "Choose 1–100 registered units.");
        Require(kind == "master" || units.Length == 1, "A resident occupancy covers one registered unit. Use a master lease and individual subleases for a floor.");
        var start = Date(input.StartsOn); var end = Date(input.EndsOn); var currency = Currency(input.Currency);
        Require(string.CompareOrdinal(start, end) < 0 && input.DueDay is >= 1 and <= 28, "Check the lease dates and due day (1–28).");
        if (kind == "sublease")
        {
            var parent = Find(d.Agreements, input.ParentId ?? "");
            Require(parent.Kind == "master" && parent.Status == "active" && parent.DebtorPartyId == input.CreditorPartyId && parent.Currency == currency && Covers(parent.StartsOn, parent.EndsOn, start, end) && units.All(parent.UnitIds.Contains), "The sublease must be within the operator's master lease, with the same currency and operator.");
            Require(actor.IsManager || Parties(actor, d).Contains(parent.DebtorPartyId), "You are not the operator on this master lease.", 403);
            Require(!d.Agreements.Any(a => a.Kind == "sublease" && a.Status == "active" && a.UnitIds.Intersect(units).Any() && Overlaps(a.StartsOn, a.EndsOn, start, end)), "A sublease already covers these units during that period.", 409);
        }
        else
        {
            Require(input.ParentId == null, "Only subleases have a parent agreement.");
            Require(actor.IsManager || Parties(actor, d).Contains(input.CreditorPartyId), "You are not this agreement's landlord.", 403);
            Require(units.All(unit => d.Ownerships.Any(o => o.UnitId == unit && o.PartyId == input.CreditorPartyId && Covers(o.StartsOn, o.EndsOn, start, end))), "Record the landlord's ownership covering these units and dates first.");
            Require(!d.Agreements.Any(a => a.Kind != "sublease" && a.Status == "active" && a.UnitIds.Intersect(units).Any() && Overlaps(a.StartsOn, a.EndsOn, start, end)), "An owner lease already covers these units during that period.", 409);
        }
        var occupancy = string.IsNullOrWhiteSpace(input.OccupancyId) ? null : input.OccupancyId.Trim();
        Require(occupancy == null || Guid.TryParse(occupancy, out _), "Use the resident's trusted occupancy UUID.");
        Require(kind == "master" || occupancy != null, "Direct tenancies and subleases require a resident occupancy UUID.");
        var row = await s.Insert("Agreement", new RentalAgreement { Kind = kind, DebtorPartyId = input.DebtorPartyId, CreditorPartyId = input.CreditorPartyId, ParentId = input.ParentId, OccupancyId = occupancy, UnitIds = units, StartsOn = start, EndsOn = end, Rent = Money(input.Rent), Deposit = Money(input.Deposit, true), Currency = currency, DueDay = input.DueDay }, Now);
        foreach (var unit in units) await s.AgreementUnit(row.Id, unit);
        if (row.Deposit > 0) await s.Insert("Charge", new CommunityCharge { AgreementId = row.Id, Kind = "deposit", Period = "deposit", DueOn = start, Amount = row.Deposit, Currency = currency }, Now);
        return row;
    }, ct);
    public Task<RentalAgreement> EndAgreement(Actor actor, string property, string id, EndAgreementInput input, CancellationToken ct) => Write(actor, property, (s, d) =>
    {
        Member(actor); var row = Find(d.Agreements, id);
        Require(actor.IsManager || (actor.IsOperator || actor.IsUnitOwner) && Parties(actor, d).Contains(row.CreditorPartyId), "Only the landlord or manager can end an agreement.", 403);
        var end = Date(input.EndsOn); Require(row.Status == "active" && string.CompareOrdinal(end, row.StartsOn) > 0 && string.CompareOrdinal(end, row.EndsOn) <= 0 && string.CompareOrdinal(end, Day(d)) >= 0, "Choose today or a future date within the lease, after its start.");
        Require(!d.Agreements.Any(a => a.ParentId == row.Id && a.Status == "active" && string.CompareOrdinal(a.EndsOn, end) > 0), "End the linked subleases first.", 409);
        Require(end == row.EndsOn || !d.Charges.Any(c => c.AgreementId == row.Id && c.Kind == "rent" && string.CompareOrdinal(c.Period, end[..7]) >= 0), "Rent has already been billed for the shortened period. Resolve those charges before changing the end date.", 409);
        row.EndsOn = end; return s.Update("Agreement", row, input.Revision, "Agreement.ended", Now);
    }, ct);
    public Task<List<CommunityCharge>> GenerateRent(Actor actor, string property, GenerateRentInput input, CancellationToken ct) => Write(actor, property, async (s, d) =>
    {
        Require(actor.IsManager || (actor.IsOperator || actor.IsUnitOwner), "Rental management access required.", 403);
        var month = Text(input.Month, 7, "Month"); var first = DateOnly.Parse(Date(month + "-01")); var next = first.AddMonths(1);
        Require(Math.Abs(first.DayNumber - DateOnly.Parse(Day(d)).DayNumber) < 366 * 5, "Choose a billing month within five years.");
        var created = new List<CommunityCharge>();
        foreach (var a in d.Agreements.Where(a => a.Status == "active" && Overlaps(a.StartsOn, a.EndsOn, first.ToString("yyyy-MM-dd"), next.ToString("yyyy-MM-dd")) &&
            (actor.IsManager || Parties(actor, d).Contains(a.CreditorPartyId) || actor.IsOperator && a.Kind == "master" && Parties(actor, d).Contains(a.DebtorPartyId))))
        {
            if (d.Charges.Any(c => c.AgreementId == a.Id && c.Kind == "rent" && c.Period == month)) continue;
            var from = DateOnly.Parse(a.StartsOn) > first ? DateOnly.Parse(a.StartsOn) : first; var to = DateOnly.Parse(a.EndsOn) < next ? DateOnly.Parse(a.EndsOn) : next;
            var amount = decimal.Round(a.Rent * (to.DayNumber - from.DayNumber) / (next.DayNumber - first.DayNumber), 2, MidpointRounding.AwayFromZero);
            if (amount <= 0) continue;
            var due = first.AddDays(a.DueDay - 1); if (due < from) due = from;
            created.Add(await s.Insert("Charge", new CommunityCharge { AgreementId = a.Id, Kind = "rent", Period = month, DueOn = due.ToString("yyyy-MM-dd"), Amount = amount, Currency = a.Currency }, Now));
        }
        return created;
    }, ct);
    public Task<CommunityPayment> Payment(Actor actor, string property, PaymentInput input, CancellationToken ct) => Write(actor, property, (s, d) =>
    {
        Member(actor); var charge = Find(d.Charges, input.ChargeId); var agreement = Find(d.Agreements, charge.AgreementId); var amount = Money(input.Amount); var submission = Submission(input.SubmissionId); var reference = Text(input.Reference, 300, "Payment reference");
        Require(actor.IsManager || actor.IsOperator && agreement.Kind == "master" && Parties(actor, d).Contains(agreement.DebtorPartyId) || ResidentAgreement(actor, d, agreement), "You cannot report payment for this tenant.", 403);
        var previous = d.Payments.SingleOrDefault(p => p.UserId == actor.Id && p.SubmissionId == submission);
        if (previous != null) { Require(previous.ChargeId == charge.Id && previous.Amount == amount && previous.Reference == reference, "Submission ID was already used for a different payment.", 409); return Task.FromResult(previous); }
        Require(d.Payments.Where(p => p.ChargeId == charge.Id && p.Status is "pending" or "verified").Sum(p => p.Amount) + amount <= charge.Amount, "This payment exceeds the unpaid balance, including pending payments.", 409);
        return s.Insert("Payment", new CommunityPayment { ChargeId = charge.Id, Amount = amount, Reference = reference, UserId = actor.Id, SubmissionId = submission }, Now);
    }, ct);
    public Task<CommunityPayment> PaymentAction(Actor actor, string property, string id, CommunityActionInput input, CancellationToken ct) => Write(actor, property, (s, d) =>
    {
        Member(actor); var row = Find(d.Payments, id); var charge = Find(d.Charges, row.ChargeId); var agreement = Find(d.Agreements, charge.AgreementId);
        Require(actor.IsManager || (actor.IsOperator || actor.IsUnitOwner) && Parties(actor, d).Contains(agreement.CreditorPartyId), "Only the creditor or manager can verify this payment.", 403);
        Require(row.Status == "pending", "Only pending payments can be verified or rejected.", 409); var action = Choice(input.Action, "verify", "reject");
        if (action == "verify") Require(charge.VerifiedPaid + row.Amount <= charge.Amount, "Verification would overpay this charge.", 409);
        row.Status = action == "verify" ? "verified" : "rejected"; row.VerifiedBy = actor.Id; return s.Update("Payment", row, input.Revision, "Payment." + action, Now);
    }, ct);
    public Task<CommunityExpense> Expense(Actor actor, string property, ExpenseInput input, CancellationToken ct) => Write(actor, property, async (s, d) =>
    {
        Member(actor); var scope = Choice(input.Scope, "community", "unit", "operator"); var date = Date(input.IncurredOn);
        Require(actor.IsManager || scope == "unit" && actor.IsUnitOwner && OwnedUnits(actor, d).Contains(input.UnitId) || scope == "operator" && actor.IsOperator && Parties(actor, d).Contains(input.PartyId), "Expense management access required for this scope.", 403);
        Require(scope != "unit" || d.Units.Any(u => u.Id == input.UnitId && u.Archived == 0), "Choose a registered unit for a unit expense.");
        Require(scope != "operator" || d.Parties.Any(p => p.Id == input.PartyId), "Choose an operator party.");
        var row = new CommunityExpense { Scope = scope, UnitId = scope == "unit" ? input.UnitId : null, PartyId = scope == "operator" ? input.PartyId : null, Category = Text(input.Category, 100, "Category"), Description = Text(input.Description, 2000, "Description"), Amount = Money(input.Amount), Currency = Currency(input.Currency), IncurredOn = date, PaidStatus = Choice(input.PaidStatus, "unpaid", "paid"), UserId = actor.Id };
        var allocations = input.Allocations ?? [];
        Require(allocations.Count <= 100 && allocations.Select(a => a.PartyId).Distinct().Count() == allocations.Count, "Choose each allocation party once.");
        if (allocations.Count == 0 && scope == "unit")
        {
            var owners = d.Ownerships.Where(o => o.UnitId == input.UnitId && string.CompareOrdinal(o.StartsOn, date) <= 0 && (o.EndsOn == null || string.CompareOrdinal(date, o.EndsOn) < 0) && o.ExpenseShare > 0).ToList();
            if (owners.Sum(o => o.ExpenseShare) == 100) { allocations = owners.Select(o => new ExpenseAllocation { PartyId = o.PartyId, Amount = decimal.Round(row.Amount * o.ExpenseShare / 100, 2, MidpointRounding.AwayFromZero) }).ToList(); allocations[^1].Amount += row.Amount - allocations.Sum(a => a.Amount); }
        }
        if (allocations.Count > 0) { foreach (var a in allocations) { Find(d.Parties, a.PartyId); Money(a.Amount, true); } Require(allocations.Sum(a => a.Amount) == row.Amount, "Expense allocations must add up to the total."); }
        await s.Insert("Expense", row, Now); row.Allocations = allocations;
        foreach (var a in allocations) { a.ExpenseId = row.Id; await s.Allocation(row.Id, a.PartyId, a.Amount); }
        return row;
    }, ct);
    public Task<CommunityExpense> ExpenseAction(Actor actor, string property, string id, CommunityActionInput input, CancellationToken ct) => Write(actor, property, (s, d) =>
    {
        var row = Find(d.Expenses, id); Require(actor.IsManager || actor.IsOperator && row.Scope == "operator" && Parties(actor, d).Contains(row.PartyId) || actor.IsUnitOwner && row.Scope == "unit" && OwnedUnits(actor, d).Contains(row.UnitId), "Expense management access required.", 403);
        row.PaidStatus = Choice(input.Action, "paid", "unpaid"); return s.Update("Expense", row, input.Revision, "Expense." + row.PaidStatus, Now);
    }, ct);
    public async Task<object> ReceiptUpload(Actor actor, string property, string expense, ReceiptInput input, CancellationToken ct)
    {
        var visible = await Read(actor, property, ct); Find(visible.Expenses, expense);
        Require(actor.IsManager || visible.Expenses.Any(e => e.Id == expense && e.UserId == actor.Id), "Only the expense author or manager can attach receipts.", 403);
        Require(EvidenceStorage.ContentTypes.Contains(input.ContentType) && input.Size is > 0 and <= 20 * 1024 * 1024, "Choose a supported receipt of at most 20 MB.");
        var row = new CommunityReceipt { ExpenseId = expense, Name = Text(input.Name, 200, "File name"), ContentType = input.ContentType, Size = input.Size };
        row.Path = $"{actor.WorkspaceId}/community/{property}/{expense}/{row.Id}";
        var signed = await storage.Upload(row.Path, ct);
        await Write(actor, property, (s, d) => { Find(d.Expenses, expense); return s.Insert("Receipt", row, Now); }, ct);
        return new { receiptId = row.Id, signedUrl = signed.Url, token = signed.Token };
    }
    public async Task<CommunityReceipt> CompleteReceipt(Actor actor, string property, string id, CommunityActionInput input, CancellationToken ct)
    {
        var visible = await Read(actor, property, ct); var receipt = Find(visible.Receipts, id); var expense = Find(visible.Expenses, receipt.ExpenseId);
        Require(actor.IsManager || expense.UserId == actor.Id, "Only the author or manager can complete this receipt.", 403);
        var raw = Find((await repository.Read(actor, property, ct)).Receipts, id);
        await storage.Verify(new Evidence { Path = raw.Path, ContentType = raw.ContentType, Size = raw.Size }, ct);
        return await Write(actor, property, (s, d) => { var row = Find(d.Receipts, id); Require(row.Status == "uploading", "Receipt is already complete.", 409); row.Status = "ready"; return s.Update("Receipt", row, input.Revision, "Receipt.completed", Now); }, ct);
    }
    public async Task<object> ReceiptUrl(Actor actor, string property, string id, CancellationToken ct)
    {
        var visible = await Read(actor, property, ct); var receipt = Find(visible.Receipts, id); Require(receipt.Status == "ready", "Receipt upload is incomplete.", 409);
        var raw = Find((await repository.Read(actor, property, ct)).Receipts, id); return new { url = await storage.Download(raw.Path, ct) };
    }
}
