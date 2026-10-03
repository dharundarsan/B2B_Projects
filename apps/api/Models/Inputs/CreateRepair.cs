using System.ComponentModel.DataAnnotations;
namespace RepairLedger.Api.Models.Inputs;

public sealed record CreateRepair([Required] string Title, string? Property, string? PropertyId, [Required] string Unit,
    [Required] string Resident, [Required] string Category, [Required] string Description, [Required] string Priority = "routine",
    [Required] string Language = "English", [Required] string Access = "Resident must be home", string? AccessNotes = null,
    string? PreferredWindow = null, Dictionary<string, string>? SafetyAnswers = null, string? PhotoUrl = null);
