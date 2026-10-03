namespace RepairLedger.Api.Helpers;

public static class ValidatorHelper
{
    public static string Text(string? value, string field, int min = 1, int max = 1000)
    {
        var text = value?.Trim() ?? "";
        if (text.Length < min || text.Length > max) throw new ApiException(400, $"{field} must contain {min}–{max} characters.");
        return text;
    }
}
