import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  MapPin,
  ShieldCheck,
  UserRound,
  Wrench,
} from "lucide-react";
import type { AppointmentRecord, RequestRecord } from "../types";
import {
  ageLabel,
  displayId,
  formatDate,
  nextStep,
  repairStages,
  stageFor,
  requestStatusLabel,
  visitConfirmation,
} from "./operations";

export function RequestStatus({ request }: { request: RequestRecord }) {
  return (
    <span
      className={`status-chip status-${stageFor(request)} state-${request.state}`}
    >
      <span aria-hidden="true" />
      {requestStatusLabel(request)}
    </span>
  );
}

export function RequestCard({
  request,
  compact = false,
  to,
}: {
  request: RequestRecord;
  compact?: boolean;
  to?: string;
}) {
  const step = nextStep(request);
  return (
    <Link
      to={to ?? step.href}
      className={`repair-scan-card ${compact ? "compact" : ""}`}
      aria-label={`${request.id}: ${request.title}. ${step.owner}: ${step.title}`}
    >
      <div className="scan-card-top">
        <span className="record-id" title={request.id}>
          {displayId(request.id)}
        </span>
        {request.priority === "urgent" ? (
          <span className="priority-chip">Urgent</span>
        ) : null}
        <RequestStatus request={request} />
      </div>
      <h3>{request.title}</h3>
      <div className="scan-location">
        <MapPin size={13} aria-hidden="true" />
        {request.property} · Unit {request.unit}
      </div>
      <div className="scan-vendor">
        <Wrench size={13} aria-hidden="true" />
        {request.assignedVendorName ?? "No vendor assigned"}
      </div>
      <div className="scan-next">
        <div>
          <span>
            {step.owner === "None" ? "Outcome" : `${step.owner} · next action`}
          </span>
          <strong>{step.title}</strong>
        </div>
        <ArrowRight size={16} aria-hidden="true" />
      </div>
      <div className="scan-age">
        <Clock3 size={12} aria-hidden="true" />
        {ageLabel(request.createdAt).replace(
          "open since report",
          "since report",
        )}
      </div>
    </Link>
  );
}

export function RequestBoard({ items }: { items: RequestRecord[] }) {
  return (
    <div className="repair-board" aria-label="Repair workflow board">
      {repairStages.map((stage) => {
        const records = items.filter((item) => stageFor(item) === stage.id);
        return (
          <section
            className={`board-column stage-${stage.id}`}
            key={stage.id}
            aria-label={stage.label}
          >
            <header>
              <h3>
                <span className="stage-dot" aria-hidden="true" />
                {stage.label}
              </h3>
              <span className="board-count">{records.length}</span>
            </header>
            <p>{stage.description}</p>
            <div className="board-items">
              {records.length ? (
                records.map((item) => (
                  <RequestCard request={item} compact key={item.id} />
                ))
              ) : (
                <div className="board-empty">No repairs here</div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function RepairProgress({ request }: { request: RequestRecord }) {
  const stage = stageFor(request);
  const current = repairStages.findIndex((item) => item.id === stage);
  const unverifiedClosure =
    request.state === "closed" &&
    request.residentVerification?.status !== "verified";
  if (request.state === "cancelled")
    return (
      <div className="repair-progress cancelled">
        <ShieldCheck size={17} />
        Request cancelled · history retained
      </div>
    );
  return (
    <ol className="repair-progress" aria-label="Repair lifecycle">
      {repairStages.map((item, index) => (
        <li
          key={item.id}
          className={
            unverifiedClosure && item.id === "verification"
              ? "unverified"
              : index < current
                ? "done"
                : index === current
                  ? "current"
                  : ""
          }
          aria-current={index === current ? "step" : undefined}
        >
          <span className="progress-number">
            {unverifiedClosure && item.id === "verification" ? (
              "!"
            ) : index < current ? (
              <Check size={12} />
            ) : (
              index + 1
            )}
          </span>
          <span>
            {unverifiedClosure && item.id === "verification"
              ? "Not verified"
              : item.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function VisitConfirmation({
  appointment,
}: {
  appointment: AppointmentRecord;
}) {
  const confirmation = visitConfirmation(appointment);
  return (
    <section
      className={`visit-confirmation ${confirmation.tone}`}
      aria-label="Visit confirmation details"
    >
      <div className="visit-confirmation-heading">
        <CalendarDays size={20} />
        <div>
          <span className="label">{confirmation.label}</span>
          <strong>
            {formatDate(appointment.startsAt, appointment.timezone)}
          </strong>
          <span>{appointment.timezone} · property time</span>
        </div>
      </div>
      <p>{confirmation.summary}</p>
      {appointment.status !== "cancelled" ? (
        <div className="confirmation-parties">
          <div>
            <UserRound size={16} />
            <span>Resident</span>
            <strong>{confirmation.resident}</strong>
          </div>
          <div>
            <Wrench size={16} />
            <span>Vendor</span>
            <strong>{confirmation.vendor}</strong>
          </div>
        </div>
      ) : null}
    </section>
  );
}
