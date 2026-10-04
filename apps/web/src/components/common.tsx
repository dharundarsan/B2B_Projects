import type { ReactNode, ButtonHTMLAttributes } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Check,
  ClipboardList,
  RefreshCw,
} from "lucide-react";
import type { RequestDetail, RequestRecord } from "../types";
import { formatDate } from "../features/operations";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {description ? <p className="page-description">{description}</p> : null}
      </div>
      {action ? <div className="header-action">{action}</div> : null}
    </div>
  );
}
export function Button({children,variant="primary",type="button",className="",...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:"primary"|"secondary"|"ghost"|"danger"}) {
  return <button {...props} type={type} className={`button ${variant} ${className}`}>{children}</button>;
}
export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "urgent" | "lime" | "gold" | "green";
}) {
  return <span className={`pill ${tone}`}>{children}</span>;
}
export function StatCard({
  label,
  value,
  detail,
  tone,
  to,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "urgent" | "lime";
  to?: string;
  icon?: ReactNode;
}) {
  const card = (
    <div className={`stat-card ${tone ?? ""}`}>
      <div className="stat-heading">
        <span>{label}</span>
        {icon}
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
  return to ? <Link to={to}>{card}</Link> : card;
}
export function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="fact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
export function LoadingState({
  label = "Loading workspace…",
}: {
  label?: string;
}) {
  return (
    <div className="surface loading-state" role="status" aria-live="polite">
      <RefreshCw size={17} className="spin" />
      <span>{label}</span>
    </div>
  );
}
export function ErrorNotice({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="notice danger" role="alert">
      <AlertCircle size={18} />
      <div>
        <strong>Something needs attention</strong>
        <span>{message}</span>
      </div>
      <button className="button secondary" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
export function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="success-mark">
        <ClipboardList size={20} />
      </div>
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
  );
}
export function Timeline({ events }: { events: RequestDetail["events"] }) {
  return (
    <div className="timeline">
      {(events ?? []).map((event, index) => (
        <div className="timeline-event" key={event.id}>
          <div
            className={`timeline-marker ${index === (events?.length ?? 1) - 1 ? "current" : ""}`}
          >
            {index === (events?.length ?? 1) - 1 ? (
              <span />
            ) : (
              <Check size={12} />
            )}
          </div>
          <div>
            <strong>{event.label}</strong>
            <span>{event.detail}</span>
            {event.actor ? <small>{event.actor}</small> : null}
          </div>
          <time dateTime={event.at}>
            {Number.isFinite(Date.parse(event.at))
              ? formatDate(event.at)
              : event.at}
          </time>
        </div>
      ))}
    </div>
  );
}
export function ActionRow({ request }: { request: RequestRecord }) {
  return (
    <Link to={`/requests/${request.id}`} className="action-row">
      <div className={`priority-bar ${request.priority}`} />
      <div className="action-main">
        <div>
          <Pill tone={request.priority === "urgent" ? "urgent" : "gold"}>
            {request.priority === "urgent" ? "Urgent" : "Action"}
          </Pill>
          <span className="request-meta">
            {request.id} · {request.property} {request.unit}
          </span>
        </div>
        <strong>{request.title}</strong>
      </div>
      <div className="action-deadline">
        <strong>{request.dueLabel}</strong>
        <span>
          {request.nextAction} <ArrowRight size={14} />
        </span>
      </div>
    </Link>
  );
}
