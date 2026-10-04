import { useState } from "react";
import { Text, View } from "react-native";
import * as Crypto from "expo-crypto";
import { Button, Chips, Field, Notice, s } from "../components/ui";
export type Values = Record<string, string>;
export interface Input {
  name: string;
  label: string;
  value?: string;
  options?: { value: string; label: string }[];
  number?: boolean;
  multiline?: boolean;
  multiple?: boolean;
  hint?: string;
}
export type Save = (
  path: string,
  body: unknown,
  method?: string,
) => Promise<boolean>;
export function Form({
  title,
  fields,
  save,
  busy,
}: {
  title: string;
  fields: Input[];
  save: (v: Values) => Promise<boolean>;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [values, setValues] = useState<Values>(() =>
    Object.fromEntries(fields.map((f) => [f.name, f.value ?? ""])),
  );
  const [submission, setSubmission] = useState(() => Crypto.randomUUID());
  const submit = async () => {
    setError("");
    try {
      if (await save({ ...values, submissionId: submission })) {
        setOpen(false);
        setSubmission(Crypto.randomUUID());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    }
  };
  return (
    <View style={{ gap: 12 }}>
      <Button
        label={open ? "Close form" : title}
        variant="secondary"
        onPress={() => {
          setError("");
          if (!open)
            setValues(
              Object.fromEntries(fields.map((f) => [f.name, f.value ?? ""])),
            );
          setOpen(!open);
        }}
      />
      {error && <Notice message={error} danger />}
      {open && (
        <View style={{ gap: 16 }}>
          {fields.map((f) =>
            f.options ? (
              <View key={f.name} style={{ gap: 8 }}>
                <Text style={s.label}>{f.label}</Text>
                {f.multiple ? (
                  <View
                    style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                  >
                    {f.options.map((option) => (
                      <Button
                        key={option.value}
                        label={option.label}
                        variant={
                          (values[f.name] ?? "")
                            .split(",")
                            .includes(option.value)
                            ? "primary"
                            : "secondary"
                        }
                        onPress={() =>
                          setValues((old) => {
                            const selected = new Set(
                              (old[f.name] ?? "").split(",").filter(Boolean),
                            );
                            selected.has(option.value)
                              ? selected.delete(option.value)
                              : selected.add(option.value);
                            return {
                              ...old,
                              [f.name]: [...selected].join(","),
                            };
                          })
                        }
                      />
                    ))}
                  </View>
                ) : (
                  <Chips
                    options={f.options}
                    value={values[f.name] ?? ""}
                    onChange={(v) =>
                      setValues((old) => ({ ...old, [f.name]: v }))
                    }
                  />
                )}
              </View>
            ) : (
              <Field
                key={f.name}
                label={f.label}
                hint={f.hint}
                value={values[f.name]}
                keyboardType={f.number ? "decimal-pad" : "default"}
                multiline={f.multiline}
                autoCapitalize="none"
                onChangeText={(v) =>
                  setValues((old) => ({ ...old, [f.name]: v }))
                }
              />
            ),
          )}
          <Button label="Save" loading={busy} onPress={() => void submit()} />
        </View>
      )}
    </View>
  );
}
