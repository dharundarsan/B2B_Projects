namespace RepairLedger.Api.Models;

/// <summary>Metadata-only preflight, not a full schema/data-integrity audit.</summary>
public sealed record DatabaseCheckResult(string ServerVersion, int? SchemaVersion, bool ValidMigrationMetadata,
    bool StrictMode, IReadOnlyList<string> MissingTables, IReadOnlyList<string> IncompatibleTables)
{
    public bool Ready => SchemaVersion == Helpers.DatabaseMigrationHelper.CurrentVersion && ValidMigrationMetadata
        && StrictMode && MissingTables.Count == 0 && IncompatibleTables.Count == 0;
}
