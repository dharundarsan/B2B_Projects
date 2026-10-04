import { useState } from "react";
import { Text, View } from "react-native";
import type { CommunityData } from "../../../../shared/community";
import { Card, Chips, Empty, Section, s } from "../components/ui";
export function MobileReports({ data: d }: { data: CommunityData }) {
  const currencies = [
    ...new Set([
      ...d.charges.map((c) => c.currency),
      ...d.expenses.map((e) => e.currency),
    ]),
  ];
  const [chosen, setChosen] = useState(currencies[0] ?? "INR");
  const currency = currencies.includes(chosen)
    ? chosen
    : (currencies[0] ?? "INR");
  const charges = d.charges.filter((c) => c.currency === currency),
    expenses = d.expenses.filter((e) => e.currency === currency);
  const sum = (values: number[]) =>
    values.reduce((sum, n) => sum + Math.round(n * 100), 0) / 100;
  const rows = [
    {
      label: "Billed (including deposits)",
      value: sum(charges.map((c) => c.amount)),
      color: "#7154db",
    },
    {
      label: "Verified collections",
      value: sum(charges.map((c) => c.verifiedPaid)),
      color: "#30ad8c",
    },
    {
      label: "Expenses",
      value: sum(expenses.map((e) => e.amount)),
      color: "#e5aa45",
    },
  ];
  const max = Math.max(1, ...rows.map((r) => r.value));
  const money = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(n);
  return (
    <>
      <Section title="Reports & insights" />
      <Chips
        options={currencies.map((value) => ({ value, label: value }))}
        value={currency}
        onChange={setChosen}
      />
      <Card>
        <Text style={s.h3}>Collections & spending · {currency}</Text>
        {rows.map((r) => (
          <View key={r.label} style={{ gap: 6 }}>
            <Text style={s.label}>
              {r.label} · {money(r.value)}
            </Text>
            <View
              accessible
              accessibilityLabel={`${r.label}: ${money(r.value)}`}
              style={{
                height: 14,
                backgroundColor: "#eeeaf7",
                borderRadius: 5,
              }}
            >
              <View
                style={{
                  height: 14,
                  width: `${(r.value / max) * 100}%`,
                  backgroundColor: r.color,
                  borderRadius: 5,
                }}
              />
            </View>
          </View>
        ))}
        {!currencies.length && <Empty title="No financial records yet" />}
      </Card>
      <Card>
        <Text style={s.h3}>Expenses by category</Text>
        {[...new Set(expenses.map((e) => e.category))].map((category) => {
          const value = sum(
            expenses
              .filter((e) => e.category === category)
              .map((e) => e.amount),
          );
          return (
            <View key={category} style={{ gap: 6 }}>
              <Text style={s.label}>
                {category} · {money(value)}
              </Text>
              <View
                style={{
                  height: 12,
                  backgroundColor: "#eeeaf7",
                  borderRadius: 5,
                }}
              >
                <View
                  style={{
                    height: 12,
                    width: `${(value / Math.max(1, rows[2]!.value)) * 100}%`,
                    backgroundColor: "#7154db",
                    borderRadius: 5,
                  }}
                />
              </View>
            </View>
          );
        })}
      </Card>
      <Text style={s.small}>
        Currencies stay separate. Collections include verified payments only.
        Monthly trends and occupancy charts are available in the web reports.
      </Text>
    </>
  );
}
