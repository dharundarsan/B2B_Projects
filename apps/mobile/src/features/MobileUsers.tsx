import { useCallback, useEffect, useState } from "react";
import { Text, View, Switch } from "react-native";
import * as Crypto from "expo-crypto";
import { request } from "../lib/api";
import { useResource } from "../hooks/useResource";
import { useAuth } from "../providers/AuthProvider";
import {
  Badge,
  Button,
  Card,
  Chips,
  Field,
  Loading,
  Notice,
  Section,
  s,
} from "../components/ui";
import type { Property, Unit } from "../../../../shared/community";
import type {
  ManagedUser,
  Membership,
  UserDirectory,
} from "../../../../shared/userManagement";
const roles = [
  { value: "member", label: "Member" },
  { value: "tenant", label: "Resident" },
  { value: "seller", label: "Seller / Provider" },
  { value: "unit_owner", label: "Unit owner" },
  { value: "operator", label: "Operator" },
  { value: "watchman", label: "Watchman" },
  { value: "manager", label: "Administrator" },
];
export function MobileUsers({ properties }: { properties: Property[] }) {
  const { context, refreshContext } = useAuth();
  const resource = useResource<UserDirectory | null>(
    useCallback((signal) => request("/admin/users", { signal }), []),
    null,
  );
  const [query, setQuery] = useState(""),
    [edit, setEdit] = useState<ManagedUser | null | undefined>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const save = async (path: string, body: unknown, method = "POST") => {
    setBusy(true);
    setError("");
    try {
      await request(path, { method, body: JSON.stringify(body) });
      resource.refresh();
      refreshContext();
      setEdit(undefined);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save account.");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: 18 }}>
      <Section title="People & access" />
      <Text style={s.body}>
        Create community accounts, choose their views and assign buildings.
      </Text>
      <Button
        label="Create account"
        icon="person-add-outline"
        onPress={() => setEdit(null)}
      />
      {(error || resource.error) && (
        <Notice
          danger
          message={error || resource.error}
          onRetry={resource.refresh}
        />
      )}
      <Field label="Search users" value={query} onChangeText={setQuery} />
      {edit !== undefined && (
        <Editor
          key={edit?.userId ?? "new"}
          user={edit}
          self={edit?.email === context?.email}
          properties={properties}
          busy={busy}
          save={save}
          close={() => setEdit(undefined)}
        />
      )}
      {resource.loading && !resource.data && <Loading />}
      {resource.data?.users
        .filter((u) =>
          `${u.displayName} ${u.email}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
        .map((u) => (
          <Card key={u.userId}>
            <Text style={s.h3}>{u.displayName || u.email}</Text>
            <Text style={s.small}>
              {u.email} · {u.role.replaceAll("_", " ")}
            </Text>
            <Badge label={u.status} />
            <Text style={s.small}>
              {[
                u.allowUser ? "User" : "",
                u.allowAdmin ? "Admin" : "",
                u.allowSeller ? "Seller / Provider" : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
            <Text style={s.small}>
              {u.memberships
                .map(
                  (m) =>
                    properties.find((p) => p.id === m.propertyId)?.name ??
                    m.propertyId,
                )
                .join(", ") || "Workspace / existing assignments"}
            </Text>
            {u.role !== "demo" && (
              <Button
                label="Edit account"
                variant="secondary"
                onPress={() => setEdit(u)}
              />
            )}{" "}
            {u.email !== context?.email && u.role !== "demo" && (
              <Button
                label={
                  u.status === "active"
                    ? "Suspend account"
                    : "Reactivate account"
                }
                variant="secondary"
                disabled={busy}
                onPress={() =>
                  void save(
                    `/admin/users/${encodeURIComponent(u.userId)}/status`,
                    {
                      action: u.status === "active" ? "suspend" : "activate",
                      revision: u.revision,
                    },
                  )
                }
              />
            )}
          </Card>
        ))}
      <Section title="Recent access changes" />
      {resource.data?.audit.slice(0, 5).map((a) => (
        <Card key={a.id}>
          <Text style={s.label}>{a.action.replaceAll(".", " ")}</Text>
          <Text style={s.small}>
            {resource.data?.users.find((u) => u.userId === a.userId)
              ?.displayName ?? "Account"}{" "}
            · {new Date(a.createdAt).toLocaleString()}
          </Text>
        </Card>
      ))}
    </View>
  );
}
function Editor({
  user,
  self,
  properties,
  busy,
  save,
  close,
}: {
  user: ManagedUser | null;
  self: boolean;
  properties: Property[];
  busy: boolean;
  save: (path: string, body: unknown, method?: string) => Promise<boolean>;
  close: () => void;
}) {
  const [name, setName] = useState(user?.displayName ?? ""),
    [email, setEmail] = useState(user?.email ?? ""),
    [password, setPassword] = useState(""),
    [role, setRole] = useState(user?.role ?? "member");
  const [allowUser, setUser] = useState(user?.allowUser ?? true),
    [allowSeller, setSeller] = useState(user?.allowSeller ?? false),
    [starting, setStarting] = useState(String(user?.userContext ?? 1)),
    [memberships, setMemberships] = useState<Membership[]>(
      user?.memberships ?? [],
    );
  const admin = ["owner", "manager"].includes(role);
  const views = [
    ...(admin || allowUser ? [{ value: "1", label: "User" }] : []),
    ...(admin ? [{ value: "2", label: "Admin" }] : []),
    ...(admin || (allowSeller && role !== "watchman")
      ? [{ value: "3", label: "Seller / Provider" }]
      : []),
  ];
  const send = () =>
    save(
      user ? `/admin/users/${encodeURIComponent(user.userId)}` : "/admin/users",
      {
        displayName: name,
        email,
        role: role === "seller" ? "member" : role,
        allowUser: admin || allowUser,
        allowAdmin: admin,
        allowSeller: admin || (allowSeller && role !== "watchman"),
        defaultContext: Number(
          views.some((v) => v.value === starting) ? starting : views[0]?.value,
        ),
        memberships,
        password: user ? undefined : password,
        revision: user?.revision ?? 0,
      },
      user ? "PATCH" : "POST",
    );
  return (
    <Card>
      <Text style={s.h2}>{user ? "Edit account" : "New account"}</Text>
      <Field label="Full name" value={name} onChangeText={setName} />
      <Field
        label="Email"
        editable={!user}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      {!user && (
        <Field
          label="Initial password"
          secureTextEntry
          autoCapitalize="none"
          value={password}
          onChangeText={setPassword}
          hint="12–128 characters. Share directly with the account owner."
        />
      )}
      <Section title="Account role" />
      <Chips
        options={
          user?.role === "owner"
            ? [
                { value: "owner", label: "Workspace owner" },
                ...roles.filter((r) => !self || r.value === "manager"),
              ]
            : roles.filter((r) => !self || r.value === "manager")
        }
        value={role}
        onChange={(v) => {
          setRole(v);
          setStarting(v === "manager" ? "2" : v === "seller" ? "3" : "1");
          setUser(true);
          setSeller(v === "seller" || v === "manager");
          setMemberships((old) =>
            old.map((m) => ({ propertyId: m.propertyId })),
          );
        }}
      />
      {admin ? (
        <Notice message="Administrators have all three views." />
      ) : (
        <>
          <View style={s.spread}>
            <Text style={s.label}>User view</Text>
            <Switch
              disabled={role === "watchman"}
              value={allowUser}
              onValueChange={setUser}
            />
          </View>
          {role !== "watchman" && (
            <View style={s.spread}>
              <Text style={s.label}>Seller / Provider view</Text>
              <Switch value={allowSeller} onValueChange={setSeller} />
            </View>
          )}
        </>
      )}
      <Section title="Starting view" />
      <Chips
        options={views}
        value={
          views.some((v) => v.value === starting)
            ? starting
            : (views[0]?.value ?? "")
        }
        onChange={setStarting}
      />
      <Section title="Building assignments" />
      {memberships.map((m, i) => (
        <Assignment
          key={i}
          value={m}
          role={role}
          properties={properties}
          change={(next) =>
            setMemberships((old) => old.map((x, n) => (i === n ? next : x)))
          }
          remove={() => setMemberships((old) => old.filter((_, n) => n !== i))}
        />
      ))}
      <Button
        label="Add building assignment"
        variant="secondary"
        onPress={() =>
          setMemberships([
            ...memberships,
            {
              propertyId:
                properties.find(
                  (p) => !memberships.some((m) => m.propertyId === p.id),
                )?.id ?? "",
            },
          ])
        }
      />
      <Button
        label={user ? "Save account" : "Create account"}
        loading={busy}
        disabled={!views.length}
        onPress={() => void send()}
      />
      <Button label="Cancel" variant="secondary" onPress={close} />
    </Card>
  );
}
function Assignment({
  value: m,
  role,
  properties,
  change,
  remove,
}: {
  value: Membership;
  role: string;
  properties: Property[];
  change: (m: Membership) => void;
  remove: () => void;
}) {
  const [units, setUnits] = useState<Unit[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setUnits([]);
    setError("");
    if (m.propertyId)
      request<Unit[]>(`/properties/${encodeURIComponent(m.propertyId)}/units`, {
        signal: controller.signal,
      })
        .then(setUnits)
        .catch((e) => {
          if (!controller.signal.aborted)
            setError(e instanceof Error ? e.message : "Could not load units.");
        });
    return () => controller.abort();
  }, [m.propertyId]);
  return (
    <View
      style={{
        gap: 12,
        padding: 12,
        backgroundColor: "#f3f6f2",
        borderRadius: 12,
      }}
    >
      <Text style={s.label}>Building</Text>
      <Chips
        options={properties.map((p) => ({ value: p.id, label: p.name }))}
        value={m.propertyId}
        onChange={(propertyId) => change({ propertyId })}
      />
      {error && <Notice message={error} danger />}
      {role === "tenant" && (
        <>
          <Text style={s.label}>Resident unit</Text>
          <Chips
            options={[
              { value: "", label: "Community only" },
              ...units.map((u) => ({ value: u.id, label: u.label })),
            ]}
            value={m.unitId ?? ""}
            onChange={(unitId) =>
              change({
                ...m,
                unitId: unitId || null,
                occupancyId: unitId ? Crypto.randomUUID() : null,
                startsAt: unitId ? new Date().toISOString() : null,
                endsAt: null,
              })
            }
          />
          {m.unitId && (
            <>
              <Field
                label="Move-in instant"
                value={m.startsAt ?? ""}
                onChangeText={(startsAt) => change({ ...m, startsAt })}
                hint="Date/time with timezone, e.g. 2026-10-05T09:00:00+05:30."
              />
              <Field
                label="Move-out instant (optional)"
                value={m.endsAt ?? ""}
                onChangeText={(endsAt) =>
                  change({ ...m, endsAt: endsAt || null })
                }
              />
            </>
          )}
        </>
      )}
      <Button label="Remove assignment" variant="secondary" onPress={remove} />
    </View>
  );
}
