using System.Text.Json.Serialization;

namespace RepairLedger.Api.Errors;

public sealed class ApiException(int status, string message) : Exception(message)
{
    public int Status { get; } = status;
}
