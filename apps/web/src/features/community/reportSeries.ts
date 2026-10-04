import type { CommunityData } from "../../../../../shared/community";
export function reportSeries(data: CommunityData, currency: string) {
  const months = new Map<
    string,
    { month: string; billed: number; paid: number; expenses: number }
  >();
  const row = (month: string) => {
    if (!months.has(month))
      months.set(month, { month, billed: 0, paid: 0, expenses: 0 });
    return months.get(month)!;
  };
  const categories = new Map<string, number>();
  for (const c of data.charges.filter((c) => c.currency === currency)) {
    const r = row(c.dueOn.slice(0, 7));
    r.billed += Math.round(c.amount * 100);
    r.paid += Math.round(c.verifiedPaid * 100);
  }
  for (const e of data.expenses.filter((e) => e.currency === currency)) {
    row(e.incurredOn.slice(0, 7)).expenses += Math.round(e.amount * 100);
    categories.set(
      e.category,
      (categories.get(e.category) ?? 0) + Math.round(e.amount * 100),
    );
  }
  return {
    months: [...months.values()]
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12)
      .map((r) => ({
        ...r,
        billed: r.billed / 100,
        paid: r.paid / 100,
        expenses: r.expenses / 100,
      })),
    categories: [...categories]
      .map(([category, amount]) => ({ category, amount: amount / 100 }))
      .sort((a, b) => b.amount - a.amount),
  };
}
