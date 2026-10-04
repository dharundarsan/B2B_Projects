import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { Link } from "react-router-dom";
import { Button, LoadingState } from "../../components/common";
import { Card, None, partyName, unitOptions, type ModuleProps } from "./ui";
import type { Point, Shape } from "../../../../../shared/community";
const Building3D = lazy(() => import("./Building3D"));
export const shapeColor = (kind: string) =>
  ({
    outline: "#E0E8E3",
    flat: "#C6EF75",
    shop: "#F3DAB1",
    common: "#DBE7EA",
    stairs: "#D7D3F0",
    lift: "#C3DFD5",
  })[kind] ?? "#DBE7EA";
export function BuildingMap({ data: d, mutate, busy }: ModuleProps) {
  const [block, setBlock] = useState(
    d.layouts[0]?.blockId ?? d.blocks?.[0]?.id ?? "",
  );
  const scopedLayouts = d.layouts.filter((l) => (l.blockId ?? "") === block);
  const [floor, setFloor] = useState(d.layouts[0]?.floor ?? 0);
  const layout = scopedLayouts.find((l) => l.floor === floor);
  const [name, setName] = useState(layout?.name ?? "Ground floor");
  const [shapes, setShapes] = useState<Shape[]>(layout?.shapes ?? []);
  const [tool, setTool] = useState("select");
  const [kind, setKind] = useState("flat");
  const [selected, setSelected] = useState("");
  const [polygon, setPolygon] = useState<Point[]>([]);
  const [start, setStart] = useState<Point | null>(null);
  const [end, setEnd] = useState<Point | null>(null);
  const [history, setHistory] = useState<Shape[][]>([]);
  const [dirty, setDirty] = useState(false);
  const [view, setView] = useState("2d");
  const [blueprint, setBlueprint] = useState("");
  const [cloneFloor, setCloneFloor] = useState(floor + 1);
  const svg = useRef<SVGSVGElement>(null);
  const pendingSelection = useRef("");
  const drag = useRef<{ id: string; start: Point; before: Shape[] } | null>(
    null,
  );
  useEffect(() => {
    setShapes(layout?.shapes ?? []);
    setName(layout?.name ?? (floor === 0 ? "Ground floor" : "Floor " + floor));
    setHistory([]);
    setPolygon([]);
    setSelected(pendingSelection.current);
    pendingSelection.current = "";
    setDirty(false);
  }, [block, floor, layout?.revision]);
  useEffect(
    () => () => {
      if (blueprint) URL.revokeObjectURL(blueprint);
    },
    [blueprint],
  );
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const commit = (next: Shape[]) => {
    setHistory((h) => [...h.slice(-29), shapes]);
    setShapes(next);
    setDirty(true);
  };
  const chosen = shapes.find((s) => s.id === selected);
  const floorUnits = d.units.filter(
    (u) => (u.blockId ?? "") === block && u.floor === floor,
  );
  const starter = () => {
    const columns = Math.ceil(Math.sqrt(floorUnits.length * 1.6));
    const rows = Math.ceil(floorUnits.length / columns);
    const width = 900 / columns,
      height = 500 / rows;
    commit(
      floorUnits.map((unit, i) => {
        const x = 50 + (i % columns) * width,
          y = 50 + Math.floor(i / columns) * height;
        return {
          id: crypto.randomUUID(),
          kind: "flat",
          label: unit.label,
          unitId: unit.id,
          points: [
            { x, y },
            { x: x + width - 10, y },
            { x: x + width - 10, y: y + height - 10 },
            { x, y: y + height - 10 },
          ],
        };
      }),
    );
    setTool("select");
  };
  const point = (event: PointerEvent) => {
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      matrix.inverse(),
    );
    return {
      x: Math.round(Math.max(0, Math.min(1000, p.x)) / 10) * 10,
      y: Math.round(Math.max(0, Math.min(600, p.y)) / 10) * 10,
    };
  };
  const add = (points: Point[]) => {
    const id = crypto.randomUUID();
    commit([
      ...shapes,
      {
        id,
        kind,
        label:
          kind === "outline"
            ? "Building outline"
            : kind[0].toUpperCase() + kind.slice(1),
        unitId: null,
        points,
      },
    ]);
    setSelected(id);
  };
  const move = (before: Shape[], id: string, dx: number, dy: number) =>
    before.map((s) => {
      if (s.id !== id) return s;
      const x = Math.max(
        -Math.min(...s.points.map((p) => p.x)),
        Math.min(1000 - Math.max(...s.points.map((p) => p.x)), dx),
      );
      const y = Math.max(
        -Math.min(...s.points.map((p) => p.y)),
        Math.min(600 - Math.max(...s.points.map((p) => p.y)), dy),
      );
      return {
        ...s,
        points: s.points.map((p) => ({ x: p.x + x, y: p.y + y })),
      };
    });
  const down = (e: PointerEvent<SVGSVGElement>) => {
    if (!d.canManage || busy) return;
    const p = point(e);
    if (tool === "polygon") {
      setPolygon((old) => [...old, p]);
      return;
    }
    if (tool === "rectangle") {
      e.currentTarget.setPointerCapture(e.pointerId);
      setStart(p);
      setEnd(p);
    }
  };
  const up = () => {
    if (drag.current) {
      if (JSON.stringify(drag.current.before) !== JSON.stringify(shapes)) {
        setHistory((h) => [...h.slice(-29), drag.current!.before]);
        setDirty(true);
      }
      drag.current = null;
    }
    if (
      start &&
      end &&
      Math.abs(end.x - start.x) >= 10 &&
      Math.abs(end.y - start.y) >= 10
    )
      add([
        { x: start.x, y: start.y },
        { x: end.x, y: start.y },
        { x: end.x, y: end.y },
        { x: start.x, y: end.y },
      ]);
    setStart(null);
    setEnd(null);
  };
  const save = async () => {
    const ok = await mutate("layouts", {
      floor,
      blockId: block || null,
      name,
      shapes,
      revision: layout?.revision ?? 0,
    });
    if (ok) setDirty(false);
  };
  const all = scopedLayouts.map((l) => ({
    ...l,
    shapes: l.floor === floor ? shapes : l.shapes,
  }));
  if (!layout)
    all.push({
      id: "draft",
      propertyId: d.property.id,
      revision: 0,
      createdAt: "",
      floor,
      name,
      shapes,
    });
  return (
    <div className="community-stack">
      <Card
        title="Design your building"
        detail={
          d.canManage
            ? "Draw a rectangle or click polygon corners. Label each shape and link flats or shops to registered units. Save a draft, then publish it for the community."
            : "Choose a published floor to explore your apartment."
        }
      >
        {d.canManage && !shapes.length && floorUnits.length > 0 && (
          <div className="ch-offer-callout">
            <div>
              <strong>
                Start with this floor's {floorUnits.length} registered flats
              </strong>
              <p>
                Create a schematic grid, then move and resize spaces to match
                your floor. It is a drawing guide, not a measured floor plan.
              </p>
            </div>
            <Button variant="secondary" disabled={busy} onClick={starter}>
              Create starter sketch
            </Button>
          </div>
        )}
        {!d.canManage && !scopedLayouts.length && (
          <None>No floor maps have been published for this block yet.</None>
        )}
        {d.canManage && (
          <div className="ch-map-guide">
            <span>
              <b>1</b> Choose block & floor
            </span>
            <span>
              <b>2</b> Draw and link flats
            </span>
            <span>
              <b>3</b> Save draft & publish
            </span>
            <Link to={"/properties/" + encodeURIComponent(d.property.id)}>
              Set up blocks & flats
            </Link>
          </div>
        )}
        <div className="community-toolbar">
          <label>
            Block / tower
            <select
              value={block}
              onChange={(e) => {
                if (
                  !dirty ||
                  window.confirm("Discard the unsaved floor edits?")
                ) {
                  setBlock(e.target.value);
                  setFloor(
                    d.layouts.find((l) => (l.blockId ?? "") === e.target.value)
                      ?.floor ?? 0,
                  );
                  setBlueprint("");
                }
              }}
            >
              <option value="">Previous / unassigned plans</option>
              {(d.blocks ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Floor
            <select
              value={floor}
              onChange={(e) => {
                if (
                  !dirty ||
                  window.confirm("Discard the unsaved floor edits?")
                )
                  setFloor(Number(e.target.value));
              }}
            >
              {[
                ...new Set([
                  ...scopedLayouts.map((l) => l.floor),
                  ...d.units
                    .filter(
                      (u) => (u.blockId ?? "") === block && u.floor != null,
                    )
                    .map((u) => u.floor!),
                  floor,
                ]),
              ]
                .sort((a, b) => a - b)
                .map((f) => (
                  <option key={f} value={f}>
                    {scopedLayouts.find((l) => l.floor === f)?.name ??
                      "Floor " + f}
                  </option>
                ))}
            </select>
          </label>
          {d.canManage && (
            <label>
              Add / open floor
              <input
                type="number"
                min={-5}
                max={150}
                value={floor}
                onChange={(e) => {
                  const f = Number(e.target.value);
                  if (
                    f >= -5 &&
                    f <= 150 &&
                    (!dirty ||
                      window.confirm("Discard the unsaved floor edits?"))
                  )
                    setFloor(f);
                }}
              />
            </label>
          )}
          <div className="community-actions">
            <Button
              variant={view === "2d" ? "primary" : "secondary"}
              onClick={() => setView("2d")}
            >
              2D floor plan
            </Button>
            <Button
              variant={view === "3d" ? "primary" : "secondary"}
              onClick={() => setView("3d")}
            >
              3D building
            </Button>
          </div>
        </div>
        {d.canManage && view === "2d" && (
          <div className="community-map-tools">
            <label>
              Floor name
              <input
                value={name}
                maxLength={200}
                onChange={(e) => {
                  setName(e.target.value);
                  setDirty(true);
                }}
              />
            </label>
            <label>
              Tool
              <select
                value={tool}
                onChange={(e) => {
                  setTool(e.target.value);
                  setPolygon([]);
                }}
              >
                <option value="select">Select / move</option>
                <option value="rectangle">Draw rectangle</option>
                <option value="polygon">Sketch polygon</option>
              </select>
            </label>
            <label>
              Space type
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                {["outline", "flat", "shop", "common", "stairs", "lift"].map(
                  (k) => (
                    <option value={k} key={k}>
                      {k}
                    </option>
                  ),
                )}
              </select>
            </label>
            <Button
              variant="secondary"
              disabled={busy || history.length === 0}
              onClick={() => {
                setShapes(history[history.length - 1]);
                setHistory(history.slice(0, -1));
                setDirty(true);
              }}
            >
              Undo
            </Button>
            {tool === "polygon" && (
              <Button
                disabled={polygon.length < 3 || busy}
                onClick={() => {
                  add(polygon);
                  setPolygon([]);
                }}
              >
                Finish polygon
              </Button>
            )}
            <label className="community-upload">
              Trace a blueprint
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && file.size <= 20 * 1024 * 1024)
                    setBlueprint(URL.createObjectURL(file));
                  e.target.value = "";
                }}
              />
            </label>
            {blueprint && (
              <Button variant="ghost" onClick={() => setBlueprint("")}>
                Remove guide
              </Button>
            )}
          </div>
        )}
        {view === "3d" ? (
          <Suspense fallback={<LoadingState label="Loading 3D view…" />}>
            <Building3D
              layouts={all}
              onSelect={(id) => {
                setView("2d");
                const found = all.find((l) =>
                  l.shapes.some((s) => s.id === id),
                );
                if (found && found.floor !== floor) {
                  pendingSelection.current = id;
                  setFloor(found.floor);
                } else setSelected(id);
              }}
            />
          </Suspense>
        ) : (
          <div className="community-map-layout">
            <svg
              ref={svg}
              className="community-canvas"
              viewBox="0 0 1000 600"
              aria-label={`${name} floor plan`}
              role="group"
              onPointerDown={down}
              onPointerMove={(e) => {
                if (start) setEnd(point(e));
                if (drag.current) {
                  const p = point(e);
                  setShapes(
                    move(
                      drag.current.before,
                      drag.current.id,
                      p.x - drag.current.start.x,
                      p.y - drag.current.start.y,
                    ),
                  );
                }
              }}
              onPointerUp={up}
              onPointerCancel={() => {
                if (drag.current) setShapes(drag.current.before);
                drag.current = null;
                setStart(null);
                setEnd(null);
              }}
            >
              <defs>
                <pattern
                  id="community-map-grid"
                  width="20"
                  height="20"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 20 0 L 0 0 0 20"
                    fill="none"
                    stroke="#E1E8E3"
                    strokeWidth="1"
                  />
                </pattern>
              </defs>
              <rect width="1000" height="600" fill="url(#community-map-grid)" />
              {blueprint && (
                <image
                  href={blueprint}
                  width="1000"
                  height="600"
                  opacity=".3"
                />
              )}
              {[...shapes]
                .sort(
                  (a, b) =>
                    Number(b.kind === "outline") - Number(a.kind === "outline"),
                )
                .map((shape) => {
                  const center = {
                    x:
                      shape.points.reduce((s, p) => s + p.x, 0) /
                      shape.points.length,
                    y:
                      shape.points.reduce((s, p) => s + p.y, 0) /
                      shape.points.length,
                  };
                  return (
                    <g
                      key={shape.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`${shape.label}, ${shape.kind}`}
                      onPointerDown={(e) => {
                        if (tool !== "select") return;
                        e.stopPropagation();
                        setSelected(shape.id);
                        if (d.canManage && !busy) {
                          svg.current?.setPointerCapture(e.pointerId);
                          drag.current = {
                            id: shape.id,
                            start: point(e),
                            before: shapes,
                          };
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelected(shape.id);
                        }
                        if (
                          d.canManage &&
                          !busy &&
                          [
                            "ArrowLeft",
                            "ArrowRight",
                            "ArrowUp",
                            "ArrowDown",
                            "Delete",
                          ].includes(e.key)
                        ) {
                          e.preventDefault();
                          if (e.key === "Delete")
                            commit(shapes.filter((s) => s.id !== shape.id));
                          else
                            commit(
                              move(
                                shapes,
                                shape.id,
                                e.key === "ArrowLeft"
                                  ? -10
                                  : e.key === "ArrowRight"
                                    ? 10
                                    : 0,
                                e.key === "ArrowUp"
                                  ? -10
                                  : e.key === "ArrowDown"
                                    ? 10
                                    : 0,
                              ),
                            );
                        }
                      }}
                    >
                      <title>{shape.label}</title>
                      <polygon
                        points={shape.points
                          .map((p) => `${p.x},${p.y}`)
                          .join(" ")}
                        fill={shapeColor(shape.kind)}
                        fillOpacity={shape.kind === "outline" ? 0.25 : 0.85}
                        stroke={selected === shape.id ? "#14634C" : "#7E9C8C"}
                        strokeWidth={selected === shape.id ? 4 : 2}
                      />
                      {shape.kind !== "outline" && (
                        <text
                          x={center.x}
                          y={center.y}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          pointerEvents="none"
                          fontSize="15"
                          fill="#18382D"
                        >
                          {shape.label}
                        </text>
                      )}
                    </g>
                  );
                })}
              {start && end && (
                <rect
                  x={Math.min(start.x, end.x)}
                  y={Math.min(start.y, end.y)}
                  width={Math.abs(start.x - end.x)}
                  height={Math.abs(start.y - end.y)}
                  fill="#C6EF75"
                  fillOpacity=".4"
                  stroke="#14634C"
                  strokeDasharray="6 4"
                />
              )}
              {polygon.length > 0 && (
                <polyline
                  points={polygon.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  stroke="#14634C"
                  strokeWidth="3"
                />
              )}
            </svg>
            <aside className="community-map-inspector">
              {chosen ? (
                <>
                  <h3>{chosen.label}</h3>
                  <p className="community-muted">
                    {chosen.kind}{" "}
                    {chosen.unitId &&
                      " · Linked unit " +
                        d.units.find((u) => u.id === chosen.unitId)?.label}
                  </p>
                  {d.canManage && (
                    <>
                      <label>
                        Label
                        <input
                          value={chosen.label}
                          maxLength={120}
                          onChange={(e) =>
                            commit(
                              shapes.map((s) =>
                                s.id === chosen.id
                                  ? { ...s, label: e.target.value }
                                  : s,
                              ),
                            )
                          }
                        />
                      </label>
                      {["flat", "shop"].includes(chosen.kind) && (
                        <label>
                          Registered unit
                          <select
                            value={chosen.unitId ?? ""}
                            onChange={(e) =>
                              commit(
                                shapes.map((s) =>
                                  s.id === chosen.id
                                    ? { ...s, unitId: e.target.value || null }
                                    : s,
                                ),
                              )
                            }
                          >
                            <option value="">Unlinked</option>
                            {unitOptions({
                              ...d,
                              units: d.units.filter(
                                (u) =>
                                  (u.blockId ?? "") === block &&
                                  (u.floor == null || u.floor === floor),
                              ),
                            }).map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <Button
                        variant="danger"
                        disabled={busy}
                        onClick={() => {
                          commit(shapes.filter((s) => s.id !== chosen.id));
                          setSelected("");
                        }}
                      >
                        Delete shape
                      </Button>
                    </>
                  )}
                  {d.ownerships
                    .filter((o) => o.unitId === chosen.unitId && !o.endsOn)
                    .map((o) => (
                      <p key={o.id}>
                        {partyName(d, o.partyId)} · {o.share}% ownership
                      </p>
                    ))}
                </>
              ) : (
                <None>
                  {d.canManage
                    ? "Select a shape to label it, link a unit or move it."
                    : "Select a space to see its label."}
                </None>
              )}
            </aside>
          </div>
        )}
        {d.canManage && (
          <div className="community-toolbar">
            <div className="community-actions">
              <Button
                disabled={busy || (!dirty && !layout)}
                onClick={() => void save()}
              >
                Save draft
              </Button>
              <Button
                variant="secondary"
                disabled={busy || dirty || !layout}
                onClick={() =>
                  layout &&
                  void mutate(`layouts/${layout.id}/actions`, {
                    action: "publish",
                    revision: layout.revision,
                  })
                }
              >
                Publish floor
              </Button>
              <span className="community-muted">
                {dirty
                  ? "Unsaved changes"
                  : layout?.publishedAt
                    ? "Last published " +
                      new Date(layout.publishedAt).toLocaleString()
                    : "Draft"}{" "}
                · Revision {layout?.revision ?? 0}
              </span>
            </div>
            <div className="community-actions">
              <label>
                Copy to floor
                <input
                  type="number"
                  min={-5}
                  max={150}
                  value={cloneFloor}
                  onChange={(e) => setCloneFloor(Number(e.target.value))}
                />
              </label>
              <Button
                variant="secondary"
                disabled={
                  busy ||
                  dirty ||
                  !shapes.length ||
                  scopedLayouts.some((l) => l.floor === cloneFloor)
                }
                onClick={() =>
                  void mutate("layouts", {
                    floor: cloneFloor,
                    blockId: block || null,
                    name: "Floor " + cloneFloor,
                    revision: 0,
                    shapes: shapes.map((s) => ({
                      ...s,
                      id: crypto.randomUUID(),
                      unitId: null,
                    })),
                  })
                }
              >
                Duplicate floor
              </Button>
            </div>
          </div>
        )}
        {blueprint && (
          <p className="community-muted">
            The blueprint is a temporary drawing guide on this device. Saved and
            published shapes contain the floor geometry and unit links.
          </p>
        )}
      </Card>
    </div>
  );
}
