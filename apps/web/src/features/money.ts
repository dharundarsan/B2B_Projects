import type { RequestRecord } from "../types";

export const supportedCurrencies = [
  "USD",
  "INR",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "SGD",
] as const;
const formatters = new Map<string, Intl.NumberFormat>();
function formatter(currency: string) {
  if (!formatters.has(currency))
    formatters.set(
      currency,
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }),
    );
  return formatters.get(currency)!;
}
export function quoteCurrency(currency?: string) {
  return currency && /^[A-Z]{3}$/.test(currency) ? currency : "USD";
}
export function formatMoney(amount: number, currency?: string) {
  return formatter(quoteCurrency(currency)).format(amount);
}
export function currencySymbol(currency?: string) {
  return (
    formatter(quoteCurrency(currency))
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? "$"
  );
}

/** Latest quote only, grouped by currency; authorizations are not invoices or payments. */
export function approvedQuoteTotals(requests: readonly RequestRecord[]) {
  const totals = new Map<string, number>();
  for (const request of requests) {
    const latest =
      request.estimate ??
      (request.estimates?.length
        ? request.estimates.reduce((a, b) => (a.version > b.version ? a : b))
        : undefined);
    if (latest?.status !== "approved" || request.state === "cancelled")
      continue;
    const currency = quoteCurrency(latest.currency);
    const cents = Math.round(latest.total * 100);
    totals.set(currency, (totals.get(currency) ?? 0) + cents);
  }
  return [...totals]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, cents]) => ({ currency, amount: cents / 100 }));
}
