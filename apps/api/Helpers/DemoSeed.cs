using RepairLedger.Api.Models;

namespace RepairLedger.Api.Helpers;

public static class DemoSeed
{
    public static async Task Initialize(IRepairDAL repository, CancellationToken ct)
    {
        var actor = new Actor("demo-owner", "demo-workspace", "demo", "demo@repairledger.local", null, []);
        if ((await repository.Properties(actor, ct)).Count != 0) return;
        foreach (var (id, name, units) in new[] { ("oak-street", "Oak Street", 8), ("maple-court", "Maple Court", 10), ("pine-ridge", "Pine Ridge", 6) })
            await repository.SaveProperty(actor, new Property { Id = id, Name = name, Address = $"{name}, Brooklyn, NY", Units = units, Timezone = "America/New_York" }, true, ct);
        foreach (var (id, name, trade) in new[] { ("elite-plumbing", "Elite Plumbing", "Plumbing"), ("northstar-hvac", "Northstar HVAC", "Heating or cooling"), ("brightline-electric", "Brightline Electric", "Electrical") })
            await repository.SaveVendor(actor, new Vendor { Id = id, Name = name, Trade = trade, Status = "approved", Availability = "Contact to arrange a visit" }, ct);
        var repair = new Repair { Id = "RL-1042", WorkspaceId = actor.WorkspaceId, Title = "Active kitchen leak", PropertyId = "oak-street", Property = "Oak Street", Unit = "3B", Resident = "Priya S.", Category = "Plumbing", Description = "Water is dripping below the kitchen sink.", Access = "Resident must be home", Priority = "urgent", State = "urgent", Timezone = "America/New_York", Language = "Hindi", PhotoUrl = "/repairledger-redesign/assets/kitchen-leak-evidence.png", SafetyAnswers = new() { ["waterFlowing"] = "Yes", ["waterNearElectricity"] = "No" } };
        RepairBL.Event(repair, actor, "received", "Demo repair reported", "Sample record; subsequent changes are persisted to the local SQL database.");
        await repository.Create(actor, repair, ct);
    }
}
