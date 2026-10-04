import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import * as Crypto from "expo-crypto";
import { Button, Card, Chips, Empty, s } from "../components/ui";
import { Form, type Save } from "./CommunityForm";
import type { CommunityData, Shape } from "../../../../shared/community";
const color = (kind: string) =>
  ({
    outline: "#E0E8E3",
    flat: "#C6EF75",
    shop: "#F3DAB1",
    common: "#DBE7EA",
    stairs: "#D7D3F0",
    lift: "#C3DFD5",
  })[kind] ?? "#DBE7EA";
const box = (shape: Shape) => {
  const xs = shape.points.map((p) => p.x),
    ys = shape.points.map((p) => p.y);
  const x = Math.min(...xs),
    y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
};
export function MobileBuildingAdmin({
  data: d,
  save,
  busy,
}: {
  data: CommunityData;
  save: Save;
  busy: boolean;
}) {
  const [block, setBlock] = useState(
    d.layouts[0]?.blockId ?? d.blocks?.[0]?.id ?? "",
  );
  const scopedLayouts = d.layouts.filter((l) => (l.blockId ?? "") === block);
  const [floor, setFloor] = useState(d.layouts[0]?.floor ?? 0);
  const [selected, setSelected] = useState("");
  const layout = scopedLayouts.find((l) => l.floor === floor);
  const chosen = layout?.shapes.find((s) => s.id === selected);
  const bounds = chosen ? box(chosen) : { x: 100, y: 100, w: 200, h: 150 };
  const units = [
    { value: "", label: "Unlinked" },
    ...d.units
      .filter(
        (u) =>
          (u.blockId ?? "") === block && (u.floor == null || u.floor === floor),
      )
      .map((u) => ({ value: u.id, label: u.label })),
  ];
  const submit = (shapes: Shape[]) =>
    save("layouts", {
      floor,
      blockId: block || null,
      name: layout?.name ?? (floor === 0 ? "Ground floor" : `Floor ${floor}`),
      shapes,
      revision: layout?.revision ?? 0,
    });
  return (
    <>
      <Card>
        <Text style={s.h3}>Building sketch</Text>
        <Text style={s.small}>
          Sketch rectangular spaces on a 1,000 × 600 grid. Published spaces are
          visible to users. The full polygon and 3D editor is also available in
          the web portal.
        </Text>
        <Chips
          options={[
            { value: "", label: "Previous plans" },
            ...(d.blocks ?? []).map((b) => ({ value: b.id, label: b.name })),
          ]}
          value={block}
          onChange={(v) => {
            setBlock(v);
            setFloor(
              d.layouts.find((l) => (l.blockId ?? "") === v)?.floor ?? 0,
            );
            setSelected("");
          }}
        />
        <Chips
          options={scopedLayouts.map((l) => ({
            value: String(l.floor),
            label: l.name,
          }))}
          value={String(floor)}
          onChange={(v) => {
            setFloor(Number(v));
            setSelected("");
          }}
        />
        <Form
          title="Open or add floor"
          busy={busy}
          fields={[
            {
              name: "floor",
              label: "Floor number (−5 to 150)",
              number: true,
              value: String(floor),
            },
          ]}
          save={async (v) => {
            const f = Number(v.floor);
            if (!Number.isInteger(f) || f < -5 || f > 150)
              throw new Error(
                "Choose a whole floor number between −5 and 150.",
              );
            setFloor(f);
            setSelected("");
            return true;
          }}
        />
        <Text style={s.h3}>{layout?.name ?? `Floor ${floor}`}</Text>
        <View
          style={{
            width: "100%",
            aspectRatio: 1000 / 600,
            backgroundColor: "#F2F6F3",
            borderWidth: 1,
            borderColor: "#D7E2DA",
          }}
        >
          {(layout?.shapes ?? []).map((shape) => {
            const b = box(shape);
            return (
              <Pressable
                key={shape.id}
                accessibilityRole="button"
                accessibilityLabel={shape.label}
                onPress={() => setSelected(shape.id)}
                style={{
                  position: "absolute",
                  left: `${b.x / 10}%`,
                  top: `${b.y / 6}%`,
                  width: `${b.w / 10}%`,
                  height: `${b.h / 6}%`,
                  borderWidth: shape.id === selected ? 3 : 1,
                  borderColor: shape.id === selected ? "#164C3E" : "#739A82",
                  backgroundColor:
                    shape.kind === "outline"
                      ? "transparent"
                      : color(shape.kind),
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{ fontSize: 10, color: "#164C3E" }}
                >
                  {shape.kind === "outline" ? "" : shape.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={s.small}>
          Rectangle preview; polygon boundaries are shown by their bounding
          boxes.
        </Text>
        <Form
          key={selected || "new"}
          title={chosen ? "Edit selected space" : "Add rectangular space"}
          busy={busy}
          fields={[
            { name: "label", label: "Space label", value: chosen?.label ?? "" },
            {
              name: "kind",
              label: "Space type",
              options: [
                "outline",
                "flat",
                "shop",
                "common",
                "stairs",
                "lift",
              ].map((value) => ({ value, label: value })),
              value: chosen?.kind ?? "flat",
            },
            {
              name: "unitId",
              label: "Link registered unit (flats or shops)",
              options: units,
              value: chosen?.unitId ?? "",
            },
            {
              name: "x",
              label: "X position",
              number: true,
              value: String(bounds.x),
            },
            {
              name: "y",
              label: "Y position",
              number: true,
              value: String(bounds.y),
            },
            {
              name: "width",
              label: "Width",
              number: true,
              value: String(bounds.w),
            },
            {
              name: "height",
              label: "Height",
              number: true,
              value: String(bounds.h),
            },
          ]}
          save={(v) => {
            const x = Number(v.x),
              y = Number(v.y),
              w = Number(v.width),
              h = Number(v.height);
            const shape: Shape = {
              id: chosen?.id ?? v.submissionId!,
              kind: v.kind ?? "flat",
              label: v.label ?? "",
              unitId: v.unitId || null,
              points: [
                { x, y },
                { x: x + w, y },
                { x: x + w, y: y + h },
                { x, y: y + h },
              ],
            };
            return submit([
              ...(layout?.shapes ?? []).filter((s) => s.id !== shape.id),
              shape,
            ]);
          }}
        />
        {chosen && (
          <>
            <Button
              label="Add another space"
              variant="secondary"
              onPress={() => setSelected("")}
            />
            <Button
              label="Remove selected space from draft"
              variant="secondary"
              disabled={busy}
              onPress={() =>
                void submit(
                  (layout?.shapes ?? []).filter((s) => s.id !== selected),
                ).then((ok) => {
                  if (ok) setSelected("");
                })
              }
            />
          </>
        )}
        <Text style={s.small}>
          {layout?.publishedAt
            ? "Last published " + new Date(layout.publishedAt).toLocaleString()
            : "Draft"}{" "}
          · Revision {layout?.revision ?? 0}
        </Text>
        <Button
          label="Publish floor"
          disabled={busy || !layout?.shapes.length}
          onPress={() =>
            layout &&
            void save(`layouts/${layout.id}/actions`, {
              action: "publish",
              revision: layout.revision,
            })
          }
        />
        {layout && (
          <>
            <Form
              title="Rename floor"
              busy={busy}
              fields={[
                { name: "name", label: "Floor name", value: layout.name },
              ]}
              save={(v) =>
                save("layouts", {
                  floor,
                  name: v.name,
                  shapes: layout.shapes,
                  revision: layout.revision,
                })
              }
            />
            <Form
              title="Copy to another floor"
              busy={busy}
              fields={[
                {
                  name: "floor",
                  label: "Target floor",
                  number: true,
                  value: String(floor + 1),
                },
              ]}
              save={(v) => {
                const target = Number(v.floor);
                if (d.layouts.some((l) => l.floor === target))
                  return Promise.reject(
                    new Error("That floor already exists."),
                  );
                return save("layouts", {
                  floor: target,
                  name: `Floor ${target}`,
                  revision: 0,
                  shapes: layout.shapes.map((shape) => ({
                    ...shape,
                    id: Crypto.randomUUID(),
                    unitId: null,
                  })),
                });
              }}
            />
          </>
        )}
        {!layout?.shapes.length && (
          <Empty
            title="Start sketching"
            detail="Add an outline, then flats, shops and shared areas."
          />
        )}
      </Card>
    </>
  );
}
