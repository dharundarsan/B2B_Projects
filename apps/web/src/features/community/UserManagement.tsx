import { useCallback, useState, type FormEvent } from "react";
import {
  Search,
  Users,
  Plus,
  ShieldCheck,
  UserRound,
  Store,
  ArrowLeft,
  X,
} from "lucide-react";
import { demoMode } from "../../supabase";
import { useAccountView } from "../AccountView";
import { request } from "../../api";
import { useApiResource } from "../../hooks/useApiResource";
import { useOverlayFocus } from "../../hooks/useOverlayFocus";
import { Button, ErrorNotice, LoadingState } from "../../components/common";
import type { Property, Unit } from "../../../../../shared/community";
import type {
  ManagedUser,
  Membership,
  UserDirectory,
} from "../../../../../shared/userManagement";
import { Card, Status, None } from "./ui";
import { localDateTime, dateTimeInstant } from "./management";
const roles = [
  ["member", "Community member"],
  ["tenant", "Resident / tenant"],
  ["seller", "Seller / service provider"],
  ["unit_owner", "Unit owner"],
  ["operator", "Rental operator"],
  ["watchman", "Watchman"],
  ["manager", "Administrator"],
];
const roleName = (role: string) =>
  role === "demo"
    ? "Demo administrator"
    : role === "owner"
      ? "Workspace owner"
      : (roles.find((r) => r[0] === role)?.[1] ?? role);
