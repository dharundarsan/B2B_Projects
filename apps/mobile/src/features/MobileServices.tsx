import { MobileProviders } from "./MobileProviders";
import { Text, View } from "react-native";
import type { CommunityData, Service } from "../../../../shared/community";
import { Badge, Button, Card, Empty, Section, s } from "../components/ui";
import { Form, type Input, type Save } from "./CommunityForm";
const choices = (...values: string[]) =>
  values.map((value) => ({ value, label: value }));
const money = (n: number, c: string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: c }).format(n);
export function MobileServices({
  data: d,
  save,
  busy,
}: {
  data: CommunityData;
  save: Save;
  busy: boolean;
}) {
  const provider = d.canManage || d.userContext === 3;
  const sellers = d.sellers
    .filter(
      (s) => s.status === "approved" && (d.canManage || s.userId === d.userId),
    )
    .map((s) => ({ value: s.id, label: s.name }));
  const fields = (service?: Service): Input[] => [
    {
      name: "sellerId",
      label: "Store / provider",
      options: sellers,
      value: service?.sellerId ?? sellers[0]?.value,
    },
    { name: "name", label: "Service name", value: service?.name },
    {
      name: "category",
      label: "Category",
      value: service?.category ?? "Home services",
    },
    {
      name: "description",
      label: "What you offer",
      multiline: true,
      value: service?.description,
    },
    {
      name: "price",
      label: "Price",
      number: true,
      value: service ? String(service.price) : "",
    },
    { name: "currency", label: "Currency", value: service?.currency ?? "INR" },
    {
      name: "priceUnit",
      label: "Price per",
      options: choices("visit", "hour", "fixed"),
      value: service?.priceUnit ?? "visit",
    },
    {
      name: "status",
      label: "Availability",
      options: choices("active", "paused"),
      value: service?.status ?? "active",
    },
  ];
  return (
    <View style={{ gap: 18 }}>
      {provider && <MobileProviders data={d} save={save} busy={busy} />}
      <Section title={provider ? "Service catalogue" : "Community services"} />
      {provider && sellers.length > 0 && (
        <Form
          title="Add service"
          fields={fields()}
          busy={busy}
          save={(v) => save("services", { ...v, price: Number(v.price) })}
        />
      )}{" "}
      {provider && !sellers.length && (
        <Empty
          title="An approved provider profile is needed"
          detail="Register your provider profile above, then ask an administrator to approve it."
        />
      )}
      {d.services.map((service) => (
        <Card key={service.id}>
          <Text style={s.h3}>{service.name}</Text>
          <Text style={s.small}>
            {service.category} ·{" "}
            {d.sellers.find((s) => s.id === service.sellerId)?.name}
          </Text>
          <Text style={s.body}>{service.description}</Text>
          <Text style={s.label}>
            {money(service.price, service.currency)} / {service.priceUnit}
          </Text>
          <Badge label={service.status} />
          {provider ? (
            <Form
              title="Edit service"
              busy={busy}
              fields={fields(service)}
              save={(v) =>
                save(
                  `services/${service.id}`,
                  { ...v, price: Number(v.price), revision: service.revision },
                  "PATCH",
                )
              }
            />
          ) : (
            <Form
              title="Request service"
              fields={[
                {
                  name: "description",
                  label: "What do you need?",
                  multiline: true,
                },
                {
                  name: "preferredAt",
                  label: "Preferred time",
                  hint: "Date/time with timezone. The provider will confirm.",
                },
              ]}
              busy={busy}
              save={(v) =>
                save("service-requests", {
                  ...v,
                  serviceId: service.id,
                  preferredAt: new Date(v.preferredAt ?? "").toISOString(),
                })
              }
            />
          )}
        </Card>
      ))}
      {!d.services.length && <Empty title="No services listed yet" />}
      <Section title={provider ? "Customer requests" : "My service requests"} />
      {d.serviceRequests.map((r) => (
        <Card key={r.id}>
          <Text style={s.h3}>{r.serviceName}</Text>
          <Text style={s.body}>{r.description}</Text>
          <Text style={s.small}>
            {new Date(r.preferredAt).toLocaleString()} ·{" "}
            {money(r.price, r.currency)} / {r.priceUnit}
          </Text>
          <Badge label={r.status} />
          {(provider && r.status === "requested"
            ? ["accept", "decline"]
            : provider && r.status === "accepted"
              ? ["complete"]
              : []
          ).map((action) => (
            <Button
              key={action}
              label={action}
              variant="secondary"
              disabled={busy}
              onPress={() =>
                void save(`service-requests/${r.id}/actions`, {
                  action,
                  revision: r.revision,
                })
              }
            />
          ))}
          {["requested", "accepted"].includes(r.status) && (
            <Button
              label="Cancel request"
              variant="secondary"
              disabled={busy}
              onPress={() =>
                void save(`service-requests/${r.id}/actions`, {
                  action: "cancel",
                  revision: r.revision,
                })
              }
            />
          )}
        </Card>
      ))}
    </View>
  );
}
