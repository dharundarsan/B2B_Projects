import { MobileProviders } from "./MobileProviders";
import { useCallback } from "react";
import { useResource } from "../hooks/useResource";
import { request } from "../lib/api";
import type { UserDirectory } from "../../../../shared/userManagement";
import { Text } from "react-native";
import { Card, Section, s } from "../components/ui";
import { Form, type Save } from "./CommunityForm";
import type { CommunityData } from "../../../../shared/community";
export function MobileCommunityAdmin({
  data: d,
  save,
  rootSave,
  busy,
}: {
  data: CommunityData | null;
  save: Save;
  rootSave: Save;
  busy: boolean;
}) {
  const directory = useResource<UserDirectory | null>(
    useCallback((signal) => request("/admin/users", { signal }), []),
    null,
  );
  const accounts =
    directory.data?.users.filter((u) => u.status === "active") ?? [];
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: d?.property.timezone ?? "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const parties = d?.parties.map((p) => ({ value: p.id, label: p.name })) ?? [];
  const units = d?.units.map((u) => ({ value: u.id, label: u.label })) ?? [];
  const choices = (...vs: string[]) =>
    vs.map((value) => ({ value, label: value }));
  return (
    <>
      <Section title="Communities, blocks & flats" />
      <Card>
        <Form
          title="Create community"
          busy={busy}
          fields={[
            { name: "name", label: "Community name" },
            { name: "address", label: "Address", multiline: true },
            {
              name: "units",
              label: "Planned unit count",
              number: true,
              value: "100",
            },
            {
              name: "timezone",
              label: "Building timezone",
              value: "Asia/Kolkata",
            },
          ]}
          save={(v) =>
            rootSave("/properties", {
              name: v.name,
              address: v.address,
              units: Number(v.units),
              timezone: v.timezone,
            })
          }
        />
      </Card>
      {d && (
        <>
          <Card>
            <Form
              title="Edit community"
              busy={busy}
              fields={[
                {
                  name: "name",
                  label: "Community name",
                  value: d.property.name,
                },
                {
                  name: "address",
                  label: "Address",
                  value: d.property.address,
                },
                {
                  name: "units",
                  label: "Total flat capacity",
                  number: true,
                  value: String(d.property.units),
                },
                {
                  name: "timezone",
                  label: "Time zone",
                  value: d.property.timezone,
                },
              ]}
              save={(v) =>
                rootSave(
                  `/properties/${encodeURIComponent(d.property.id)}`,
                  { ...v, units: Number(v.units) },
                  "PATCH",
                )
              }
            />
          </Card>
          <Card>
            <Text style={s.small}>
              Community → Block / tower → Floor → Flat. Create a separate
              community for each location.
            </Text>
            <Form
              title="Add block / tower"
              busy={busy}
              fields={[{ name: "name", label: "Block / tower name" }]}
              save={(v) => save("blocks", v)}
            />
            {(d.blocks ?? []).map((b) => (
              <Text style={s.label} key={b.id}>
                {b.name}
              </Text>
            ))}
            {(d.blocks ?? []).length > 0 && (
              <Form
                title="Add flats to a floor"
                busy={busy}
                fields={[
                  {
                    name: "blockId",
                    label: "Block / tower",
                    options: (d.blocks ?? []).map((b) => ({
                      value: b.id,
                      label: b.name,
                    })),
                  },
                  {
                    name: "floor",
                    label: "Floor (0 is ground)",
                    number: true,
                    value: "1",
                  },
                  {
                    name: "labels",
                    label: "Flat labels, separated by commas",
                    multiline: true,
                    hint: "A-101, A-102, A-103",
                  },
                ]}
                save={(v) =>
                  save("flats", {
                    ...v,
                    floor: Number(v.floor),
                    labels: (v.labels ?? "")
                      .split(/[,\n]/)
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
            )}
            {d.units.map((u) => (
              <Card key={u.id}>
                <Text style={s.label}>{u.label}</Text>
                <Text style={s.small}>
                  {d.blocks?.find((b) => b.id === u.blockId)?.name ??
                    "Unassigned block"}{" "}
                  · {u.floor ?? "Unassigned floor"}
                </Text>
                {(d.blocks ?? []).length > 0 && (
                  <Form
                    title="Assign flat location"
                    busy={busy}
                    fields={[
                      {
                        name: "blockId",
                        label: "Block",
                        options: (d.blocks ?? []).map((b) => ({
                          value: b.id,
                          label: b.name,
                        })),
                        value: u.blockId ?? "",
                      },
                      {
                        name: "floor",
                        label: "Floor",
                        number: true,
                        value: String(u.floor ?? 0),
                      },
                    ]}
                    save={(v) =>
                      save(
                        `flats/${u.id}/location`,
                        { ...v, floor: Number(v.floor) },
                        "PATCH",
                      )
                    }
                  />
                )}
              </Card>
            ))}
          </Card>
          <Card>
            <Form
              title="Add owner, operator or resident party"
              busy={busy}
              fields={[
                { name: "name", label: "Person or company name" },
                {
                  name: "kind",
                  label: "Party type",
                  options: choices("person", "company"),
                  value: "person",
                },
                {
                  name: "userId",
                  label: "Community account (optional)",
                  options: [
                    { value: "", label: "Unbound company" },
                    ...accounts.map((u) => ({
                      value: u.userId,
                      label: u.displayName || u.email,
                    })),
                  ],
                  hint: "Create accounts and assign their views under People & access.",
                },
              ]}
              save={(v) =>
                save("parties", {
                  name: v.name,
                  kind: v.kind,
                  userId: v.userId || null,
                })
              }
            />
            {d.parties.map((p) => (
              <Text style={s.body} key={p.id}>
                {p.name} · {p.kind}
                {p.userId ? " · account linked" : ""}
              </Text>
            ))}
          </Card>
          <Section title="Ownership and rentals" />
          <Card>
            <Form
              title="Record ownership shares"
              busy={busy}
              fields={[
                { name: "unitId", label: "Unit", options: units },
                { name: "partyId", label: "Owner", options: parties },
                {
                  name: "share",
                  label: "Ownership %",
                  number: true,
                  value: "100",
                },
                {
                  name: "incomeShare",
                  label: "Income %",
                  number: true,
                  value: "100",
                },
                {
                  name: "expenseShare",
                  label: "Expense %",
                  number: true,
                  value: "100",
                },
                {
                  name: "startsOn",
                  label: "Starts on (YYYY-MM-DD)",
                  value: day,
                },
                { name: "endsOn", label: "Ends on, exclusive (optional)" },
              ]}
              save={(v) =>
                save("ownerships", {
                  unitId: v.unitId,
                  partyId: v.partyId,
                  share: Number(v.share),
                  incomeShare: Number(v.incomeShare),
                  expenseShare: Number(v.expenseShare),
                  startsOn: v.startsOn,
                  endsOn: v.endsOn || null,
                })
              }
            />
            {d.ownerships.map((o) => (
              <Card key={o.id}>
                <Text style={s.body}>
                  {parties.find((p) => p.value === o.partyId)?.label} ·{" "}
                  {units.find((u) => u.value === o.unitId)?.label} · {o.share}%
                </Text>
                <Text style={s.small}>
                  Income {o.incomeShare}% · Expenses {o.expenseShare}% ·{" "}
                  {o.startsOn} → {o.endsOn ?? "open"}
                </Text>
                {!o.endsOn && (
                  <Form
                    title="End ownership"
                    busy={busy}
                    fields={[
                      {
                        name: "endsOn",
                        label: "End date, exclusive (YYYY-MM-DD)",
                        value: day,
                      },
                    ]}
                    save={(v) =>
                      save(`ownerships/${o.id}/end`, {
                        endsOn: v.endsOn,
                        revision: o.revision,
                      })
                    }
                  />
                )}
              </Card>
            ))}
          </Card>
          <Card>
            <Form
              title="Create direct lease, master lease or sublease"
              busy={busy}
              fields={[
                {
                  name: "kind",
                  label: "Agreement type",
                  options: choices("direct", "master", "sublease"),
                  value: "direct",
                },
                {
                  name: "debtorPartyId",
                  label: "Tenant or operator",
                  options: parties,
                },
                {
                  name: "creditorPartyId",
                  label: "Landlord or operator",
                  options: parties,
                },
                {
                  name: "parentId",
                  label: "Parent master lease (sublease only)",
                  options: [
                    { value: "", label: "No parent" },
                    ...d.agreements
                      .filter(
                        (a) => a.kind === "master" && a.status === "active",
                      )
                      .map((a) => ({
                        value: a.id,
                        label: `${parties.find((p) => p.value === a.debtorPartyId)?.label} · ${a.startsOn} → ${a.endsOn}`,
                      })),
                  ],
                },
                {
                  name: "unitIds",
                  label: "Units (multiple for master leases)",
                  options: units,
                  multiple: true,
                },
                {
                  name: "occupancyId",
                  label: "Resident occupancy (direct / sublease)",
                  options: [
                    { value: "", label: "None (master lease)" },
                    ...accounts.flatMap((u) =>
                      u.memberships
                        .filter(
                          (m) =>
                            m.propertyId === d?.property.id && m.occupancyId,
                        )
                        .map((m) => ({
                          value: m.occupancyId!,
                          label: `${u.displayName || u.email} · ${m.unitLabel || "unit"}`,
                        })),
                    ),
                  ],
                  hint: "Must match the resident account and assigned unit.",
                },
                {
                  name: "startsOn",
                  label: "Starts on (YYYY-MM-DD)",
                  value: day,
                },
                { name: "endsOn", label: "Ends on, exclusive (YYYY-MM-DD)" },
                { name: "rent", label: "Monthly rent", number: true },
                { name: "deposit", label: "Deposit", number: true, value: "0" },
                { name: "currency", label: "Currency", value: "INR" },
                {
                  name: "dueDay",
                  label: "Monthly due day (1–28)",
                  number: true,
                  value: "5",
                },
              ]}
              save={(v) =>
                save("agreements", {
                  ...v,
                  parentId: v.parentId || null,
                  occupancyId: v.occupancyId || null,
                  unitIds: (v.unitIds ?? "").split(",").filter(Boolean),
                  rent: Number(v.rent),
                  deposit: Number(v.deposit),
                  dueDay: Number(v.dueDay),
                })
              }
            />
            {d.agreements.map((a) => (
              <Card key={a.id}>
                <Text style={s.body}>
                  {a.kind} ·{" "}
                  {parties.find((p) => p.value === a.debtorPartyId)?.label} →{" "}
                  {parties.find((p) => p.value === a.creditorPartyId)?.label}
                </Text>
                <Text style={s.small}>
                  {a.startsOn} → {a.endsOn} · {a.rent} {a.currency}/month
                </Text>
                <Form
                  title="Shorten agreement end date"
                  busy={busy}
                  fields={[
                    {
                      name: "endsOn",
                      label: "New end date, exclusive (YYYY-MM-DD)",
                      value: day,
                    },
                  ]}
                  save={(v) =>
                    save(`agreements/${a.id}/end`, {
                      endsOn: v.endsOn,
                      revision: a.revision,
                    })
                  }
                />
              </Card>
            ))}
          </Card>
          <Section title="Stores and facilities" />
          <MobileProviders data={d} save={save} busy={busy} />
          <Card>
            <Form
              title="Add shared facility"
              busy={busy}
              fields={[
                { name: "name", label: "Facility name" },
                {
                  name: "capacity",
                  label: "Simultaneous reservations",
                  number: true,
                  value: "1",
                },
                {
                  name: "slotMinutes",
                  label: "Slot length (minutes)",
                  number: true,
                  value: "60",
                },
                { name: "price", label: "Fee", number: true, value: "0" },
                { name: "currency", label: "Currency", value: "INR" },
                { name: "rules", label: "Rules", multiline: true },
              ]}
              save={(v) =>
                save("facilities", {
                  ...v,
                  capacity: Number(v.capacity),
                  slotMinutes: Number(v.slotMinutes),
                  price: Number(v.price),
                })
              }
            />
          </Card>
        </>
      )}
    </>
  );
}
