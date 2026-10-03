using System.ComponentModel.DataAnnotations;
namespace RepairLedger.Api.Models.Inputs;

public sealed record VerifyInput(bool? Fixed, string? Note);
