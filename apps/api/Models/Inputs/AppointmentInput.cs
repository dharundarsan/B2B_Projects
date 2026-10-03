using System.ComponentModel.DataAnnotations;
namespace RepairLedger.Api.Models.Inputs;

public sealed record AppointmentInput([Required] string LocalStart, int DurationMinutes, [Required] string Timezone);
