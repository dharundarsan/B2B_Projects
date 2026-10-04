import { Text } from "react-native";
import type { CommunityData } from "../../../../shared/community";
import { Badge, Button, Card, Section, s } from "../components/ui";
import { Form, type Save } from "./CommunityForm";
export function MobileDeliveries({
  data: d,
  save,
  busy,
}: {
  data: CommunityData;
  save: Save;
  busy: boolean;
}) {
  const seller = d.userContext === 3;
  const providers = d.sellers.filter(
    (p) => p.userId === d.userId && p.status === "approved",
  );
  const recipient = !d.canGate && d.role !== "watchman";
  const day = (instant: string) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: d.property.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(instant));
  return (
    <>
      <Section
        title={
          d.canGate
            ? "Incoming delivery desk"
            : seller
              ? "My incoming stock"
              : "My expected deliveries"
        }
      />
      {recipient && (!seller || providers.length > 0) && (
        <Card>
          <Form
            title={seller ? "Request stock delivery" : "Expect a delivery"}
            busy={busy}
            fields={[
              ...(seller
                ? [
                    {
                      name: "sellerId",
                      label: "My store",
                      options: providers.map((p) => ({
                        value: p.id,
                        label: p.name,
                      })),
                      value: providers[0]?.id,
                    },
                    {
                      name: "size",
                      label: "Delivery size",
                      options: [
                        { value: "normal", label: "Small delivery" },
                        { value: "bulk", label: "Bulk stock — admin approval" },
                      ],
                      value: "normal",
                    },
                  ]
                : [
                    {
                      name: "unitId",
                      label: "Destination",
                      options: [
                        { value: "", label: "Community gate pickup" },
                        ...d.units
                          .filter((u) => d.myUnitIds.includes(u.id))
                          .map((u) => ({ value: u.id, label: u.label })),
                      ],
                      value: "",
                    },
                  ]),
              { name: "name", label: "Carrier / supplier" },
              { name: "reference", label: "Order reference (optional)" },
              {
                name: "packages",
                label: "Package count",
                number: true,
                value: "1",
                hint: seller
                  ? "Above 20 packages must be bulk."
                  : "Personal maximum: 20.",
              },
              {
                name: "expectedAt",
                label: "Expected time with timezone",
                value: new Date(Date.now() + 3600000).toISOString(),
              },
              {
                name: "notes",
                label: "Handling instructions",
                multiline: true,
                hint: "Required for bulk shipments.",
              },
            ]}
            save={(v) =>
              save("deliveries", {
                ...v,
                packages: Number(v.packages),
                unitId: v.unitId || null,
                sellerId: v.sellerId || null,
                bulk: seller && v.size === "bulk",
                expectedAt: new Date(v.expectedAt ?? "").toISOString(),
              })
            }
          />
        </Card>
      )}
      {(d.deliveries ?? [])
        .slice()
        .reverse()
        .map((r) => (
          <Card key={r.id}>
            <Text style={s.h3}>{r.name}</Text>
            <Text style={s.body}>
              {r.packages} packages · {new Date(r.expectedAt).toLocaleString()}
            </Text>
            <Text style={s.small}>
              {r.bulk
                ? "Bulk stock"
                : r.sellerId
                  ? "Business delivery"
                  : "Personal parcel"}{" "}
              · {r.reference}
            </Text>
            <Text style={s.body}>{r.notes}</Text>
            <Text style={s.small}>
              {r.destination} · {r.recipientName}
            </Text>
            <Badge label={r.approval} />
            <Badge label={r.status} />
            {(d.canManage && r.status === "expected" && r.approval === "pending"
              ? ["approve", "deny"]
              : d.canGate &&
                  r.status === "expected" &&
                  r.approval === "approved" &&
                  day(r.expectedAt) === day(new Date().toISOString())
                ? ["accept"]
                : recipient && r.userId === d.userId && r.status === "accepted"
                  ? ["receive"]
                  : []
            ).map((action) => (
              <Button
                key={action}
                label={
                  action === "accept"
                    ? "Accept at gate"
                    : action === "receive"
                      ? "I received this delivery"
                      : action
                }
                variant="secondary"
                disabled={busy}
                onPress={() =>
                  void save(`deliveries/${r.id}/actions`, {
                    action,
                    revision: r.revision,
                  })
                }
              />
            ))}
            {(d.canManage || (recipient && r.userId === d.userId)) &&
              r.status === "expected" && (
                <Button
                  label="Cancel delivery"
                  variant="secondary"
                  disabled={busy}
                  onPress={() =>
                    void save(`deliveries/${r.id}/actions`, {
                      action: "cancel",
                      revision: r.revision,
                    })
                  }
                />
              )}
          </Card>
        ))}
    </>
  );
}
