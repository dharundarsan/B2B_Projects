using System.ComponentModel.DataAnnotations;
namespace RepairLedger.Api.Models.Inputs;

public sealed record PropertyInput([Required] string Name, [Required] string Address, int Units, [Required] string Timezone);
