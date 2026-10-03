using System.ComponentModel.DataAnnotations;
namespace RepairLedger.Api.Models.Inputs;

public sealed record VendorInput([Required] string Name, [Required] string Email, [Required] string Trade, string? Phone);
