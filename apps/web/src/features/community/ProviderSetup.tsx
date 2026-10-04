import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { request } from "../../api";
import { useApiResource } from "../../hooks/useApiResource";
import { useAccountView } from "../AccountView";
import type { UserDirectory } from "../../../../../shared/userManagement";
import { Action, Card, Form, None, Status, type ModuleProps } from "./ui";
import { Button, ErrorNotice } from "../../components/common";

export function OfferAccess({
  property,
  section,
}: {
  property: string;
  section: "market" | "services";
}) {
  const { view, switchView } = useAccountView();
  const navigate = useNavigate();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const open = async () => {
    setBusy(true);
    try {
      await switchView(3);
      navigate(
        `/seller?property=${encodeURIComponent(property)}&section=${section}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open Seller view.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="ch-offer-callout">
      <div>
        <strong>Have something to offer your neighbours?</strong>
        <p>
          Apartment shops and residents can sell products, food or services
          using a provider profile.
        </p>
      </div>
      {view.availableContexts?.includes(3) ? (
        <Button variant="secondary" disabled={busy} onClick={() => void open()}>
          Open Seller view
        </Button>
      ) : (
        <small>
          Ask your community administrator to enable Seller access on your
          account.
        </small>
      )}
      {error && <ErrorNotice message={error} onRetry={() => setError("")} />}
    </div>
  );
}
export function ProviderSetup({ data: d, role, mutate, busy }: ModuleProps) {
  const directory = useApiResource<UserDirectory | null>(
    useCallback(
      (signal) =>
        d.canManage
          ? request<{ data: UserDirectory }>("/api/admin/users", { signal })
          : Promise.resolve({ data: null }),
      [d.canManage],
    ),
    null,
  );
  const providers = d.sellers.filter(
    (s) => d.canManage || s.userId === d.userId,
  );
  const accounts =
    directory.data?.users.filter(
      (u) =>
        u.status === "active" &&
        u.allowSeller &&
        (u.allowAdmin ||
          u.memberships.some((m) => m.propertyId === d.property.id)),
    ) ?? [];
  return (
    <Card
      title={
        d.canManage ? "Stores & service providers" : "My provider profiles"
      }
      detail="Register a profile, get approval, then add offerings and manage requests. Admin-created profiles are approved immediately."
    >
      {d.canManage && (
        <p className="ch-info">
          Select the account that will run this shop or service.{" "}
          <Link
            to={`/admin?property=${encodeURIComponent(d.property.id)}&section=people`}
          >
            Create an account
          </Link>{" "}
          with Seller access and assign this community if needed.
        </p>
      )}
      {directory.error && (
        <ErrorNotice message={directory.error} onRetry={directory.refresh} />
      )}
      {(d.canManage || !providers.some((p) => p.status !== "rejected")) && <Form
        title={
          d.canManage
            ? "Add store / provider"
            : "Register my store / service profile"
        }
        busy={busy || directory.loading}
        fields={[
          {
            name: "name",
            label: "Store / provider name",
            hint: "Use a shop name, home kitchen name or your service business name.",
          },
          {
            name: "kind",
            label: "Provider type",
            options: [
              { id: "shop", name: "Shop inside the community" },
              { id: "resident", name: "Resident business / service provider" },
            ],
            value: "resident",
          },
          {
            name: "pickup",
            label: "Pickup / service location",
            hint: "For example, Block A shop 2, or appointments at the customer's flat.",
          },
          ...(d.canManage
            ? [
                {
                  name: "userId",
                  label: "Account managing this provider",
                  options: accounts.map((u) => ({
                    id: u.userId,
                    name: u.displayName || u.email,
                  })),
                },
              ]
            : []),
        ]}
        onSubmit={(v) =>
          mutate("sellers", { ...v, userId: d.canManage ? v.userId : null })
        }
      />}
      {!d.canManage && providers.some((p) => p.status === "suspended") && (
        <p className="ch-info">Your provider profile is suspended. Contact your community administrator to restore access.</p>
      )}
      {!providers.length && (
        <None>
          No provider profiles yet. Register one here to start offering products
          or services.
        </None>
      )}
      <details
        className="ch-provider-list"
        open={providers.some((p) => p.status === "pending")}
      >
        <summary>
          {providers.length} provider profile{providers.length === 1 ? "" : "s"}
          {providers.some((p) => p.status === "pending")
            ? " · approval needed"
            : " · view & manage"}
        </summary>
        <div>
          {providers.map((s) => (
            <article key={s.id} className="community-record">
              <div className="community-spread">
                <h3>{s.name}</h3>
                <Status value={s.status} />
              </div>
              <p>
                {s.kind === "shop" ? "Apartment shop" : "Resident business"} ·{" "}
                {s.pickup}
              </p>
              {s.status === "pending" && (
                <small>
                  Awaiting administrator approval. Listings become available
                  after approval.
                </small>
              )}
              {d.canManage && (
                <div className="community-actions">
                  {s.status !== "approved" && (
                    <Action
                      path="sellers"
                      row={s}
                      action="approve"
                      label="Approve provider"
                      mutate={mutate}
                      busy={busy}
                    />
                  )}{" "}
                  {s.status === "pending" && (
                    <Action
                      path="sellers"
                      row={s}
                      action="reject"
                      label="Reject"
                      mutate={mutate}
                      busy={busy}
                    />
                  )}{" "}
                  {s.status === "approved" && (
                    <Action
                      path="sellers"
                      row={s}
                      action="suspend"
                      label="Suspend provider"
                      mutate={mutate}
                      busy={busy}
                    />
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      </details>
    </Card>
  );
}
