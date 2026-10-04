import { useState } from "react";
import { Action, Card, Form, None, Status, iso, type ModuleProps } from "./ui";
import { propertyDateInput } from "../operations";
export function Deliveries({ data: d, mutate, busy }: ModuleProps) {
  const seller = d.userContext === 3;
  const [filter, setFilter] = useState("active");
  const providers = d.sellers.filter(
    (s) => s.userId === d.userId && s.status === "approved",
  );
  const requester = !d.canGate && d.role !== "watchman";
  const today = propertyDateInput(d.property.timezone);
  const rows = (d.deliveries ?? [])
    .filter((r) =>
      filter === "all" || filter === "pending"
        ? filter === "all" ||
          (r.approval === "pending" && r.status === "expected")
        : ["expected", "accepted"].includes(r.status),
    )
    .sort((a, b) => a.expectedAt.localeCompare(b.expectedAt));
  return (
    <Card
      title={
        d.canGate
          ? "Incoming delivery desk"
          : seller
            ? "My stock & incoming deliveries"
            : "My expected deliveries"
      }
      detail={
        d.canGate
          ? "Review bulk requests and record approved deliveries at the gate. Only the intended recipient can confirm receipt."
          : seller
            ? "Tell the gate about incoming stock. Bulk shipments need admin approval and handling instructions."
            : "Request an expected delivery, track acceptance at the gate, then confirm you received it."
      }
    >
      {requester && (!seller || providers.length > 0) && (
        <Form
          title={
            seller ? "Request incoming stock delivery" : "Expect a delivery"
          }
          submit="Notify the gate"
          busy={busy}
          fields={[
            ...(seller
              ? [
                  {
                    name: "sellerId",
                    label: "My store / provider",
                    options: providers.map((s) => ({ id: s.id, name: s.name })),
                    value: providers[0]?.id,
                  },
                  {
                    name: "size",
                    label: "Delivery size",
                    options: [
                      { id: "normal", name: "Small delivery" },
                      {
                        id: "bulk",
                        name: "Bulk stock shipment (admin approval)",
                      },
                    ],
                    value: "normal",
                  },
                ]
              : [
                  {
                    name: "unitId",
                    label: "Destination flat (optional)",
                    options: d.units
                      .filter((u) => d.myUnitIds.includes(u.id))
                      .map((u) => ({ id: u.id, name: u.label })),
                    optional: true,
                    hint: "Leave blank for collection at the community gate.",
                  },
                ]),
            {
              name: "name",
              label: "Carrier / supplier",
              hint: "For example, Amazon, a courier, or your stock supplier.",
            },
            {
              name: "reference",
              label: "Order / tracking reference",
              optional: true,
            },
            {
              name: "packages",
              label: "Number of packages",
              type: "number",
              min: 1,
              max: seller ? 10000 : 20,
              value: 1,
              hint: seller
                ? "Mark deliveries above 20 packages as bulk."
                : "Personal delivery: up to 20 packages.",
            },
            {
              name: "expectedAt",
              label: "Expected date & time",
              type: "datetime-local",
            },
            {
              name: "notes",
              label: "Handling instructions",
              type: "textarea",
              optional: true,
              hint: seller
                ? "Required for bulk: vehicle size, unloading help, storage or special handling."
                : "For example, leave with the watchman or call on arrival.",
            },
          ]}
          onSubmit={(v) =>
            mutate("deliveries", {
              ...v,
              unitId: v.unitId || null,
              sellerId: v.sellerId || null,
              bulk: seller && v.size === "bulk",
              expectedAt: iso(v.expectedAt),
            })
          }
        />
      )}
      {seller && !providers.length && (
        <None>
          Register and approve your provider in My store & products before
          requesting incoming business stock.
        </None>
      )}
      <div className="community-toolbar">
        <label>
          Show deliveries
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="active">Expected & at the gate</option>
            {d.canManage && (
              <option value="pending">Needs bulk approval</option>
            )}
            <option value="all">All deliveries</option>
          </select>
        </label>
      </div>
      {!rows.length && <None>No deliveries in this view.</None>}
      {rows.map((r) => (
        <article key={r.id} className="community-record">
          <div className="community-spread">
            <h3>{r.name}</h3>
            <Status
              value={
                r.bulk
                  ? "bulk shipment"
                  : r.sellerId
                    ? "business delivery"
                    : "personal parcel"
              }
            />
          </div>
          <p>
            {r.packages} package{r.packages === 1 ? "" : "s"} ·{" "}
            {new Date(r.expectedAt).toLocaleString()}
          </p>
          <p>
            {r.destination ?? "Community gate pickup"} · Recipient:{" "}
            {r.recipientName ?? "Community member"}
            {r.reference && ` · Reference: ${r.reference}`}
          </p>
          {r.notes && <p className="community-preserve">{r.notes}</p>}
          <div className="community-actions">
            <Status value={r.approval} />
            <Status value={r.status} />
            {d.canManage &&
              r.approval === "pending" &&
              r.status === "expected" && (
                <>
                  <Action
                    path="deliveries"
                    row={r}
                    action="approve"
                    label="Approve bulk delivery"
                    mutate={mutate}
                    busy={busy}
                  />
                  <Action
                    path="deliveries"
                    row={r}
                    action="deny"
                    label="Deny"
                    mutate={mutate}
                    busy={busy}
                  />
                </>
              )}
            {d.canGate &&
              r.approval === "approved" &&
              r.status === "expected" &&
              propertyDateInput(d.property.timezone, new Date(r.expectedAt)) ===
                today && (
                <Action
                  path="deliveries"
                  row={r}
                  action="accept"
                  label="Accept at gate"
                  mutate={mutate}
                  busy={busy}
                />
              )}{" "}
            {requester && r.userId === d.userId && r.status === "accepted" && (
              <Action
                path="deliveries"
                row={r}
                action="receive"
                label="I received this delivery"
                mutate={mutate}
                busy={busy}
              />
            )}{" "}
            {(d.canManage || (requester && r.userId === d.userId)) &&
              r.status === "expected" && (
                <Action
                  path="deliveries"
                  row={r}
                  action="cancel"
                  label="Cancel delivery"
                  mutate={mutate}
                  busy={busy}
                />
              )}
          </div>
          {r.acceptedAt && (
            <small>
              Accepted at gate: {new Date(r.acceptedAt).toLocaleString()}
              {r.receivedAt &&
                ` · Received: ${new Date(r.receivedAt).toLocaleString()}`}
            </small>
          )}
        </article>
      ))}
    </Card>
  );
}
