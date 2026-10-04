import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Button, Pill } from "../../components/common";
import type { CommunityData, Row } from "../../../../../shared/community";
export type Mutate = (
  path: string,
  body: unknown,
  method?: string,
) => Promise<boolean>;
export interface ModuleProps {
  data: CommunityData;
  role: string;
  mutate: Mutate;
  busy: boolean;
}
export interface FieldSpec {
  name: string;
  label: string;
  type?: string;
  options?: { id: string; name: string }[];
  value?: string | number;
  optional?: boolean;
  multiple?: boolean;
  hint?: string;
  min?: number;
  max?: number;
}
export type Values = Record<string, string | number | string[]>;
export const opts = (...values: string[]) =>
  values.map((id) => ({ id, name: id.replaceAll("_", " ") }));
export const unitOptions = (d: CommunityData) =>
  d.units.map((u) => ({ id: u.id, name: u.label }));
export const partyOptions = (d: CommunityData) =>
  d.parties.map((p) => ({ id: p.id, name: p.name }));
export const unitName = (d: CommunityData, id?: string) =>
  d.units.find((u) => u.id === id)?.label ?? "Building";
export const partyName = (d: CommunityData, id?: string) =>
  d.parties.find((p) => p.id === id)?.name ?? "Account";
export const amount = (value: number, currency: string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(value);
export { propertyDateInput as today } from "../operations";
export const iso = (value: unknown) => new Date(String(value)).toISOString();
export function Card({
  title,
  children,
  detail,
}: {
  title: string;
  children: ReactNode;
  detail?: string;
}) {
  return (
    <section className="community-card">
      <h2>{title}</h2>
      {detail && <p className="community-muted">{detail}</p>}
      {children}
    </section>
  );
}
export function Status({ value }: { value: string }) {
  return (
    <Pill
      tone={
        [
          "approved",
          "confirmed",
          "verified",
          "ready",
          "received",
          "paid",
          "done",
        ].includes(value)
          ? "green"
          : ["pending", "unpaid", "refund_due"].includes(value)
            ? "gold"
            : "neutral"
      }
    >
      {value.replaceAll("_", " ")}
    </Pill>
  );
}
export function Action({
  path,
  row,
  action,
  label,
  mutate,
  busy,
}: {
  path: string;
  row: Row;
  action: string;
  label: string;
  mutate: Mutate;
  busy: boolean;
}) {
  return (
    <Button
      variant="secondary"
      disabled={busy}
      onClick={() =>
        void mutate(`${path}/${row.id}/actions`, {
          action,
          revision: row.revision,
        })
      }
    >
      {label}
    </Button>
  );
}
export function Form({
  title,
  fields,
  onSubmit,
  busy,
  submit = "Save",
  children,
}: {
  title: string;
  fields: FieldSpec[];
  onSubmit: (v: Values) => Promise<boolean>;
  busy: boolean;
  submit?: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const formId = useId();
  const [submission, setSubmission] = useState(() => crypto.randomUUID());
  const send = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const input = new FormData(form);
    const values: Values = { __submissionId: submission };
    for (const field of fields)
      values[field.name] = field.multiple
        ? input.getAll(field.name).map(String)
        : field.type === "number"
          ? Number(input.get(field.name))
          : String(input.get(field.name) ?? "");
    if (await onSubmit(values)) {
      form.reset();
      setOpen(false);
      setSubmission(crypto.randomUUID());
    }
  };
  return (
    <div className="community-form-wrap">
      <Button
        variant="secondary"
        disabled={busy}
        aria-expanded={open}
        aria-controls={formId}
        onClick={() => setOpen(!open)}
      >
        {open ? "Close" : "+ " + title}
      </Button>
      {open && (
        <form
          id={formId}
          className="community-form"
          onSubmit={(event) => void send(event)}
        >
          <h3>{title}</h3>
          <div className="community-fields">
            {fields.map((field) => (
              <label key={field.name}>
                {field.label}
                {field.options ? (
                  <select
                    name={field.name}
                    required={!field.optional}
                    multiple={field.multiple}
                    defaultValue={field.multiple ? [] : (field.value ?? "")}
                  >
                    {!field.multiple && <option value="">Choose…</option>}
                    {field.options.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                ) : field.type === "textarea" ? (
                  <textarea
                    name={field.name}
                    required={!field.optional}
                    defaultValue={field.value ?? ""}
                    maxLength={2000}
                  />
                ) : (
                  <input
                    name={field.name}
                    type={field.type ?? "text"}
                    required={!field.optional}
                    defaultValue={field.value ?? ""}
                    min={field.min ?? (field.type === "number" ? 0 : undefined)}
                    max={field.max}
                    step={
                      field.type === "number"
                        ? [
                            "floor",
                            "units",
                            "packages",
                            "capacity",
                            "slotMinutes",
                            "stock",
                            "quantity",
                          ].includes(field.name)
                          ? 1
                          : "0.01"
                        : undefined
                    }
                    maxLength={
                      field.type === "text" || !field.type ? 300 : undefined
                    }
                  />
                )}{" "}
                {field.hint && <small>{field.hint}</small>}
              </label>
            ))}
          </div>
          {children}
          <div className="community-actions">
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : submit}
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
export function None({
  children = "No records yet.",
}: {
  children?: ReactNode;
}) {
  return <p className="community-muted">{children}</p>;
}
