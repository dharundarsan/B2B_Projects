import { useState } from "react";
import { ProviderSetup, OfferAccess } from "./ProviderSetup";
import { Button } from "../../components/common";
import {
  Action,
  Card,
  Form,
  None,
  Status,
  amount,
  iso,
  opts,
  type FieldSpec,
  type ModuleProps,
} from "./ui";
import type { Product } from "../../../../../shared/community";
const productFields = (
  sellerOptions: { id: string; name: string }[],
  p?: Product,
): FieldSpec[] => [
  {
    name: "sellerId",
    label: "Store",
    options: sellerOptions,
    value: p?.sellerId ?? sellerOptions[0]?.id,
  },
  { name: "name", label: "Product name", value: p?.name },
  {
    name: "description",
    label: "Description",
    type: "textarea",
    optional: true,
    value: p?.description,
  },
  {
    name: "kind",
    label: "Type",
    options: opts("grocery", "food", "product"),
    value: p?.kind ?? "grocery",
  },
  {
    name: "ingredients",
    label: "Ingredients (required for food)",
    type: "textarea",
    optional: true,
    value: p?.ingredients,
  },
  {
    name: "allergens",
    label: "Allergens (required for food)",
    optional: true,
    value: p?.allergens,
    hint: "State known allergens, or “None declared”.",
  },
  {
    name: "price",
    label: "Price per item",
    type: "number",
    value: p?.price,
    min: 0.01,
  },
  { name: "currency", label: "Currency", value: p?.currency ?? "INR" },
  {
    name: "stock",
    label: "Available stock",
    type: "number",
    value: p?.stock ?? 10,
    max: 1000000,
  },
  {
    name: "status",
    label: "Availability",
    options: opts("active", "paused"),
    value: p?.status ?? "active",
  },
];
export function Market({
  data: d,
  mutate,
  busy,
  initialView = "shop",
  initialSearch = "",
}: ModuleProps & { initialView?: string; initialSearch?: string }) {
  const [view, setView] = useState(initialView);
  const provider = d.userContext === 3;
  const [search, setSearch] = useState(initialSearch);
  const mine = d.sellers.filter((s) => s.userId === d.userId || d.canManage);
  const managed = mine.filter((s) => s.status === "approved");
  const sellerOptions = managed.map((s) => ({ id: s.id, name: s.name }));
  const productName = (id: string) =>
    d.products.find((p) => p.id === id)?.name ?? "Product";
  return (
    <div className="community-stack">
      {!d.canManage && !provider && (
        <OfferAccess property={d.property.id} section="market" />
      )}
      <div className="community-subtabs">
        {[
          { id: "shop", label: "Browse products" },
          { id: "groups", label: "Group buys" },
          { id: "orders", label: "Orders" },
          {
            id: "sell",
            label: d.canManage
              ? "Manage stores & products"
              : "My profiles & products",
          },
        ]
          .filter((t) =>
            provider ? t.id !== "shop" : d.canManage || t.id !== "sell",
          )
          .map((t) => (
            <Button
              key={t.id}
              variant={view === t.id ? "primary" : "secondary"}
              onClick={() => setView(t.id)}
            >
              {t.label}
            </Button>
          ))}
      </div>
      {view === "shop" && (
        <>
          <div className="community-toolbar">
            <label>
              Search the market
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Groceries, food or resident products"
              />
            </label>
            <span className="community-muted">
              Shops and neighbours inside this apartment
            </span>
          </div>
          <div className="community-grid">
            {d.products
              .filter(
                (p) =>
                  p.status === "active" &&
                  d.sellers.some(
                    (s) => s.id === p.sellerId && s.status === "approved",
                  ) &&
                  (p.name + " " + p.description)
                    .toLowerCase()
                    .includes(search.toLowerCase()),
              )
              .map((p) => (
                <Card
                  key={p.id}
                  title={p.name}
                  detail={d.sellers.find((s) => s.id === p.sellerId)?.name}
                >
                  <div className={"community-product-icon " + p.kind}>
                    {p.kind === "food"
                      ? "🍲"
                      : p.kind === "grocery"
                        ? "🛒"
                        : "🛍️"}
                  </div>
                  <p>{p.description}</p>
                  {p.kind === "food" && (
                    <p className="community-muted">
                      Ingredients: {p.ingredients}
                      <br />
                      Allergens: {p.allergens}
                    </p>
                  )}
                  <div className="community-spread">
                    <strong>{amount(p.price, p.currency)}</strong>
                    <span>{p.stock} in stock</span>
                  </div>
                  <p className="community-muted">
                    Pickup: {d.sellers.find((s) => s.id === p.sellerId)?.pickup}
                  </p>
                  {p.stock > 0 && !d.canManage ? (
                    <Form
                      title="Buy from this seller"
                      submit="Place order"
                      fields={[
                        {
                          name: "quantity",
                          label: "Quantity",
                          type: "number",
                          value: 1,
                          min: 1,
                          max: Math.min(p.stock, 10000),
                        },
                      ]}
                      busy={busy}
                      onSubmit={(v) =>
                        mutate("orders", {
                          productId: p.id,
                          quantity: v.quantity,
                          submissionId: v.__submissionId,
                        })
                      }
                    >
                      <p className="community-muted">
                        Payment is arranged with this seller. An order reserves
                        stock and awaits their acceptance.
                      </p>
                    </Form>
                  ) : (
                    !d.canManage && <Status value="out of stock" />
                  )}
                </Card>
              ))}
          </div>
          {!d.products.length && (
            <Card title="The market is getting started">
              <None>
                Register an internal shop or a resident store to list products.
              </None>
            </Card>
          )}
        </>
      )}
      {view === "groups" && (
        <>
          <p className="community-muted">
            Commit to a quantity at the displayed price. You can withdraw before
            the deadline. If the minimum or available stock is insufficient at
            finalization, the group fails and no orders are created.
          </p>
          {managed.length > 0 && (
            <Form
              title="Start a group buy"
              busy={busy}
              fields={[
                {
                  name: "productId",
                  label: "Your product",
                  options: d.products
                    .filter(
                      (p) =>
                        managed.some((s) => s.id === p.sellerId) &&
                        p.name.toLowerCase().includes(search.toLowerCase()),
                    )
                    .map((p) => ({ id: p.id, name: p.name })),
                },
                {
                  name: "unitPrice",
                  label: "Locked group price",
                  type: "number",
                  min: 0.01,
                },
                {
                  name: "minimum",
                  label: "Minimum total quantity",
                  type: "number",
                  value: 5,
                  min: 1,
                },
                {
                  name: "maximum",
                  label: "Maximum total quantity",
                  type: "number",
                  value: 50,
                  min: 1,
                },
                {
                  name: "closesAt",
                  label: "Commitment deadline",
                  type: "datetime-local",
                },
                { name: "pickup", label: "Pickup location and time" },
              ]}
              onSubmit={(v) =>
                mutate("groups", { ...v, closesAt: iso(v.closesAt) })
              }
            />
          )}
          <div className="community-grid">
            {d.groups.map((g) => {
              const editable =
                d.canManage ||
                (provider && mine.some((s) => s.id === g.sellerId));
              const open =
                g.status === "open" &&
                new Date(g.closesAt).getTime() > Date.now();
              return (
                <Card
                  key={g.id}
                  title={productName(g.productId)}
                  detail={d.sellers.find((s) => s.id === g.sellerId)?.name}
                >
                  <div className="community-spread">
                    <strong>{amount(g.unitPrice, g.currency)} / item</strong>
                    <Status value={g.status} />
                  </div>
                  <p>
                    {g.committed} of {g.minimum} minimum · Maximum {g.maximum}
                  </p>
                  <progress
                    aria-label="Group commitment progress"
                    value={Math.min(g.committed, g.minimum)}
                    max={g.minimum}
                  />
                  <p className="community-muted">
                    Deadline: {new Date(g.closesAt).toLocaleString()}
                    <br />
                    Pickup: {g.pickup}
                    <br />
                    Your commitment: {g.myQuantity}
                  </p>
                  {open && d.userContext === 1 && (
                    <Form
                      title={
                        g.myQuantity
                          ? "Change your commitment"
                          : "Join group buy"
                      }
                      busy={busy}
                      submit="Commit quantity"
                      fields={[
                        {
                          name: "quantity",
                          label: "Quantity (zero withdraws)",
                          type: "number",
                          value: g.myQuantity || 1,
                          max: 10000,
                        },
                      ]}
                      onSubmit={(v) =>
                        mutate(`groups/${g.id}/pledge`, {
                          quantity: v.quantity,
                          revision: g.revision,
                        })
                      }
                    />
                  )}
                  <div className="community-actions">
                    {editable && g.status === "open" && (
                      <>
                        <Action
                          path="groups"
                          row={g}
                          action="cancel"
                          label="Cancel group"
                          mutate={mutate}
                          busy={busy}
                        />
                        {!open && (
                          <Action
                            path="groups"
                            row={g}
                            action="finalize"
                            label="Finalize commitments"
                            mutate={mutate}
                            busy={busy}
                          />
                        )}
                      </>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
          {!d.groups.length && <None>No group buys yet.</None>}
        </>
      )}
      {view === "orders" && (
        <Card
          title={
            d.canManage
              ? "Community orders"
              : provider
                ? "Customer orders"
                : "My orders"
          }
          detail="Stock is reserved on order. Seller acceptance, readiness and handover are separate steps."
        >
          {!d.orders.length && <None />}
          {[...d.orders].reverse().map((o) => {
            const manage =
              d.canManage ||
              (provider && mine.some((s) => s.id === o.sellerId));
            return (
              <article key={o.id} className="community-record">
                <div className="community-spread">
                  <h3>
                    {productName(o.productId)} × {o.quantity}
                  </h3>
                  <strong>
                    {amount(o.unitPrice * o.quantity, o.currency)}
                  </strong>
                </div>
                <p>
                  Order {o.id.slice(0, 8).toUpperCase()} ·{" "}
                  {d.sellers.find((s) => s.id === o.sellerId)?.name}{" "}
                  {o.groupId && " · Group purchase"}
                </p>
                <div className="community-actions">
                  <Status value={o.status} />
                  <Status value={o.paymentStatus} />
                </div>
                <div className="community-actions">
                  {manage && o.status === "placed" && (
                    <Action
                      path="orders"
                      row={o}
                      action="accept"
                      label="Accept"
                      mutate={mutate}
                      busy={busy}
                    />
                  )}{" "}
                  {manage && o.status === "accepted" && (
                    <Action
                      path="orders"
                      row={o}
                      action="ready"
                      label="Ready for pickup"
                      mutate={mutate}
                      busy={busy}
                    />
                  )}{" "}
                  {manage && o.status === "ready" && (
                    <Action
                      path="orders"
                      row={o}
                      action="handover"
                      label="Record handover"
                      mutate={mutate}
                      busy={busy}
                    />
                  )}{" "}
                  {o.status === "placed" ||
                  (manage && ["accepted", "ready"].includes(o.status)) ? (
                    <Action
                      path="orders"
                      row={o}
                      action="cancel"
                      label="Cancel order"
                      mutate={mutate}
                      busy={busy}
                    />
                  ) : null}{" "}
                  {manage &&
                    o.paymentStatus === "unpaid" &&
                    o.status !== "cancelled" && (
                      <Action
                        path="orders"
                        row={o}
                        action="paid"
                        label="Confirm payment received"
                        mutate={mutate}
                        busy={busy}
                      />
                    )}{" "}
                  {manage && o.paymentStatus === "refund_due" && (
                    <Action
                      path="orders"
                      row={o}
                      action="refunded"
                      label="Confirm refund sent"
                      mutate={mutate}
                      busy={busy}
                    />
                  )}
                </div>
              </article>
            );
          })}
        </Card>
      )}
      {view === "sell" && (
        <>
          <ProviderSetup data={d} role={d.role} mutate={mutate} busy={busy} />
          {managed.length > 0 && (
            <Card title="Manage your products">
              <label className="ch-service-search">
                Search your products
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Find a product…"
                />
              </label>
              <Form
                title="List a product"
                fields={productFields(sellerOptions)}
                busy={busy}
                onSubmit={(v) => mutate("products", v)}
              />
              {d.products
                .filter(
                  (p) =>
                    managed.some((s) => s.id === p.sellerId) &&
                    p.name.toLowerCase().includes(search.toLowerCase()),
                )
                .map((p) => (
                  <article key={p.id} className="community-record">
                    <h3>
                      {p.name} <Status value={p.status} />
                    </h3>
                    <p>
                      {amount(p.price, p.currency)} · {p.stock} available
                    </p>
                    <Form
                      title="Edit product and stock"
                      fields={productFields(sellerOptions, p)}
                      busy={busy}
                      onSubmit={(v) =>
                        mutate(
                          "products/" + p.id,
                          { ...v, revision: p.revision },
                          "PATCH",
                        )
                      }
                    />
                  </article>
                ))}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
