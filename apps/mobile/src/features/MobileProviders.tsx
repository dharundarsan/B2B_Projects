import { useCallback } from "react";
import { Text } from "react-native";
import { request } from "../lib/api";
import { useResource } from "../hooks/useResource";
import type { UserDirectory } from "../../../../shared/userManagement";
import type { CommunityData } from "../../../../shared/community";
import { Badge, Button, Card, Notice, s } from "../components/ui";
import { Form, type Save } from "./CommunityForm";
export function MobileProviders({
  data: d,
  save,
  busy,
}: {
  data: CommunityData;
  save: Save;
  busy: boolean;
}) {
  const directory = useResource<UserDirectory | null>(
    useCallback(
      (signal) =>
        d.canManage
          ? request("/admin/users", { signal })
          : Promise.resolve(null),
      [d.canManage],
    ),
    null,
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
    <Card>
      <Text style={s.h3}>
        {d.canManage ? "Stores & service providers" : "My provider profiles"}
      </Text>
      <Text style={s.small}>
        Register a profile, get admin approval, then add products or services.
      </Text>
      {directory.error && (
        <Notice danger message={directory.error} onRetry={directory.refresh} />
      )}
      <Form
        title="Register store / provider"
        busy={busy || directory.loading}
        fields={[
          { name: "name", label: "Store / provider name" },
          {
            name: "kind",
            label: "Provider type",
            options: [
              { value: "shop", label: "Apartment shop" },
              { value: "resident", label: "Resident business / service" },
            ],
            value: "resident",
          },
          { name: "pickup", label: "Pickup / service location" },
          ...(d.canManage
            ? [
                {
                  name: "userId",
                  label: "Seller account",
                  options: accounts.map((u) => ({
                    value: u.userId,
                    label: u.displayName || u.email,
                  })),
                },
              ]
            : []),
        ]}
        save={(v) => {
          if (d.canManage && !v.userId)
            throw new Error("Choose a community account with Seller access.");
          return save("sellers", {
            ...v,
            userId: d.canManage ? v.userId : null,
          });
        }}
      />
      {d.sellers
        .filter((p) => d.canManage || p.userId === d.userId)
        .map((p) => (
          <Card key={p.id}>
            <Text style={s.h3}>{p.name}</Text>
            <Text style={s.small}>{p.pickup}</Text>
            <Badge label={p.status} />
            {p.status === "pending" && (
              <Text style={s.small}>Awaiting administrator approval.</Text>
            )}
            {d.canManage &&
              (p.status === "approved"
                ? ["suspend"]
                : p.status === "pending"
                  ? ["approve", "reject"]
                  : ["approve"]
              ).map((action) => (
                <Button
                  key={action}
                  label={action}
                  variant="secondary"
                  disabled={busy}
                  onPress={() =>
                    void save(`sellers/${p.id}/actions`, {
                      action,
                      revision: p.revision,
                    })
                  }
                />
              ))}
          </Card>
        ))}
    </Card>
  );
}
