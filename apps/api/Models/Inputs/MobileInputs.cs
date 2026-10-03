namespace RepairLedger.Api.Models.Inputs;

public sealed record GatePresenceInput(string Action, long Revision);
public sealed record CreateCommonAreaInput(string SubmissionId, string PropertyId, string Location,
    string Title, string Category, string Description, string Priority = "routine");
public sealed record UpdateCommonAreaInput(string Status, string Note, long Revision);
