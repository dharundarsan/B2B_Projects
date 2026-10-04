import { Deliveries } from "./Deliveries";
import {
  Action,
  Card,
  Form,
  None,
  Status,
  amount,
  iso,
  opts,
  unitName,
  unitOptions,
  type ModuleProps,
} from "./ui";
export function Operations({
  data: d,
  role,
  mutate,
  busy,
  section,
}: ModuleProps & { section: string }) {
  if (section === "facilities")
    return (
      <div className="community-stack">
        {d.canManage && (
          <Form
            title="Add a shared facility"
            busy={busy}
            fields={[
              { name: "name", label: "Facility name" },
              {
                name: "capacity",
                label: "Simultaneous bookings allowed",
                type: "number",
                value: 1,
                min: 1,
                max: 1000,
              },
              {
                name: "slotMinutes",
                label: "Slot duration (minutes)",
                type: "number",
                value: 60,
                min: 15,
                max: 1440,
              },
              {
                name: "price",
                label: "Fee per booking",
                type: "number",
                value: 0,
              },
              { name: "currency", label: "Currency", value: "INR" },
              {
                name: "rules",
                label: "Usage rules",
                type: "textarea",
                optional: true,
              },
            ]}
            onSubmit={(v) => mutate("facilities", v)}
          />
        )}
        <div className="community-grid">
          {d.facilities.map((f) => (
            <Card key={f.id} title={f.name}>
              <Status value={f.status} />
              <p>{f.rules}</p>
              <p>
                {f.slotMinutes} minutes · Capacity {f.capacity} ·{" "}
                {amount(f.price, f.currency)}
              </p>
              {f.status === "active" && !d.canManage && (
                <Form
                  title="Book a slot"
                  busy={busy}
                  submit="Reserve slot"
                  fields={[
                    {
                      name: "startsAt",
                      label: "Start time",
                      type: "datetime-local",
                    },
                  ]}
                  onSubmit={(v) =>
                    mutate("bookings", {
                      facilityId: f.id,
                      startsAt: iso(v.startsAt),
                      submissionId: v.__submissionId,
                    })
                  }
                />
              )}{" "}
              {d.canManage && (
                <Action
                  path="facilities"
                  row={f}
                  action={f.status === "active" ? "paused" : "active"}
                  label={
                    f.status === "active" ? "Pause bookings" : "Reopen bookings"
                  }
                  mutate={mutate}
                  busy={busy}
                />
              )}
            </Card>
          ))}
        </div>
        {!d.facilities.length && (
          <None>No shared facilities have been registered.</None>
        )}
        <Card
          title={d.canManage ? "Facility reservations" : "Your reservations"}
        >
          {!d.bookings.length && <None />}
          {d.bookings.map((b) => (
            <article className="community-record" key={b.id}>
              <h3>
                {d.facilities.find((f) => f.id === b.facilityId)?.name}{" "}
                <Status value={b.status} />
              </h3>
              <p>
                {new Date(b.startsAt).toLocaleString()} →{" "}
                {new Date(b.endsAt).toLocaleTimeString()} ·{" "}
                {amount(b.price, b.currency)}
              </p>
              {b.status === "confirmed" &&
                new Date(b.startsAt).getTime() > Date.now() && (
                  <Action
                    path="bookings"
                    row={b}
                    action="cancel"
                    label="Cancel reservation"
                    mutate={mutate}
                    busy={busy}
                  />
                )}
            </article>
          ))}
        </Card>
      </div>
    );
  if (section === "gate" && d.userContext === 3)
    return <Deliveries data={d} role={role} mutate={mutate} busy={busy} />;
  if (section === "gate")
    return (
      <div className="community-stack">
        <Deliveries data={d} role={role} mutate={mutate} busy={busy} />
        {(role === "tenant" || d.canGate) && (
          <Form
            title={
              role === "tenant"
                ? "Preapprove a visit or parcel"
                : "Register an expected visitor / delivery"
            }
            busy={busy}
            fields={[
              {
                name: "kind",
                label: "Entry type",
                options: opts("visitor", "delivery", "contractor", "parcel"),
                value: "visitor",
              },
              { name: "name", label: "Visitor / delivery name" },
              {
                name: "unitId",
                label: "Destination unit",
                options: unitOptions(d).filter(
                  (u) => d.canGate || d.myUnitIds.includes(u.id),
                ),
              },
              {
                name: "expectedAt",
                label: "Expected date and time",
                type: "datetime-local",
              },
            ]}
            onSubmit={(v) =>
              mutate("gate", {
                ...v,
                expectedAt: iso(v.expectedAt),
                residentUserId: null,
                occupancyId: null,
              })
            }
          />
        )}
        <Card
          title={
            d.canGate ? "Watchman entry desk" : "Your visitors and parcels"
          }
          detail="Arrival is allowed after approval. A parcel accepted by the watchman stays separate from resident receipt."
        >
          {!d.gateEntries.length && <None />}
          {[...d.gateEntries].reverse().map((g) => (
            <article className="community-record" key={g.id}>
              <div className="community-spread">
                <h3>{g.name}</h3>
                <span>Unit {unitName(d, g.unitId)}</span>
              </div>
              <p>
                {g.kind} · Expected {new Date(g.expectedAt).toLocaleString()}
              </p>
              <div className="community-actions">
                <Status value={g.approval} />
                <Status value={g.status} />
              </div>
              <div className="community-actions">
                {g.approval === "pending" &&
                  (role === "tenant" || d.canManage) && (
                    <>
                      <Action
                        path="gate"
                        row={g}
                        action="approve"
                        label="Approve entry"
                        mutate={mutate}
                        busy={busy}
                      />
                      <Action
                        path="gate"
                        row={g}
                        action="deny"
                        label="Deny"
                        mutate={mutate}
                        busy={busy}
                      />
                    </>
                  )}
                {d.canGate &&
                  g.approval === "approved" &&
                  g.status === "expected" && (
                    <Action
                      path="gate"
                      row={g}
                      action={g.kind === "parcel" ? "accept-parcel" : "arrive"}
                      label={
                        g.kind === "parcel"
                          ? "Accept at parcel desk"
                          : "Record arrival"
                      }
                      mutate={mutate}
                      busy={busy}
                    />
                  )}{" "}
                {d.canGate && g.status === "arrived" && (
                  <Action
                    path="gate"
                    row={g}
                    action="depart"
                    label="Record departure"
                    mutate={mutate}
                    busy={busy}
                  />
                )}{" "}
                {role === "tenant" && g.status === "accepted" && (
                  <Action
                    path="gate"
                    row={g}
                    action="receive-parcel"
                    label="I received this parcel"
                    mutate={mutate}
                    busy={busy}
                  />
                )}
              </div>
              {(g.arrivedAt || g.acceptedAt) && (
                <p className="community-muted">
                  At desk:{" "}
                  {new Date(g.arrivedAt ?? g.acceptedAt!).toLocaleString()}
                  {g.receivedAt &&
                    " · Resident received " +
                      new Date(g.receivedAt).toLocaleString()}
                  {g.departedAt &&
                    " · Departed " + new Date(g.departedAt).toLocaleString()}
                </p>
              )}
            </article>
          ))}
        </Card>
      </div>
    );
  return (
    <div className="community-stack">
      {(d.canManage || d.canGate) && (
        <Form
          title={
            d.canManage
              ? "Post notice, round or shift note"
              : "Add shift handover note"
          }
          busy={busy}
          fields={[
            {
              name: "kind",
              label: "Post type",
              options: opts(
                ...(d.canManage ? ["notice", "round", "shift"] : ["shift"]),
              ),
              value: d.canManage ? "notice" : "shift",
            },
            { name: "title", label: "Title" },
            { name: "body", label: "Details", type: "textarea" },
            {
              name: "assignedUserId",
              label: "Assigned watchman UUID (rounds only)",
              optional: true,
            },
          ]}
          onSubmit={(v) =>
            mutate("notes", { ...v, assignedUserId: v.assignedUserId || null })
          }
        />
      )}
      <Card title="Community notices and staff handover">
        {!d.notes.length && <None />}
        {[...d.notes].reverse().map((n) => (
          <article className="community-record" key={n.id}>
            <h3>
              {n.title} <Status value={n.kind} />
            </h3>
            <p className="community-preserve">{n.body}</p>
            <p className="community-muted">
              {new Date(n.createdAt).toLocaleString()}
            </p>
            {n.kind === "round" && (
              <>
                <Status value={n.status} />
                <Action
                  path="notes"
                  row={n}
                  action={n.status === "done" ? "open" : "done"}
                  label={
                    n.status === "done" ? "Reopen round" : "Mark round complete"
                  }
                  mutate={mutate}
                  busy={busy}
                />
              </>
            )}
          </article>
        ))}
      </Card>
    </div>
  );
}
