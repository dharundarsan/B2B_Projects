using System.ComponentModel.DataAnnotations;
namespace RepairLedger.Api.Models.Inputs;

public sealed record UploadInput([Required] string RequestId, [Required] string Name, [Required] string ContentType, long Size);
