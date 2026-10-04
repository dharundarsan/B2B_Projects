import { MobileReports } from "./MobileReports";
import { MobileDeliveries } from "./MobileDeliveries";
import { MobileProviders } from "./MobileProviders";
import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Form, type Save } from "./CommunityForm";
import { MobileUsers } from "./MobileUsers";
import { MobileServices } from "./MobileServices";
import { MobileCommunityAdmin } from "./MobileCommunityAdmin";
import { MobileBuildingAdmin } from "./MobileBuildingAdmin";
import { request } from "../lib/api";
import { useAuth } from "../providers/AuthProvider";
import { useResource } from "../hooks/useResource";
import { communityApi } from "../lib/communityApi";
import {
  Badge,
  Button,
  Card,
  Chips,
  Empty,
  Field,
  Heading,
  Loading,
  Notice,
  Screen,
  Section,
  s,
} from "../components/ui";
import type {
  CommunityContext,
  CommunityData,
  Row,
} from "../../../../shared/community";
const money = (n: number, c: string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: c }).format(n);
const options = (...values: string[]) =>
  values.map((value) => ({ value, label: value.replaceAll("_", " ") }));
export default function MobileCommunity() {
  const { preview, context: account } = useAuth();
  const context = useResource<CommunityContext | null>(
    useCallback(
      (signal) =>
        preview ? Promise.resolve(null) : communityApi.context(signal),
      [preview],
    ),
    null,
  );
  const [selected, setSelected] = useState("");
  const property = selected || context.data?.properties[0]?.id || "";
  const resource = useResource<CommunityData | null>(
    useCallback(
      (signal) =>
        property && !preview
          ? communityApi.read(property, signal)
          : Promise.resolve(null),
      [property, preview],
    ),
    null,
  );
  useEffect(() => {
    resource.refresh();
  }, [property, preview]);
  const [tab, setTab] = useState("home");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save: Save = async (path, body, method) => {
    if (busy) return false;
    setError("");
    setBusy(true);
    try {
      await communityApi.send(property, path, body, method);
      resource.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
      return false;
    } finally {
      setBusy(false);
    }
  };
  const rootSave: Save = async (path, body, method = "POST") => {
    if (busy) return false;
    setBusy(true);
    setError("");
    try {
      await request(path, { method, body: JSON.stringify(body) });
      context.refresh();
      resource.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
      return false;
    } finally {
      setBusy(false);
    }
  };
  if (preview)
    return (
      <Screen>
        <Heading
          title="Community"
          subtitle="Shops, rent, facilities and building operations."
        />
        <Notice message="Sign in to use your building's community features. The maintenance preview contains synthetic repair data only." />
      </Screen>
    );
  const d = resource.data;
  const buildingDay = new Intl.DateTimeFormat("en-CA", {
    timeZone: d?.property.timezone ?? "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const role = d?.role || context.data?.role || "";
  const admin = context.data?.userContext === 2;
  const provider = context.data?.userContext === 3;
  const tabs = admin
    ? [
        "home",
        "people",
        "setup",
        "reports",
        "market",
        "services",
        "orders",
        "groups",
        "rent",
        "facilities",
        "gate",
        "notices",
        "map",
      ]
    : provider
      ? ["home", "market", "services", "orders", "groups", "gate"]
      : role === "watchman"
        ? ["home", "gate", "notices", "map"]
        : [
            "home",
            "market",
            "services",
            "orders",
            "groups",
            "rent",
            "facilities",
            "gate",
            "notices",
            "map",
          ];
  const current = tabs.includes(tab) ? tab : "home";
  const action = (path: string, row: Row, verb: string, label: string) => (
    <Button
      key={verb}
      label={label}
      variant="secondary"
      disabled={busy}
      onPress={() =>
        void save(`${path}/${row.id}/actions`, {
          action: verb,
          revision: row.revision,
        })
      }
    />
  );
  const unit = (id: string) =>
    d?.units.find((u) => u.id === id)?.label ?? "Unit";
  const party = (id: string) =>
    d?.parties.find((p) => p.id === id)?.name ?? "Account";
  const sellerOptions =
    d?.sellers
      .filter(
        (seller) =>
          (d.canManage || (provider && seller.userId === d.userId)) &&
          seller.status === "approved",
      )
      .map((seller) => ({ value: seller.id, label: seller.name })) ?? [];
  return (
    <Screen
      refreshing={resource.loading || context.loading}
      onRefresh={() => {
        context.refresh();
        resource.refresh();
      }}
    >
      <Heading
        title={
          admin
            ? "Admin dashboard"
            : provider
              ? "Seller / Provider"
              : "My community"
        }
        subtitle={
          admin
            ? "Buildings, accounts, finance, stores and operations."
            : provider
              ? "Your products, services and customer requests."
              : "Life inside your apartment."
        }
      />

      {context.error && (
        <Notice message={context.error} danger onRetry={context.refresh} />
      )}
      {resource.error && (
        <Notice message={resource.error} danger onRetry={resource.refresh} />
      )}
      {error && <Notice message={error} danger />}
      <Chips
        options={tabs.map((value) => ({
          value,
          label:
            value === "home"
              ? "Overview"
              : value === "people"
                ? "People & access"
                : value === "rent"
                  ? "Rent & expenses"
                  : value === "setup"
                    ? "Building setup"
                    : value === "market" && provider
                      ? "My store"
                      : value,
        }))}
        value={current}
        onChange={setTab}
      />
      {admin && current === "people" ? (
        <MobileUsers properties={context.data?.properties ?? []} />
      ) : context.loading ? (
        <Loading />
      ) : !context.data?.properties.length ? (
        admin ? (
          <MobileCommunityAdmin
            data={null}
            save={save}
            rootSave={rootSave}
            busy={busy}
          />
        ) : (
          <Empty
            title="No building assigned"
            detail="Ask your manager to bind your occupancy, ownership or master lease."
          />
        )
      ) : (
        <>
          <Chips
            options={context.data.properties.map((p) => ({
              value: p.id,
              label: p.name,
            }))}
            value={property}
            onChange={(v) => {
              setSelected(v);
              setError("");
            }}
          />
          {!d || d.property.id !== property ? (
            <Loading />
          ) : (
            <>
              {current === "home" && (
                <>
                  <Card dark>
                    <Text style={[s.eyebrow, { color: "#c6dbad" }]}>
                      COMMUNITYHUB
                    </Text>
                    <Text style={[s.h2, { color: "white" }]}>
                      {provider
                        ? "Your neighbourhood business"
                        : admin
                          ? "A place to manage it all"
                          : "Everyday living, made easier"}
                    </Text>
                    <Text style={[s.body, { color: "#cbdad2" }]}>
                      {d.property.name}
                    </Text>
                  </Card>
                  <View style={s.row}>
                    <View style={s.metric}>
                      <Text style={s.number}>
                        {
                          d.orders.filter(
                            (o) =>
                              !["handed_over", "cancelled"].includes(o.status),
                          ).length
                        }
                      </Text>
                      <Text style={s.small}>Open orders</Text>
                    </View>
                    <View style={s.metric}>
                      <Text style={s.number}>
                        {
                          d.serviceRequests.filter((r) =>
                            ["requested", "accepted"].includes(r.status),
                          ).length
                        }
                      </Text>
                      <Text style={s.small}>Service requests</Text>
                    </View>
                  </View>
                  <Button
                    label={
                      admin
                        ? "Manage people"
                        : provider
                          ? "My store & products"
                          : "Shop your apartment"
                    }
                    icon={admin ? "people-outline" : "storefront-outline"}
                    onPress={() => setTab(admin ? "people" : "market")}
                  />
                  <Button
                    label={provider ? "Offer services" : "Community services"}
                    variant="secondary"
                    onPress={() => setTab("services")}
                  />
                  {!provider &&
                    d.notes
                      .filter((n) => n.kind === "notice")
                      .slice(-3)
                      .map((n) => (
                        <Card key={n.id}>
                          <Text style={s.h3}>{n.title}</Text>
                          <Text style={s.body}>{n.body}</Text>
                        </Card>
                      ))}
                </>
              )}
              {current === "reports" && admin && <MobileReports data={d} />}
              {current === "services" && (
                <MobileServices data={d} save={save} busy={busy} />
              )}
              {current === "setup" && admin && (
                <MobileCommunityAdmin
                  data={d}
                  save={save}
                  rootSave={rootSave}
                  busy={busy}
                />
              )}
              {current === "market" && (
                <>
                  {d.products
                    .filter(
                      (p) =>
                        p.status === "active" &&
                        d.sellers.some(
                          (seller) =>
                            seller.id === p.sellerId &&
                            seller.status === "approved",
                        ),
                    )
                    .map((p) => (
                      <Card key={p.id}>
                        <Text style={s.h3}>{p.name}</Text>
                        <Text style={s.body}>
                          {
                            d.sellers.find((seller) => seller.id === p.sellerId)
                              ?.name
                          }{" "}
                          · {p.description}
                        </Text>
                        {p.kind === "food" && (
                          <Text style={s.small}>
                            Ingredients: {p.ingredients}
                            {"\n"}Allergens: {p.allergens}
                          </Text>
                        )}
                        <Text style={s.h3}>
                          {money(p.price, p.currency)} · {p.stock} available
                        </Text>
                        <Text style={s.small}>
                          Pickup:{" "}
                          {
                            d.sellers.find((seller) => seller.id === p.sellerId)
                              ?.pickup
                          }
                        </Text>
                        {p.stock > 0 && !d.canManage && !provider && (
                          <Form
                            title="Buy item"
                            fields={[
                              {
                                name: "quantity",
                                label: "Quantity",
                                number: true,
                                value: "1",
                              },
                            ]}
                            busy={busy}
                            save={(v) =>
                              save("orders", {
                                productId: p.id,
                                quantity: Number(v.quantity),
                                submissionId: v.submissionId,
                              })
                            }
                          />
                        )}
                      </Card>
                    ))}
                  {(provider || admin) && (
                    <Card>
                      <MobileProviders data={d} save={save} busy={busy} />
                      {sellerOptions.length > 0 && (
                        <Form
                          title="List a product"
                          busy={busy}
                          fields={[
                            {
                              name: "sellerId",
                              label: "Store",
                              options: sellerOptions,
                              value: sellerOptions[0]?.value,
                            },
                            { name: "name", label: "Name" },
                            {
                              name: "description",
                              label: "Description",
                              multiline: true,
                            },
                            {
                              name: "kind",
                              label: "Type",
                              options: options("grocery", "food", "product"),
                              value: "grocery",
                            },
                            {
                              name: "ingredients",
                              label: "Ingredients (food)",
                            },
                            { name: "allergens", label: "Allergens (food)" },
                            { name: "price", label: "Price", number: true },
                            {
                              name: "stock",
                              label: "Stock",
                              number: true,
                              value: "10",
                            },
                            {
                              name: "currency",
                              label: "Currency",
                              value: "INR",
                            },
                          ]}
                          save={(v) =>
                            save("products", {
                              ...v,
                              price: Number(v.price),
                              stock: Number(v.stock),
                              status: "active",
                            })
                          }
                        />
                      )}
                      {d.products
                        .filter((p) =>
                          sellerOptions.some(
                            (seller) => seller.value === p.sellerId,
                          ),
                        )
                        .map((p) => (
                          <View key={p.id} style={{ gap: 10 }}>
                            <Text style={s.h3}>{p.name}</Text>
                            <Text style={s.small}>
                              {money(p.price, p.currency)} · {p.stock} available
                            </Text>
                            <Form
                              title="Edit price and stock"
                              busy={busy}
                              fields={[
                                {
                                  name: "price",
                                  label: "Price",
                                  number: true,
                                  value: String(p.price),
                                },
                                {
                                  name: "stock",
                                  label: "Available stock",
                                  number: true,
                                  value: String(p.stock),
                                },
                                {
                                  name: "status",
                                  label: "Availability",
                                  options: options("active", "paused"),
                                  value: p.status,
                                },
                              ]}
                              save={(v) =>
                                save(
                                  "products/" + p.id,
                                  {
                                    ...p,
                                    price: Number(v.price),
                                    stock: Number(v.stock),
                                    status: v.status,
                                    revision: p.revision,
                                  },
                                  "PATCH",
                                )
                              }
                            />
                          </View>
                        ))}
                    </Card>
                  )}
                </>
              )}
              {current === "orders" && (
                <>
                  {!d.orders.length && <Empty title="No orders yet" />}
                  {[...d.orders].reverse().map((o) => {
                    const manages =
                      d.canManage ||
                      (provider &&
                        d.sellers.some(
                          (seller) =>
                            seller.id === o.sellerId &&
                            seller.userId === d.userId,
                        ));
                    return (
                      <Card key={o.id}>
                        <Text style={s.h3}>
                          {d.products.find((p) => p.id === o.productId)?.name ??
                            "Product"}{" "}
                          × {o.quantity}
                        </Text>
                        <Text style={s.body}>
                          {money(o.unitPrice * o.quantity, o.currency)} · Order{" "}
                          {o.id.slice(0, 8)}
                        </Text>
                        <Badge label={o.status} />
                        <Badge label={o.paymentStatus} />
                        {manages &&
                          o.status === "placed" &&
                          action("orders", o, "accept", "Accept order")}
                        {manages &&
                          o.status === "accepted" &&
                          action("orders", o, "ready", "Ready for pickup")}
                        {manages &&
                          o.status === "ready" &&
                          action("orders", o, "handover", "Record handover")}
                        {(o.status === "placed" ||
                          (manages &&
                            ["accepted", "ready"].includes(o.status))) &&
                          action("orders", o, "cancel", "Cancel order")}
                        {manages &&
                          o.status !== "cancelled" &&
                          o.paymentStatus === "unpaid" &&
                          action(
                            "orders",
                            o,
                            "paid",
                            "Confirm payment received",
                          )}
                        {manages &&
                          o.paymentStatus === "refund_due" &&
                          action(
                            "orders",
                            o,
                            "refunded",
                            "Confirm refund sent",
                          )}
                      </Card>
                    );
                  })}
                </>
              )}
              {current === "groups" && (
                <>
                  <Notice message="Commit before the deadline. Orders are created only after the minimum quantity and stock checks pass. No upfront payment is collected." />
                  {d.groups.map((g) => (
                    <Card key={g.id}>
                      <Text style={s.h3}>
                        {d.products.find((p) => p.id === g.productId)?.name ??
                          "Group buy"}
                      </Text>
                      <Badge label={g.status} />
                      <Text style={s.body}>
                        {money(g.unitPrice, g.currency)} · {g.committed}/
                        {g.minimum} minimum · Your quantity {g.myQuantity}
                      </Text>
                      <Text style={s.small}>
                        Deadline {new Date(g.closesAt).toLocaleString()}
                        {"\n"}Pickup: {g.pickup}
                      </Text>
                      {g.status === "open" &&
                        !d.canManage &&
                        !provider &&
                        new Date(g.closesAt).getTime() > Date.now() && (
                          <Form
                            title="Commit / change quantity"
                            fields={[
                              {
                                name: "quantity",
                                label: "Quantity (0 withdraws)",
                                number: true,
                                value: String(g.myQuantity || 1),
                              },
                            ]}
                            busy={busy}
                            save={(v) =>
                              save(`groups/${g.id}/pledge`, {
                                quantity: Number(v.quantity),
                                revision: g.revision,
                              })
                            }
                          />
                        )}{" "}
                      {(d.canManage ||
                        (provider &&
                          d.sellers.some(
                            (seller) =>
                              seller.id === g.sellerId &&
                              seller.userId === d.userId,
                          ))) &&
                        g.status === "open" && (
                          <>
                            {new Date(g.closesAt).getTime() <= Date.now() &&
                              action("groups", g, "finalize", "Finalize group")}
                            {action("groups", g, "cancel", "Cancel group")}
                          </>
                        )}
                    </Card>
                  ))}
                  {sellerOptions.length > 0 && (
                    <Card>
                      <Form
                        title="Create group buy"
                        busy={busy}
                        fields={[
                          {
                            name: "productId",
                            label: "Product",
                            options: d.products
                              .filter((p) =>
                                sellerOptions.some(
                                  (seller) => seller.value === p.sellerId,
                                ),
                              )
                              .map((p) => ({ value: p.id, label: p.name })),
                          },
                          {
                            name: "unitPrice",
                            label: "Locked price",
                            number: true,
                          },
                          {
                            name: "minimum",
                            label: "Minimum quantity",
                            number: true,
                            value: "5",
                          },
                          {
                            name: "maximum",
                            label: "Maximum quantity",
                            number: true,
                            value: "50",
                          },
                          {
                            name: "closesAt",
                            label: "Deadline including timezone",
                            value: new Date(
                              Date.now() + 86400000,
                            ).toISOString(),
                          },
                          { name: "pickup", label: "Pickup plan" },
                        ]}
                        save={(v) =>
                          save("groups", {
                            ...v,
                            unitPrice: Number(v.unitPrice),
                            minimum: Number(v.minimum),
                            maximum: Number(v.maximum),
                          })
                        }
                      />
                    </Card>
                  )}
                </>
              )}
              {current === "rent" && (
                <>
                  {d.charges.map((c) => {
                    const agreement = d.agreements.find(
                      (a) => a.id === c.agreementId,
                    );
                    const creditor =
                      d.canManage ||
                      (["unit_owner", "operator"].includes(role) &&
                        d.myPartyIds.includes(
                          agreement?.creditorPartyId ?? "",
                        ));
                    return (
                      <Card key={c.id}>
                        <Text style={s.h3}>
                          {c.kind} · {c.period}
                        </Text>
                        <Text style={s.body}>
                          {party(agreement?.debtorPartyId ?? "")} →{" "}
                          {party(agreement?.creditorPartyId ?? "")}
                          {"\n"}Due {c.dueOn}
                        </Text>
                        <Text style={s.h3}>
                          {money(c.amount - c.verifiedPaid, c.currency)}{" "}
                          remaining
                        </Text>
                        <Text style={s.small}>
                          Verified {money(c.verifiedPaid, c.currency)} of{" "}
                          {money(c.amount, c.currency)}
                        </Text>
                        {(role === "tenant" ||
                          d.canManage ||
                          (role === "operator" &&
                            d.myPartyIds.includes(
                              agreement?.debtorPartyId ?? "",
                            ))) &&
                          c.amount > c.verifiedPaid && (
                            <Form
                              title="Report payment"
                              busy={busy}
                              fields={[
                                {
                                  name: "amount",
                                  label: "Amount",
                                  number: true,
                                  value: String(c.amount - c.verifiedPaid),
                                },
                                {
                                  name: "reference",
                                  label: "Bank / UPI / cash reference",
                                },
                              ]}
                              save={(v) =>
                                save("payments", {
                                  chargeId: c.id,
                                  amount: Number(v.amount),
                                  reference: v.reference,
                                  submissionId: v.submissionId,
                                })
                              }
                            />
                          )}{" "}
                        {d.payments
                          .filter((p) => p.chargeId === c.id)
                          .map((p) => (
                            <View key={p.id} style={{ gap: 8 }}>
                              <Text style={s.body}>
                                {money(p.amount, c.currency)} · {p.reference}
                              </Text>
                              <Badge label={p.status} />
                              {creditor && p.status === "pending" && (
                                <>
                                  {action(
                                    "payments",
                                    p,
                                    "verify",
                                    "Verify payment",
                                  )}
                                  {action(
                                    "payments",
                                    p,
                                    "reject",
                                    "Reject payment",
                                  )}
                                </>
                              )}
                            </View>
                          ))}
                      </Card>
                    );
                  })}
                  {!d.charges.length && (
                    <Empty
                      title="No rent charges"
                      detail="Your landlord or operator can generate this month's rent."
                    />
                  )}
                  {["unit_owner", "operator", "owner", "manager"].includes(
                    role,
                  ) && (
                    <Card>
                      <Form
                        title="Generate monthly rent"
                        busy={busy}
                        fields={[
                          {
                            name: "month",
                            label: "Billing month YYYY-MM",
                            value: buildingDay.slice(0, 7),
                          },
                        ]}
                        save={(v) => save("rent/generate", { month: v.month })}
                      />
                    </Card>
                  )}
                  <Section title="Expenses" />
                  {(d.canManage ||
                    ["unit_owner", "operator"].includes(role)) && (
                    <Card>
                      <Form
                        title="Record expense"
                        busy={busy}
                        fields={[
                          {
                            name: "scope",
                            label: "Expense scope",
                            options: options(
                              ...(d.canManage
                                ? ["community", "unit", "operator"]
                                : role === "operator"
                                  ? ["operator"]
                                  : ["unit"]),
                            ),
                            value: d.canManage
                              ? "community"
                              : role === "operator"
                                ? "operator"
                                : "unit",
                          },
                          {
                            name: "unitId",
                            label: "Unit (unit expenses)",
                            options: d.units.map((u) => ({
                              value: u.id,
                              label: u.label,
                            })),
                          },
                          {
                            name: "partyId",
                            label: "Operator party (operator expenses)",
                            options: d.parties.map((p) => ({
                              value: p.id,
                              label: p.name,
                            })),
                          },
                          {
                            name: "category",
                            label: "Category",
                            value: "Maintenance",
                          },
                          {
                            name: "description",
                            label: "Description",
                            multiline: true,
                          },
                          { name: "amount", label: "Amount", number: true },
                          { name: "currency", label: "Currency", value: "INR" },
                          {
                            name: "incurredOn",
                            label: "Date YYYY-MM-DD",
                            value: buildingDay,
                          },
                          {
                            name: "paidStatus",
                            label: "Payment state",
                            options: options("unpaid", "paid"),
                            value: "unpaid",
                          },
                        ]}
                        save={(v) =>
                          save("expenses", {
                            ...v,
                            unitId: v.unitId || null,
                            partyId: v.partyId || null,
                            amount: Number(v.amount),
                            allocations: [],
                          })
                        }
                      />
                    </Card>
                  )}
                  {d.expenses.map((e) => (
                    <Card key={e.id}>
                      <Text style={s.h3}>
                        {e.category} · {e.description}
                      </Text>
                      <Text style={s.body}>
                        {money(e.amount, e.currency)} · {e.scope} ·{" "}
                        {e.incurredOn}
                      </Text>
                      <Badge label={e.paidStatus} />
                      {e.allocations.map((a) => (
                        <Text style={s.small} key={a.partyId}>
                          {party(a.partyId)}: {money(a.amount, e.currency)}
                        </Text>
                      ))}
                      {action(
                        "expenses",
                        e,
                        e.paidStatus === "paid" ? "unpaid" : "paid",
                        e.paidStatus === "paid" ? "Mark unpaid" : "Mark paid",
                      )}
                    </Card>
                  ))}
                </>
              )}
              {current === "facilities" && (
                <>
                  {d.facilities.map((f) => (
                    <Card key={f.id}>
                      <Text style={s.h3}>{f.name}</Text>
                      <Text style={s.body}>
                        {f.rules}
                        {"\n"}
                        {f.slotMinutes} minutes · {money(f.price, f.currency)} ·
                        Capacity {f.capacity}
                      </Text>
                      {f.status === "active" && !d.canManage && (
                        <Form
                          title="Book a slot"
                          busy={busy}
                          fields={[
                            {
                              name: "startsAt",
                              label: "Start including timezone",
                              value: new Date(
                                Date.now() + 3600000,
                              ).toISOString(),
                            },
                          ]}
                          save={(v) =>
                            save("bookings", {
                              facilityId: f.id,
                              startsAt: v.startsAt,
                              submissionId: v.submissionId,
                            })
                          }
                        />
                      )}
                    </Card>
                  ))}
                  <Section title="Your reservations" />
                  {d.bookings.map((b) => (
                    <Card key={b.id}>
                      <Text style={s.h3}>
                        {d.facilities.find((f) => f.id === b.facilityId)?.name}
                      </Text>
                      <Text style={s.body}>
                        {new Date(b.startsAt).toLocaleString()}
                      </Text>
                      <Badge label={b.status} />
                      {b.status === "confirmed" &&
                        new Date(b.startsAt).getTime() > Date.now() &&
                        action("bookings", b, "cancel", "Cancel booking")}
                    </Card>
                  ))}
                </>
              )}
              {current === "gate" && (
                <>
                  <MobileDeliveries data={d} save={save} busy={busy} />
                  {(role === "tenant" || d.canGate) && (
                    <Card>
                      <Form
                        title="Expected visitor / parcel"
                        busy={busy}
                        fields={[
                          {
                            name: "kind",
                            label: "Type",
                            value: "visitor",
                            options: options(
                              "visitor",
                              "delivery",
                              "contractor",
                              "parcel",
                            ),
                          },
                          { name: "name", label: "Visitor / delivery name" },
                          {
                            name: "unitId",
                            label: "Destination",
                            options: d.units
                              .filter(
                                (u) => d.canGate || d.myUnitIds.includes(u.id),
                              )
                              .map((u) => ({ value: u.id, label: u.label })),
                          },
                          {
                            name: "expectedAt",
                            label: "Expected date and time with timezone",
                            value: new Date(Date.now() + 3600000).toISOString(),
                          },
                        ]}
                        save={(v) =>
                          save("gate", {
                            ...v,
                            residentUserId: null,
                            occupancyId: null,
                          })
                        }
                      />
                    </Card>
                  )}
                  {d.gateEntries.map((g) => (
                    <Card key={g.id}>
                      <Text style={s.h3}>
                        {g.name} · {unit(g.unitId)}
                      </Text>
                      <Text style={s.body}>
                        {g.kind} · {new Date(g.expectedAt).toLocaleString()}
                      </Text>
                      <Badge label={g.approval} />
                      <Badge label={g.status} />
                      {g.approval === "pending" &&
                        (role === "tenant" || d.canManage) && (
                          <>
                            {action("gate", g, "approve", "Approve entry")}
                            {action("gate", g, "deny", "Deny entry")}
                          </>
                        )}
                      {d.canGate &&
                        g.approval === "approved" &&
                        g.status === "expected" &&
                        action(
                          "gate",
                          g,
                          g.kind === "parcel" ? "accept-parcel" : "arrive",
                          g.kind === "parcel"
                            ? "Accept parcel at desk"
                            : "Record arrival",
                        )}
                      {d.canGate &&
                        g.status === "arrived" &&
                        action("gate", g, "depart", "Record departure")}
                      {role === "tenant" &&
                        g.status === "accepted" &&
                        action(
                          "gate",
                          g,
                          "receive-parcel",
                          "I received this parcel",
                        )}
                    </Card>
                  ))}
                </>
              )}
              {current === "notices" && (
                <>
                  {d.notes.map((n) => (
                    <Card key={n.id}>
                      <Text style={s.h3}>{n.title}</Text>
                      <Badge label={n.kind} />
                      <Text style={s.body}>{n.body}</Text>
                      {n.kind === "round" &&
                        action(
                          "notes",
                          n,
                          n.status === "done" ? "open" : "done",
                          n.status === "done"
                            ? "Reopen round"
                            : "Complete round",
                        )}
                    </Card>
                  ))}
                  {d.canGate && (
                    <Card>
                      <Form
                        title="Add shift handover note"
                        busy={busy}
                        fields={[
                          { name: "title", label: "Title" },
                          {
                            name: "body",
                            label: "Handover details",
                            multiline: true,
                          },
                        ]}
                        save={(v) =>
                          save("notes", {
                            ...v,
                            kind: "shift",
                            assignedUserId: null,
                          })
                        }
                      />
                    </Card>
                  )}
                </>
              )}
              {current === "map" && d.canManage && (
                <MobileBuildingAdmin data={d} save={save} busy={busy} />
              )}
              {current === "map" && !d.canManage && (
                <>
                  {!d.layouts.length && (
                    <Empty
                      title="No published floors"
                      detail="The manager can sketch and publish the building from the web community portal."
                    />
                  )}
                  {d.layouts.map((l) => (
                    <Card key={l.id}>
                      <Text style={s.h3}>
                        {d.blocks?.find((b) => b.id === l.blockId)?.name ??
                          "Previous plans"}{" "}
                        · {l.name} · Floor {l.floor}
                      </Text>
                      <Text style={s.small}>
                        {l.publishedAt ? "Published floor" : "Manager draft"}
                      </Text>
                      {l.shapes
                        .filter((shape) => shape.kind !== "outline")
                        .map((shape) => (
                          <View key={shape.id} style={s.spread}>
                            <Text style={s.body}>{shape.label}</Text>
                            <Badge label={shape.kind} />
                          </View>
                        ))}
                    </Card>
                  ))}
                  <Notice message="The interactive 2D sketch editor and 3D building view are available in the web Community portal." />
                </>
              )}
            </>
          )}
        </>
      )}
    </Screen>
  );
}
