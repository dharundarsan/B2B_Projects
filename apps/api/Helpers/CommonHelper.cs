namespace RepairLedger.Api.Helpers;

/// <summary>Pure domain primitives; no blocking HTTP, company secrets or business SQL.</summary>
public static class CommonHelper
{
    public static TimeZoneInfo Zone(string? value)
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById(ValidatorHelper.Text(value, "Timezone", 1, 100)); }
        catch (TimeZoneNotFoundException) { throw new ApiException(400, "Timezone must be a valid IANA timezone."); }
        catch (InvalidTimeZoneException) { throw new ApiException(400, "Invalid timezone."); }
    }
    public static string Currency(string? value)
    {
        var currency = ValidatorHelper.Text(value, "Currency", 3, 3).ToUpperInvariant();
        if (currency is not ("USD" or "INR" or "EUR" or "GBP" or "CAD" or "AUD" or "SGD"))
            throw new ApiException(400, "Supported currencies: USD, INR, EUR, GBP, CAD, AUD, SGD.");
        return currency;
    }
}
