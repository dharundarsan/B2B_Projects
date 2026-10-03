using System.Globalization;

namespace RepairLedger.Api.Helpers;

/// <summary>
/// Read-only queue semantics derived from workflow state, not display text or a promised SLA.
/// These signals do not authorize a mutation; the business operation still enforces its guards.
/// </summary>
public static class RepairAttentionHelper
{
    public static bool IsOpen(Repair repair) => repair.State is not ("closed" or "cancelled");

    public static bool AwaitsVerification(Repair repair) => repair.State is "completed" or "verification";

    public static string? ManagerAction(Repair repair)
    {
        // Work in progress, resident verification and unsupported states do not belong to
        // the manager decision queue, even when they retain an old estimate or appointment.
        if (repair.State is not ("submitted" or "urgent" or "acknowledged" or "assigned" or "approved" or "scheduled" or "waiting")) return null;
        if (repair.State is "submitted" or "urgent") return "acknowledge";

        // A pending offer and a quote returned for revision are owned by the vendor.
        if (repair.VendorDecision == "pending") return null;
        if (repair.VendorDecision == "accepted")
        {
            if (repair.Estimate?.Status == "submitted") return "review_quote";
            if (repair.Estimate?.Status == "approved" && repair.Appointment?.Status is null or "cancelled") return "schedule";
            return null;
        }

        // Reassignment must follow Offer's no-existing-estimate guard. A cancelled visit
        // must not accidentally expose reassignment of already approved vendor scope.
        if (repair.Estimate != null) return null;
        if (repair.VendorDecision == "declined" || repair.State == "acknowledged" ||
            repair.State == "assigned" && string.IsNullOrWhiteSpace(repair.AssignedVendorId)) return "assign";
        return null;
    }

    public static List<Repair> ConfirmedVisitsToday(IEnumerable<Repair> repairs, DateTimeOffset now)
        => repairs.Where(repair =>
            repair.State is "scheduled" or "in_progress" &&
            repair.Appointment?.Status == "confirmed" &&
            DateTimeOffset.TryParse(repair.Appointment.StartsAt, CultureInfo.InvariantCulture, DateTimeStyles.None, out var startsAt) &&
            TimeZoneInfo.ConvertTime(startsAt, CommonHelper.Zone(repair.Appointment.Timezone)).Date ==
            TimeZoneInfo.ConvertTime(now, CommonHelper.Zone(repair.Appointment.Timezone)).Date)
            .OrderBy(repair => DateTimeOffset.Parse(repair.Appointment!.StartsAt, CultureInfo.InvariantCulture))
            .ThenBy(repair => repair.Id, StringComparer.Ordinal)
            .ToList();
}
