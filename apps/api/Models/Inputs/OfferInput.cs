using System.ComponentModel.DataAnnotations;
namespace RepairLedger.Api.Models.Inputs;

public sealed record OfferInput([Required] string VendorId, string? Note, string? PreferredWindow);
