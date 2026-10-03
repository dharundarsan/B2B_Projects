import { useCallback, useRef, useState } from "react";
import { api } from "../api";
import { useApiResource } from "../hooks/useApiResource";
import { Button, EmptyState, ErrorNotice, LoadingState, Pill } from "../components/common";
import "./common-areas.css";
import type { CommonAreaRecord } from "../types";

export function CommonAreaSection({ propertyId }: { propertyId: string }) {
  const resource = useApiResource(useCallback((signal) => api.commonAreaIssues(signal), []), [] as CommonAreaRecord[]);
  const [selected, setSelected] = useState(""); const [status, setStatus] = useState<"in_progress" | "resolved">("in_progress");
  const [note, setNote] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const lock = useRef(false);
  const reports = resource.data.filter(issue => issue.propertyId === propertyId).sort((a, b) => Number(a.status === "resolved") - Number(b.status === "resolved") || b.createdAt.localeCompare(a.createdAt));
  const update = async (issue: CommonAreaRecord) => {
    if (lock.current || note.trim().length < 3) return; lock.current = true; setBusy(true); setError("");
    try { const result = await api.updateCommonAreaIssue(issue.id, { status, note: note.trim(), revision: issue.revision }); resource.setData(values => values.map(value => value.id === issue.id ? result.data : value)); setSelected(""); setNote(""); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not update the report."); resource.refresh(); }
    finally { lock.current = false; setBusy(false); }
  };
  return <section className="surface detail-panel common-area-section" aria-labelledby="common-area-title">
    <div className="section-title"><div><span className="label">APARTMENT APP</span><h3 id="common-area-title">Shared-area maintenance</h3></div><Button variant="secondary" disabled={resource.loading || busy} onClick={resource.refresh}>Refresh</Button></div>
    <p className="muted">Reports from residents and watchmen. Updates here are visible to assigned building users; keep them free of private resident or access details.</p>
    {resource.error || error ? <ErrorNotice message={error || resource.error} onRetry={() => { setError(""); resource.refresh(); }} /> : null}
    {resource.loading && !reports.length ? <LoadingState label="Loading shared-area reports…" /> : null}
    {!resource.loading && !resource.error && !reports.length ? <EmptyState title="No shared-area reports" detail="Issues reported from the mobile app will appear here." /> : null}
    <div className="common-area-list">{reports.map(issue => <article key={issue.id} className="common-area-card">
      <div className="section-title"><h4>{issue.title}</h4><Pill tone={issue.status === "resolved" ? "green" : issue.priority === "urgent" ? "urgent" : "neutral"}>{issue.status.replaceAll("_", " ")}{issue.priority === "urgent" ? " · urgent" : ""}</Pill></div>
      <p className="muted">{issue.location} · {issue.category}</p><p>{issue.description}</p>
      {issue.resolutionNote ? <div className="common-area-update"><strong>Latest public update</strong><p>{issue.resolutionNote}</p></div> : null}
      {issue.status !== "resolved" ? selected === issue.id ? <form className="common-area-form" onSubmit={event => { event.preventDefault(); void update(issue); }}>
        <label>Status<select value={status} disabled={busy} onChange={event => setStatus(event.target.value as "in_progress" | "resolved")}><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select></label>
        <label>Public update<textarea value={note} disabled={busy} onChange={event => setNote(event.target.value)} required minLength={3} maxLength={1000} placeholder="Explain the next step or how this was fixed." /></label>
        <div className="common-area-actions"><Button type="submit" disabled={busy || note.trim().length < 3}>{busy ? "Saving…" : "Publish update"}</Button><Button variant="secondary" disabled={busy} onClick={() => setSelected("")}>Cancel</Button></div>
      </form> : <Button variant="secondary" disabled={busy} onClick={() => { setSelected(issue.id); setStatus("in_progress"); setNote(""); }}>Update report</Button> : null}
    </article>)}</div>
  </section>;
}
