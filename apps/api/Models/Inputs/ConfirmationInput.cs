using System.ComponentModel.DataAnnotations;
namespace RepairLedger.Api.Models.Inputs;

public sealed record ConfirmationInput(bool? Confirmed, string? Party);
