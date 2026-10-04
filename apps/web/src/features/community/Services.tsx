import { useState } from "react";
import { ProviderSetup, OfferAccess } from "./ProviderSetup";
import { Wrench } from "lucide-react";
import type { Service } from "../../../../../shared/community";
import {
  Card,
  Form,
  None,
  Status,
  Action,
  amount,
  iso,
  opts,
  type FieldSpec,
  type ModuleProps,
} from "./ui";
const fields = (
  sellers: { id: string; name: string }[],
  s?: Service,
): FieldSpec[] => [
  {
    name: "sellerId",
    label: "Store / provider",
    options: sellers,
    value: s?.sellerId ?? sellers[0]?.id,
  },
  { name: "name", label: "Service name", value: s?.name },
  {
    name: "category",
    label: "Category",
    value: s?.category ?? "Home services",
  },
  {
    name: "description",
    label: "What you offer",
    type: "textarea",
    value: s?.description,
  },
  { name: "price", label: "Price", type: "number", min: 0.01, value: s?.price },
  { name: "currency", label: "Currency", value: s?.currency ?? "INR" },
  {
    name: "priceUnit",
    label: "Price per",
    options: opts("visit", "hour", "fixed"),
    value: s?.priceUnit ?? "visit",
  },
  {
    name: "status",
    label: "Availability",
    options: opts("active", "paused"),
    value: s?.status ?? "active",
  },
];
export function Services({
  data: d,
  mutate,
  busy,
  initialSearch = "",
}: ModuleProps & { initialSearch?: string }) {
  const [search, setSearch] = useState(initialSearch);
  const provider = d.userContext === 3 || d.canManage;
  const sellers = d.sellers
    .filter(
      (s) => (d.canManage || s.userId === d.userId) && s.status === "approved",
    )
    .map((s) => ({ id: s.id, name: s.name }));
  return (
    <div className="community-stack">
      {provider ? (
        <ProviderSetup data={d} role={d.role} mutate={mutate} busy={busy} />
      ) : (
        <OfferAccess property={d.property.id} section="services" />
      )}
      <Card
        title={
          d.canManage
            ? "Service administration"
            : provider
              ? "Your service catalogue"
              : "Services from your community"
        }
        detail={
          provider
            ? "Offer a skill or service through an approved store / provider profile."
            : "Request help from people and businesses inside your apartment. Confirm timing and payment directly with the provider."
        }
      >
        {provider && sellers.length > 0 && (
          <Form
            title="Add service"
            fields={fields(sellers)}
            busy={busy}
            onSubmit={(v) => mutate("services", v)}
          />
        )}
        {provider && !sellers.length && (
          <None>
            Register a provider above, then get it approved to add your
            services.
          </None>
        )}
        <label className="ch-service-search">
          Search services
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cooking, tuition, repairs…"
          />
        </label>
        <div className="community-grid">
          {d.services
            .filter((s) =>
              `${s.name} ${s.category} ${s.description}`
                .toLowerCase()
                .includes(search.toLowerCase()),
            )
            .map((service) => (
              <section className="ch-service" key={service.id}>
                <div className="ch-service-icon">
                  <Wrench size={23} />
                </div>
                <div className="community-actions">
                  <span className="ch-eyebrow">{service.category}</span>
                  <Status value={service.status} />
                </div>
                <h3>{service.name}</h3>
                <p>{service.description}</p>
                <small>
                  {d.sellers.find((s) => s.id === service.sellerId)?.name ??
                    "Community provider"}
                </small>
                <strong className="ch-service-price">
                  {amount(service.price, service.currency)}{" "}
                  <small>/ {service.priceUnit}</small>
                </strong>
                {provider ? (
                  <Form
                    title="Edit service"
                    fields={fields(sellers, service)}
                    busy={busy}
                    onSubmit={(v) =>
                      mutate(
                        `services/${service.id}`,
                        { ...v, revision: service.revision },
                        "PATCH",
                      )
                    }
                  />
                ) : (
                  service.status === "active" && (
                    <Form
                      title="Request service"
                      submit="Send request"
                      fields={[
                        {
                          name: "description",
                          label: "What do you need?",
                          type: "textarea",
                        },
                        {
                          name: "preferredAt",
                          label: "Preferred time",
                          type: "datetime-local",
                          hint: "The provider will confirm your appointment.",
                        },
                      ]}
                      busy={busy}
                      onSubmit={(v) =>
                        mutate("service-requests", {
                          serviceId: service.id,
                          description: v.description,
                          preferredAt: iso(v.preferredAt),
                          submissionId: v.__submissionId,
                        })
                      }
                    />
                  )
                )}
              </section>
            ))}
        </div>
        {!d.services.length && <None>No services listed yet.</None>}
      </Card>
      <Card
        title={
          d.canManage
            ? "Community service requests"
            : provider
              ? "Customer service requests"
              : "My service requests"
        }
      >
        <div className="ch-task-list">
          {d.serviceRequests.map((r) => (
            <section key={r.id} className="community-row">
              <div>
                <h3>{r.serviceName}</h3>
                <p>{r.description}</p>
                <small>
                  {new Date(r.preferredAt).toLocaleString()} ·{" "}
                  {amount(r.price, r.currency)} / {r.priceUnit}
                </small>
                <Status value={r.status} />
              </div>
              <div className="community-actions">
                {provider && r.status === "requested" && (
                  <>
                    <Action
                      path="service-requests"
                      row={r}
                      action="accept"
                      label="Accept"
                      mutate={mutate}
                      busy={busy}
                    />
                    <Action
                      path="service-requests"
                      row={r}
                      action="decline"
                      label="Decline"
                      mutate={mutate}
                      busy={busy}
                    />
                  </>
                )}
                {provider && r.status === "accepted" && (
                  <Action
                    path="service-requests"
                    row={r}
                    action="complete"
                    label="Mark completed"
                    mutate={mutate}
                    busy={busy}
                  />
                )}
                {["requested", "accepted"].includes(r.status) && (
                  <Action
                    path="service-requests"
                    row={r}
                    action="cancel"
                    label="Cancel request"
                    mutate={mutate}
                    busy={busy}
                  />
                )}
              </div>
            </section>
          ))}
        </div>
        {!d.serviceRequests.length && <None>No service requests yet.</None>}
      </Card>
    </div>
  );
}
