using System.ComponentModel.DataAnnotations;
namespace RepairLedger.Api.Models.Inputs;

public sealed record VendorResponseInput([Required] string VendorId, [Required] string Decision, string? Reason);
