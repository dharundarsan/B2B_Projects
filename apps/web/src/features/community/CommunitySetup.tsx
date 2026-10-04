import { CommonAreaSection } from "../CommonAreaSection";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Building2, MapPin, ArrowUpRight } from "lucide-react";
import { api } from "../../api";
import { communityApi } from "./api";
import { useWorkspace } from "./WorkspaceContext";
import { Card, Form, None, type Values, type FieldSpec } from "./ui";
import { ErrorNotice, LoadingState } from "../../components/common";
import type { Property } from "../../../../../shared/community";

const communityFields = (p?: Property): FieldSpec[] => [
  {
    name: "name",
    label: "Community name",
    value: p?.name,
    hint: "For example, Prestige Lakeside. Each location is a separate community.",
  },
  { name: "address", label: "Community address", value: p?.address },
  {
    name: "units",
    label: "Total flat capacity",
    type: "number",
    min: 1,
    value: p?.units ?? 100,
  },
  {
    name: "timezone",
    label: "Time zone",
    value: p?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    hint: "For example, Asia/Kolkata.",
  },
];
export function CommunitySetup() {
  const { id } = useParams();
  const { context, resource } = useWorkspace();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [block, setBlock] = useState("all"),
    [search, setSearch] = useState("");
  const save = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
      resource.refresh();
      context.refresh();
      setMessage("Saved successfully.");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
      return false;
    } finally {
      setBusy(false);
    }
  };
  const propertyInput = (v: Values) => ({
    name: String(v.name),
    address: String(v.address),
    units: Number(v.units),
    timezone: String(v.timezone),
  });
  const data = id && resource.data?.property.id === id ? resource.data : null;
  const blocks = data?.blocks ?? [];
  const visible =
    data?.units.filter(
      (u) =>
        (block === "all" ||
          (block === "unassigned" ? !u.blockId : u.blockId === block)) &&
        u.label.toLowerCase().includes(search.toLowerCase()),
    ) ?? [];
  return (
    <div className="community-stack">
      <div className="ch-section-heading">
        <div>
          <h1>{data?.property.name ?? "Communities & flats"}</h1>
          <p>
            {id
              ? "Organize your blocks, floors and flats before assigning residents or sketching a map."
              : "Manage each apartment community at its own location."}
          </p>
        </div>
        {id && (
          <Link className="button secondary" to="/properties">
            All communities
          </Link>
        )}
      </div>
      <div className="ch-setup-path">
        <span>
          <b>1</b> Community <small>Prestige Lakeside</small>
        </span>
        <span>
          <b>2</b> Block / tower <small>Block A, Block B</small>
        </span>
        <span>
          <b>3</b> Floor <small>Ground, 1, 2…</small>
        </span>
        <span>
          <b>4</b> Flat <small>A-101, B-101</small>
        </span>
      </div>
      {error && <ErrorNotice message={error} onRetry={() => setError("")} />}
      {message && (
        <p role="status" className="community-success">
          {message}
        </p>
      )}
      {!id ? (
        <>
          <Form
            title="Create community"
            fields={communityFields()}
            busy={busy}
            onSubmit={(v) => save(() => api.createProperty(propertyInput(v)))}
          />
          {context.loading && !context.data ? (
            <LoadingState />
          ) : (
            <div className="community-grid">
              {context.data?.properties.map((p) => (
                <Link
                  className="ch-community-tile"
                  key={p.id}
                  to={"/properties/" + encodeURIComponent(p.id)}
                >
                  <Building2 size={28} />
                  <h2>{p.name}</h2>
                  <p>
                    <MapPin size={15} /> {p.address}
                  </p>
                  <small>Capacity: {p.units} flats</small>
                  <span>
                    Manage blocks & flats <ArrowUpRight size={16} />
                  </span>
                </Link>
              ))}
            </div>
          )}
          {!context.loading && !context.data?.properties.length && (
            <None>Create your first community to get started.</None>
          )}
        </>
      ) : !data ? (
        resource.error ? (
          <ErrorNotice message={resource.error} onRetry={resource.refresh} />
        ) : (
          <LoadingState />
        )
      ) : (
        <>
          <div className="ch-metrics">
            <div>
              <strong>{blocks.length}</strong>
              <span>Blocks / towers</span>
            </div>
            <div>
              <strong>{data.units.length}</strong>
              <span>Registered flats</span>
            </div>
            <div>
              <strong>{data.units.filter((u) => !u.blockId).length}</strong>
              <span>Flats to organize</span>
            </div>
            <div>
              <strong>{data.property.units - data.units.length}</strong>
              <span>Remaining capacity</span>
            </div>
          </div>
          <Card title="Community settings" detail={data.property.address}>
            <div className="community-actions">
              <Form
                title="Edit community"
                busy={busy}
                fields={communityFields(data.property)}
                onSubmit={(v) =>
                  save(() => api.updateProperty(id, propertyInput(v)))
                }
              />
              <Link
                className="button secondary"
                to={`/admin?property=${encodeURIComponent(id)}&section=people`}
              >
                Assign people
              </Link>
              <Link
                className="button secondary"
                to={`/admin?property=${encodeURIComponent(id)}&section=map`}
              >
                Design building map
              </Link>
              <Link className="button secondary" to="#shared-area-maintenance">
                Shared-area maintenance
              </Link>
            </div>
          </Card>
          <Card
            title="Blocks & towers"
            detail="Add each named block inside this community. Another location belongs in a separate community."
          >
            <Form
              title="Add block / tower"
              busy={busy}
              fields={[
                {
                  name: "name",
                  label: "Block / tower name",
                  hint: "For example, Block A or Maple Tower.",
                },
              ]}
              onSubmit={(v) => save(() => communityApi.send(id, "blocks", v))}
            />
            <div className="ch-block-grid">
              {blocks.map((b) => (
                <section key={b.id}>
                  <Building2 size={22} />
                  <h3>{b.name}</h3>
                  <p>
                    {data.units.filter((u) => u.blockId === b.id).length} flats
                    ·{" "}
                    {
                      new Set(
                        data.units
                          .filter((u) => u.blockId === b.id)
                          .map((u) => u.floor),
                      ).size
                    }{" "}
                    floors
                  </p>
                  <Form
                    title="Rename block"
                    busy={busy}
                    fields={[
                      { name: "name", label: "Block name", value: b.name },
                    ]}
                    onSubmit={(v) =>
                      save(() =>
                        communityApi.send(
                          id,
                          `blocks/${b.id}`,
                          { ...v, revision: b.revision },
                          "PATCH",
                        ),
                      )
                    }
                  />
                </section>
              ))}
            </div>
          </Card>
          <Card
            title="Floors & flats"
            detail="Add flats together on one floor. Labels must be unique in this community; use block prefixes, such as A-101 and B-101."
          >
            {blocks.length ? (
              <Form
                title="Add flats to a floor"
                busy={busy}
                fields={[
                  {
                    name: "blockId",
                    label: "Block / tower",
                    options: blocks.map((b) => ({ id: b.id, name: b.name })),
                  },
                  {
                    name: "floor",
                    label: "Floor number (0 is ground)",
                    type: "number",
                    min: -5,
                    max: 150,
                    value: 1,
                  },
                  {
                    name: "labels",
                    label: "Flat labels",
                    type: "textarea",
                    hint: "Separate with commas or new lines: A-101, A-102, A-103.",
                  },
                ]}
                onSubmit={(v) =>
                  save(() =>
                    communityApi.send(id, "flats", {
                      ...v,
                      labels: String(v.labels)
                        .split(/[,\n]/)
                        .map((s) => s.trim())
                        .filter(Boolean),
                    }),
                  )
                }
              />
            ) : (
              <None>Add a block first, then register its flats.</None>
            )}
            {data.units.some((u) => !u.blockId) && (
              <p className="ch-info">
                Existing flats are preserved. Use “Assign location” to put them
                in a block and floor without changing their rent or resident
                records.
              </p>
            )}
            <div className="community-toolbar">
              <label>
                Block filter
                <select
                  value={block}
                  onChange={(e) => setBlock(e.target.value)}
                >
                  <option value="all">All blocks</option>
                  <option value="unassigned">Needs assignment</option>
                  {blocks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Find a flat
                <input
                  type="search"
                  placeholder="Search flat labels…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
            </div>
            {[...new Set(visible.map((u) => u.floor ?? null))]
              .sort((a, b) => (a ?? -999) - (b ?? -999))
              .map((f) => (
                <section key={f ?? "unassigned"} className="ch-floor-section">
                  <h3>
                    {f === null
                      ? "Location not assigned"
                      : f === 0
                        ? "Ground floor"
                        : `Floor ${f}`}
                  </h3>
                  <div className="ch-flat-grid">
                    {visible
                      .filter((u) => (u.floor ?? null) === f)
                      .map((u) => (
                        <article key={u.id}>
                          <strong>{u.label}</strong>
                          <small>
                            {blocks.find((b) => b.id === u.blockId)?.name ??
                              "Unassigned block"}
                          </small>
                          {blocks.length > 0 && (
                            <Form
                              title="Assign location"
                              busy={busy}
                              fields={[
                                {
                                  name: "blockId",
                                  label: "Block / tower",
                                  options: blocks.map((b) => ({
                                    id: b.id,
                                    name: b.name,
                                  })),
                                  value: u.blockId ?? "",
                                },
                                {
                                  name: "floor",
                                  label: "Floor number",
                                  type: "number",
                                  min: -5,
                                  max: 150,
                                  value: u.floor ?? 0,
                                },
                              ]}
                              onSubmit={(v) =>
                                save(() =>
                                  communityApi.send(
                                    id,
                                    `flats/${u.id}/location`,
                                    v,
                                    "PATCH",
                                  ),
                                )
                              }
                            />
                          )}
                        </article>
                      ))}
                  </div>
                </section>
              ))}
            {!visible.length && <None>No flats match this view.</None>}
          </Card>
          <div id="shared-area-maintenance">
            <CommonAreaSection propertyId={id} />
          </div>
        </>
      )}
    </div>
  );
}
