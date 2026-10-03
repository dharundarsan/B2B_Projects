using Dapper;
namespace RepairLedger.Api.DataAccess;

public sealed partial class RepairDAL
{
    public async Task Import(MigrationSnapshot snapshot, CancellationToken ct)
    {
        await using var db = await database.Open(ct); await using var tx = await db.BeginTransactionAsync(ct);
        // Insert-only import: duplicates or broken references abort the ENTIRE snapshot, never overwrite production data.
        foreach (var w in snapshot.Workspaces)
        {
            Helpers.ValidatorHelper.Text(w.Id, "Workspace", 1, 200);
            await EnsureWorkspace(db, tx, w.Id, ct);
            foreach (var p in w.Properties)
            {
                p.WorkspaceId = w.Id;
                await dapper.ExecuteAsync(db, new CommandDefinition(queryHelper.GetSqlQuery("ImportProperty"), p, tx, cancellationToken: ct));
            }
            foreach (var v in w.Vendors)
            {
                v.WorkspaceId = w.Id;
                await dapper.ExecuteAsync(db, new CommandDefinition(queryHelper.GetSqlQuery("InsertVendor"), v, tx, cancellationToken: ct));
            }
            foreach (var r in w.Requests)
            {
                r.WorkspaceId = w.Id;
                if (string.IsNullOrEmpty(r.PropertyId)) r.PropertyId = w.Properties.SingleOrDefault(p => p.Name == r.Property)?.Id ?? throw new InvalidOperationException($"Repair {r.Id} has no matching property. Correct the export before importing.");
                r.UnitId = await LinkUnit(db, tx, r, ct);
                r.SafetyJson = System.Text.Json.JsonSerializer.Serialize(r.SafetyAnswers);
                r.VerificationJson = r.ResidentVerification == null ? null : System.Text.Json.JsonSerializer.Serialize(r.ResidentVerification);
                await dapper.ExecuteAsync(db, new CommandDefinition(queryHelper.GetSqlQuery("InsertRepair"), r, tx, cancellationToken: ct));
                await LinkRequest(db, tx, r, ct);
                SnapshotHistory(r);
                await SaveChildren(db, tx, r, ct);
            }
            foreach (var m in w.Messages)
            {
                m.WorkspaceId = w.Id;
                await dapper.ExecuteAsync(db, new CommandDefinition(queryHelper.GetSqlQuery("InsertMessage"), m, tx, cancellationToken: ct));
            }
            foreach (var n in w.Notifications)
            {
                n.WorkspaceId = w.Id;
                await dapper.ExecuteAsync(db, new CommandDefinition(queryHelper.GetSqlQuery("ImportNotification"), new { n.WorkspaceId, n.Id, n.Title, n.Detail, n.Type, readInt = n.Read ? 1 : 0, n.Href, n.At }, tx, cancellationToken: ct));
            }
        }
        await tx.CommitAsync(ct);
    }

    private static void SnapshotHistory(Repair r)
    {
        if (r.AssignedVendorId != null && r.Offers.Count == 0)
            r.Offers.Add(new VendorOffer
            {
                RequestId = r.Id,
                VendorId = r.AssignedVendorId,
                Sequence = 1,
                Status = r.VendorDecision ?? "pending",
                OfferedAt = null,
                OfferedBy = null,
                LegacySnapshot = true
            });
        if (r.ResidentVerification != null && r.VerificationHistory.Count == 0)
            r.VerificationHistory.Add(new VerificationRecord
            {
                RequestId = r.Id,
                Revision = r.Revision,
                Status = r.ResidentVerification.Status,
                Note = r.ResidentVerification.Note,
                RecordedAt = r.ResidentVerification.UpdatedAt ?? DateTimeOffset.UtcNow.ToString("O"),
                LegacySnapshot = true
            });
    }
}
