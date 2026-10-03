import { useRef, useState, type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";
import { api } from "../api";
import { Button } from "../components/common";
import type { RequestDetail } from "../types";
import { residentLinkPayload } from "./residentPrivacy";
import "./resident-privacy.css";

export function ResidentLinkPanel({ repair, onLinked }: { repair: RequestDetail; onLinked: (value: RequestDetail) => void }) {
  const [editing, setEditing] = useState(false);
  const [userId, setUserId] = useState(""); const [occupancyId, setOccupancyId] = useState("");
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const save = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setSaving(true);
    try {
      const payload = residentLinkPayload(true, userId, occupancyId);
      const { data } = await api.linkResident(repair.id, payload, repair.revision ?? 0);
      onLinked(data); setEditing(false); setUserId(""); setOccupancyId("");
      requestAnimationFrame(() => heading.current?.focus());
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Resident access could not be linked. Refresh before retrying."); }
    finally { setSaving(false); }
  };
  return <section className="surface resident-access-panel" aria-label="Resident history privacy">
    <div className="resident-access-heading"><ShieldCheck size={21} aria-hidden="true" /><div><h3 ref={heading} tabIndex={-1}>{repair.residentLinked ? "Account-specific resident history" : "Resident portal not linked"}</h3>
      <p>{repair.residentLinked ? "This repair is bound to one account and occupancy. Residents still need a current, dated assignment; managers retain the history." : "Only managers and an assigned vendor can access this repair. A matching apartment label or resident name does not grant portal access."}</p></div></div>
    {!repair.residentLinked && !editing ? <button ref={trigger} type="button" className="button secondary" onClick={() => { setError(""); setEditing(true); }}>Link provisioned resident</button> : null}
    {!repair.residentLinked && editing ? <form onSubmit={save}>
      <p id="resident-link-help">Copy both UUIDs from the resident's provisioned Supabase account. Its occupancy must cover this repair's report date. Linking does not create an account or grant building permissions, and an existing link cannot be transferred.</p>
      <fieldset disabled={saving}><div className="form-grid two">
        <label>Resident account UUID<input autoFocus required maxLength={36} autoComplete="off" aria-describedby="resident-link-help" value={userId} onChange={event => setUserId(event.target.value)} /></label>
        <label>Occupancy UUID<input required maxLength={36} autoComplete="off" aria-describedby="resident-link-help" value={occupancyId} onChange={event => setOccupancyId(event.target.value)} /></label>
      </div><div className="drawer-actions"><Button type="button" variant="secondary" onClick={() => { setEditing(false); setError(""); requestAnimationFrame(() => trigger.current?.focus()); }}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Linking…" : "Link resident access"}</Button></div></fieldset>
      {error ? <p className="notice danger" role="alert">{error}</p> : null}
    </form> : null}
  </section>;
}
