using System.ComponentModel.DataAnnotations;
namespace RepairLedger.Api.Models.Inputs;

public sealed record UnitInput([Required, StringLength(40, MinimumLength = 1)] string Label);
