namespace RepairLedger.Api.Helpers;

public static class RepairResponseHelper
{
    public static object ForActor(Actor actor, Repair repair)
    {
        if (actor.IsManager || actor.Role == "vendor") return repair;
        if (actor.Role != "tenant" || !actor.CanAccess(repair)) throw new ApiException(404, "Repair not found.");
        // An allowlist, not mutation of the persisted object needed by workflow validation.
        return new
        {
            repair.Id, repair.Revision, repair.Title, repair.Property, repair.PropertyId, repair.Unit, repair.UnitId,
            repair.Resident, repair.Category, repair.Priority, repair.State, repair.NextAction, repair.DueLabel,
            repair.Description, repair.Access, repair.Language, repair.Timezone, repair.CreatedAt, repair.PhotoUrl,
            repair.AccessNotes, repair.PreferredWindow, repair.SafetyAnswers, repair.AssignedVendorName, repair.VendorDecision,
            VendorAssigned = !string.IsNullOrEmpty(repair.AssignedVendorId), QuoteStatus = repair.Estimate?.Status,
            repair.ResidentLinked, repair.Appointment, repair.Appointments, repair.ResidentVerification,
            Events = repair.Events.Where(e => e.Type is "received" or "visit" or "visit-response" or "completion" or "verification")
                .Select(e => new { e.Id, e.Type, e.Label, Detail = "", e.At }),
            Evidence = repair.Evidence.Select(e => new { e.Id, e.Name, e.ContentType, e.Size, e.CreatedAt, e.Status }),
            VerificationHistory = repair.VerificationHistory.Select(v => new { v.Id, v.Revision, v.Status, v.Note, v.RecordedAt })
        };
    }
}
