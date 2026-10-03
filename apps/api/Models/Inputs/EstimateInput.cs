using System.ComponentModel.DataAnnotations;
namespace RepairLedger.Api.Models.Inputs;

public sealed record EstimateInput([Required] string Scope, decimal Labor, decimal Parts, decimal Tax, string Currency = "USD");