export function UserManagement({ properties }: { properties: Property[] }) {
  const { view: account, refreshAccount } = useAccountView();
  const resource = useApiResource<UserDirectory | null>(
    useCallback(
      (signal) =>
        request<{ data: UserDirectory }>("/api/admin/users", { signal }),
      [],
    ),
    null,
  );
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [roleFilter, setRoleFilter] = useState("all"),
    [page, setPage] = useState(0);
  const [edit, setEdit] = useState<ManagedUser | null | undefined>(),
    [newRole, setNewRole] = useState("member"),
    [confirm, setConfirm] = useState<ManagedUser | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const closeConfirmation = () => {
    if (!busy) setConfirm(null);
  };
  const dialogRef = useOverlayFocus(!!confirm, closeConfirmation);
  const save = async (path: string, body: unknown, method = "POST") => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await request(path, { method, body: JSON.stringify(body) });
      resource.refresh();
      refreshAccount();
      setEdit(undefined);
      setConfirm(null);
      setMessage("Account updated successfully.");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save account.");
      return false;
    } finally {
      setBusy(false);
    }
  };
  if (resource.loading && !resource.data) return <LoadingState />;
  const all = resource.data?.users ?? [];
  const users = all.filter(
    (u) =>
      (filter === "all" || u.status === filter) &&
      (roleFilter === "all" ||
        (roleFilter === "seller"
          ? u.allowSeller && !u.allowAdmin
          : u.role === roleFilter)) &&
      `${u.displayName} ${u.email} ${roleName(u.role)}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(users.length / 10) - 1),
  );
  const notice = (error || resource.error) && (
    <ErrorNotice
      message={error || resource.error}
      onRetry={() => {
        setError("");
        resource.refresh();
      }}
    />
  );
  if (edit !== undefined)
    return (
      <div className="community-stack">
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => {
            setEdit(undefined);
            setError("");
          }}
        >
          <ArrowLeft size={17} />
          Back to people
        </Button>
        {notice}
        <UserEditor
          key={edit?.userId ?? "new"}
          user={edit}
          initialRole={newRole}
          properties={properties}
          busy={busy}
          onClose={() => setEdit(undefined)}
          save={save}
        />
      </div>
    );
  return (
    <div className="community-stack">
      <div className="ch-section-heading">
        <div>
          <h2>Your community, connected</h2>
          <p>
            Create accounts, assign communities and choose the views each person
            can use.
          </p>
        </div>
        <div className="community-actions">
          <Button
            onClick={() => {
              setNewRole("member");
              setEdit(null);
              setMessage("");
            }}
          >
            <Plus size={16} />
            Create account
          </Button>
        </div>
      </div>
      {notice}
      {message && (
        <p className="community-success" role="status">
          {message}
        </p>
      )}
      <div className="ch-metrics">
        <div>
          <Users size={18} />
          <strong>{all.length}</strong>
          <span>Total accounts</span>
        </div>
        <div>
          <UserRound size={18} />
          <strong>{all.filter((u) => u.status === "active").length}</strong>
          <span>Active accounts</span>
        </div>
        <div>
          <ShieldCheck size={18} />
          <strong>{all.filter((u) => u.allowAdmin).length}</strong>
          <span>Administrators</span>
        </div>
        <div>
          <Store size={18} />
          <strong>{all.filter((u) => u.allowSeller).length}</strong>
          <span>Seller access</span>
        </div>
      </div>
      <Card title="Member directory">
        <div className="community-toolbar">
          <label className="ch-inline-search">
            <Search size={16} />
            <input
              aria-label="Search users"
              placeholder="Search name, email or role"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
          </label>
          <div className="community-actions">
            <select
              aria-label="Role filter"
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(0);
              }}
            >
              <option value="all">All roles</option>
              {[...new Set(all.map((u) => u.role))].map((role) => (
                <option key={role} value={role}>
                  {roleName(role)}
                </option>
              ))}
            </select>
            <select
              aria-label="Account status filter"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPage(0);
              }}
            >
              <option value="all">All accounts</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>
        <div className="ch-table-wrap">
          <table className="ch-table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Role & views</th>
                <th>Buildings</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.slice(currentPage * 10, currentPage * 10 + 10).map((u) => (
                <tr key={u.userId}>
                  <td>
                    <div className="ch-person">
                      <span className="ch-avatar">
                        {(u.displayName || u.email).slice(0, 1).toUpperCase()}
                      </span>
                      <div>
                        <strong>{u.displayName || u.email}</strong>
                        <small>{u.email}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <strong>{roleName(u.role)}</strong>
                    <small>
                      {[
                        u.allowUser ? "User" : "",
                        u.allowAdmin ? "Admin" : "",
                        u.allowSeller ? "Seller / Provider" : "",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </td>
                  <td>
                    {u.memberships
                      .map(
                        (m) =>
                          properties.find((p) => p.id === m.propertyId)?.name ??
                          m.propertyId,
                      )
                      .join(", ") || "Workspace access"}
                  </td>
                  <td>
                    <Status value={u.status} />
                  </td>
                  <td>
                    <div className="community-actions">
                      {u.role !== "demo" && (
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setEdit(u);
                            setMessage("");
                          }}
                        >
                          Edit
                        </Button>
                      )}
                      {u.role !== "demo" && u.email !== account.email && (
                        <Button
                          variant="ghost"
                          disabled={busy}
                          onClick={() => setConfirm(u)}
                        >
                          {u.status === "active" ? "Suspend" : "Reactivate"}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!users.length && <None>No accounts match this search.</None>}
        <div className="ch-pagination">
          <small>
            {users.length ? currentPage * 10 + 1 : 0}–
            {Math.min(users.length, currentPage * 10 + 10)} of {users.length}{" "}
            accounts
          </small>
          <div className="community-actions">
            <Button
              variant="secondary"
              disabled={!currentPage}
              onClick={() => setPage(currentPage - 1)}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              disabled={(currentPage + 1) * 10 >= users.length}
              onClick={() => setPage(currentPage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
      <Card title="Recent access changes">
        <div className="ch-activity">
          {resource.data?.audit.slice(0, 8).map((a) => (
            <div key={a.id}>
              <span className="ch-activity-dot" />
              <div>
                <strong>
                  {a.action.replaceAll(".", " ").replaceAll("_", " ")}
                </strong>
                <small>
                  {all.find((u) => u.userId === a.userId)?.displayName ??
                    "Community account"}{" "}
                  · {new Date(a.createdAt).toLocaleString()}
                </small>
              </div>
            </div>
          ))}
          {!resource.data?.audit.length && (
            <None>Account changes will appear here.</None>
          )}
        </div>
      </Card>
      {confirm && (
        <div className="ch-dialog-backdrop">
          <div
            className="ch-confirm-dialog"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="status-dialog-title"
          >
            <button
              className="ch-dialog-close"
              aria-label="Close confirmation"
              disabled={busy}
              onClick={closeConfirmation}
            >
              <X size={20} />
            </button>
            <ShieldCheck size={30} />
            <h2 id="status-dialog-title">
              {confirm.status === "active" ? "Suspend" : "Reactivate"}{" "}
              {confirm.displayName}?
            </h2>
            <p>
              {confirm.status === "active"
                ? "They will lose access to all their CommunityHub views until you reactivate the account."
                : "They will regain access to their assigned views and buildings."}
            </p>
            {error && <p role="alert">{error}</p>}
            <div className="community-actions">
              <Button
                variant="secondary"
                disabled={busy}
                onClick={closeConfirmation}
              >
                Cancel
              </Button>
              <Button
                disabled={busy}
                onClick={() =>
                  void save(
                    `/api/admin/users/${encodeURIComponent(confirm.userId)}/status`,
                    {
                      action:
                        confirm.status === "active" ? "suspend" : "activate",
                      revision: confirm.revision,
                    },
                  )
                }
              >
                {busy
                  ? "Saving…"
                  : confirm.status === "active"
                    ? "Suspend account"
                    : "Reactivate account"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function UserEditor({
  user,
  initialRole,
  properties,
  busy,
  onClose,
  save,
}: {
  user: ManagedUser | null;
  initialRole: string;
  properties: Property[];
  busy: boolean;
  onClose: () => void;
  save: (path: string, body: unknown, method?: string) => Promise<boolean>;
}) {
  const { view: account } = useAccountView();
  const [name, setName] = useState(user?.displayName ?? ""),
    [email, setEmail] = useState(user?.email ?? ""),
    [password, setPassword] = useState(""),
    [role, setRole] = useState(user?.role ?? initialRole);
  const [userView, setUserView] = useState(user?.allowUser ?? true),
    [sellerView, setSellerView] = useState(user?.allowSeller ?? false),
    [defaultView, setDefault] = useState<number>(
      user?.userContext ?? (initialRole === "manager" ? 2 : 1),
    ),
    [memberships, setMemberships] = useState<Membership[]>(
      user?.memberships ?? [],
    );
  const admin = role === "manager" || role === "owner";
  const views = [
    ...(admin || userView ? [1] : []),
    ...(admin ? [2] : []),
    ...(admin || (sellerView && role !== "watchman") ? [3] : []),
  ];
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!views.length) return;
    await save(
      user
        ? `/api/admin/users/${encodeURIComponent(user.userId)}`
        : "/api/admin/users",
      {
        displayName: name,
        email,
        role: role === "seller" ? "member" : role,
        allowUser: admin || userView,
        allowAdmin: admin,
        allowSeller: admin || (sellerView && role !== "watchman"),
        defaultContext: views.includes(defaultView) ? defaultView : views[0],
        memberships,
        password: user ? undefined : password,
        revision: user?.revision ?? 0,
      },
      user ? "PATCH" : "POST",
    );
  };
  return (
    <div className="ch-user-editor">
      <div className="ch-section-heading">
        <div>
          <h2>
            {user
              ? "Edit account"
              : admin
                ? "Create an administrator"
                : "Create an account"}
          </h2>
          <p>
            {user
              ? `Manage access for ${user.displayName}.`
              : "Set up their profile and workspace access in one place."}
          </p>
        </div>
      </div>
      {demoMode && (
        <p className="ch-info">
          This local demo creates sample accounts. Configure live authentication
          to let new members sign in.
        </p>
      )}
      <form onSubmit={(e) => void submit(e)} className="ch-account-form">
        <section className="ch-editor-section">
          <div className="ch-editor-section-title">
            <span>01</span>
            <div>
              <h3>Identity & role</h3>
              <p>Who is joining your apartment?</p>
            </div>
          </div>
          <div className="community-fields">
            <label>
              Full name <span aria-hidden="true">*</span>
              <input
                required
                maxLength={200}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Priya Sharma"
              />
            </label>
            <label>
              Email address <span aria-hidden="true">*</span>
              <input
                type="email"
                required
                value={email}
                disabled={!!user}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </label>
            <label>
              Account role
              <select
                value={role}
                onChange={(e) => {
                  const next = e.target.value;
                  setRole(next);
                  if (next !== "tenant")
                    setMemberships((old) =>
                      old.map((m) => ({ propertyId: m.propertyId })),
                    );
                  setDefault(
                    next === "manager" ? 2 : next === "seller" ? 3 : 1,
                  );
                  setUserView(true);
                  setSellerView(next === "manager" || next === "seller");
                }}
              >
                {user?.role === "owner" && (
                  <option value="owner">Workspace owner</option>
                )}
                {roles
                  .filter(
                    ([id]) => user?.email !== account.email || id === "manager",
                  )
                  .map(([id, label]) => (
                    <option value={id} key={id}>
                      {label}
                    </option>
                  ))}
              </select>
              <small>
                Administrators manage this workspace and can create other
                administrators. User and Seller views limit actions to their
                personal activity and own business.
              </small>
            </label>
            {!user && (
              <label>
                Initial password <span aria-hidden="true">*</span>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <small>
                  Use at least 12 characters. Share directly with the account
                  owner.
                </small>
              </label>
            )}
          </div>
        </section>
        <section className="ch-editor-section">
          <div className="ch-editor-section-title">
            <span>02</span>
            <div>
              <h3>Views & permissions</h3>
              <p>Choose the workspaces available in their profile menu.</p>
            </div>
          </div>
          <div className="ch-permission-grid">
            <label
              className={`ch-permission-card ${admin || userView ? "selected" : ""}`}
            >
              <UserRound size={24} />
              <strong>User view</strong>
              <small>
                {role === "watchman"
                  ? "Gate, parcels and assigned rounds."
                  : "Community services, bookings and personal records."}
              </small>
              <input
                type="checkbox"
                disabled={admin || role === "watchman"}
                checked={admin || userView}
                onChange={(e) => setUserView(e.target.checked)}
              />
            </label>
            {role !== "watchman" && (
              <label
                className={`ch-permission-card ${admin || sellerView ? "selected" : ""}`}
              >
                <Store size={24} />
                <strong>Seller / Provider view</strong>
                <small>Own products, customer orders and services.</small>
                <input
                  type="checkbox"
                  disabled={admin}
                  checked={admin || sellerView}
                  onChange={(e) => setSellerView(e.target.checked)}
                />
              </label>
            )}
            {admin && (
              <div className="ch-permission-card selected">
                <ShieldCheck size={24} />
                <strong>Admin view</strong>
                <small>People, finance and apartment administration.</small>
                <span className="ch-permission-fixed">
                  Included with administrator role
                </span>
              </div>
            )}
          </div>
          {!views.length && (
            <p role="alert" className="ch-validation">
              Enable at least one view to save this account.
            </p>
          )}
          <label className="ch-starting-view">
            Starting view
            <select
              disabled={!views.length}
              value={
                views.includes(defaultView) ? defaultView : (views[0] ?? "")
              }
              onChange={(e) => setDefault(Number(e.target.value))}
            >
              {!views.length && <option value="">Enable a view first</option>}
              {views.map((v) => (
                <option key={v} value={v}>
                  {v === 2 ? "Admin" : v === 3 ? "Seller / Provider" : "User"}
                </option>
              ))}
            </select>
          </label>
        </section>
        <section className="ch-editor-section">
          <div className="ch-editor-section-title">
            <span>03</span>
            <div>
              <h3>Community assignments</h3>
              <p>
                {admin
                  ? "Administration covers all buildings in this workspace. Personal records still follow their own ownership and occupancy."
                  : "Assign their community. Residents can also have a unit and occupancy dates."}
              </p>
            </div>
          </div>
          {!memberships.length && (
            <p className="community-muted">
              {admin
                ? "Workspace administration access is included. Community assignments are optional."
                : "No building assigned. Add an assignment to grant access to a community."}
            </p>
          )}
          {memberships.map((m, i) => (
            <MembershipEditor
              key={i}
              membership={m}
              role={role}
              properties={properties}
              onChange={(next) =>
                setMemberships((old) => old.map((v, n) => (n === i ? next : v)))
              }
              onRemove={() =>
                setMemberships((old) => old.filter((_, n) => n !== i))
              }
            />
          ))}
          <Button
            type="button"
            variant="secondary"
            disabled={
              busy ||
              !properties.some(
                (p) => !memberships.some((m) => m.propertyId === p.id),
              )
            }
            onClick={() =>
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
          >
            <Plus size={16} />
            Add community assignment
          </Button>
          <p className="community-muted">
            Owner and operator ledgers also use their recorded ownership shares
            and rental agreements.
          </p>
        </section>
        <div className="ch-editor-footer">
          <small>
            {admin
              ? "User · Admin · Seller / Provider"
              : views
                  .map((v) => (v === 3 ? "Seller / Provider" : "User"))
                  .join(" · ")}{" "}
            access
          </small>
          <div className="community-actions">
            <Button
              type="button"
              disabled={busy}
              variant="secondary"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !views.length}>
              {busy ? "Saving…" : user ? "Save changes" : "Create account"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
function MembershipEditor({
  membership: m,
  role,
  properties,
  onChange,
  onRemove,
}: {
  membership: Membership;
  role: string;
  properties: Property[];
  onChange: (m: Membership) => void;
  onRemove: () => void;
}) {
  const resource = useApiResource<Unit[]>(
    useCallback(
      (signal) =>
        m.propertyId
          ? request<{ data: Unit[] }>(
              `/api/properties/${encodeURIComponent(m.propertyId)}/units`,
              { signal },
            )
          : Promise.resolve({ data: [] }),
      [m.propertyId],
    ),
    [],
  );
  return (
    <div className="ch-membership">
      <div className="community-fields">
        <label>
          Building
          <select
            required
            value={m.propertyId}
            onChange={(e) => onChange({ propertyId: e.target.value })}
          >
            <option value="">Choose building</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {role === "tenant" && (
          <label>
            Resident unit
            <select
              value={m.unitId ?? ""}
              disabled={resource.loading}
              onChange={(e) =>
                onChange({
                  ...m,
                  unitId: e.target.value || null,
                  occupancyId: e.target.value ? crypto.randomUUID() : null,
                  startsAt: e.target.value ? new Date().toISOString() : null,
                  endsAt: null,
                })
              }
            >
              <option value="">
                {resource.loading ? "Loading units…" : "Community access only"}
              </option>
              {resource.data.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {role === "tenant" && m.unitId && (
          <>
            <label>
              Move-in date & time
              <input
                type="datetime-local"
                required
                value={localDateTime(m.startsAt)}
                onChange={(e) =>
                  onChange({ ...m, startsAt: dateTimeInstant(e.target.value) })
                }
              />
              <small>
                Times use your device timezone (
                {Intl.DateTimeFormat().resolvedOptions().timeZone}).
              </small>
            </label>
            <label>
              Move-out date & time (optional)
              <input
                type="datetime-local"
                min={localDateTime(m.startsAt)}
                value={localDateTime(m.endsAt)}
                onChange={(e) =>
                  onChange({ ...m, endsAt: dateTimeInstant(e.target.value) })
                }
              />
            </label>
          </>
        )}
      </div>
      {resource.error && <p role="alert">{resource.error}</p>}
      <Button type="button" variant="ghost" onClick={onRemove}>
        Remove assignment
      </Button>
    </div>
  );
}
