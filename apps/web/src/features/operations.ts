import type { AppointmentRecord, RequestRecord, RequestState } from "../types";

export type AttentionAction =
  | "acknowledge"
  | "assign"
  | "review_quote"
  | "schedule";
export type RequestFilter =
  | "all"
  | "open"
  | "urgent"
  | "awaiting"
  | "waiting"
  | "scheduled"
  | "today"
  | "verification"
  | "completed";
export type RequestSort = "attention" | "oldest" | "newest" | "property";
export type RepairStage =
  | "reported"
  | "coordination"
  | "work"
  | "verification"
  | "closed";

export const requestFilters: { id: RequestFilter; label: string }[] = [
  { id: "all", label: "All requests" },
  { id: "open", label: "Open" },
  { id: "awaiting", label: "Needs my decision" },
  { id: "urgent", label: "Urgent" },
  { id: "scheduled", label: "Visits & work" },
  { id: "today", label: "Visits today" },
  { id: "verification", label: "Needs verification" },
  { id: "completed", label: "Closed" },
];

export const repairStages: {
  id: RepairStage;
  label: string;
  description: string;
}[] = [
  {
    id: "reported",
    label: "Reported",
    description: "New reports to acknowledge",
  },
  {
    id: "coordination",
    label: "Coordinating",
    description: "Vendor, quote & availability",
  },
  {
    id: "work",
    label: "Visit & repair",
    description: "Proposed visits, confirmed visits & work",
  },
  {
    id: "verification",
    label: "Verify outcome",
    description: "Completion is not closure",
  },
  { id: "closed", label: "Closed", description: "Resolved or cancelled" },
];

/** Keep policy in sync with the API's RepairAttentionHelper; neither text labels nor urgency grant permissions. */
export function managerAction(request: RequestRecord): AttentionAction | null {
  if (
    ![
      "submitted",
      "urgent",
      "acknowledged",
      "assigned",
      "waiting",
      "approved",
      "scheduled",
    ].includes(request.state)
  )
    return null;
  if (request.state === "submitted" || request.state === "urgent")
    return "acknowledge";
  if (request.vendorDecision === "pending") return null;
  if (request.vendorDecision === "accepted") {
    if (request.estimate?.status === "submitted") return "review_quote";
    if (
      request.estimate?.status === "approved" &&
      (!request.appointment || request.appointment.status === "cancelled")
    )
      return "schedule";
    return null;
  }
  if (
    !request.estimate &&
    (request.state === "acknowledged" ||
      (request.state === "assigned" && !request.assignedVendorId) ||
      request.vendorDecision === "declined")
  )
    return "assign";
  return null;
}

export function isOpen(request: RequestRecord) {
  return request.state !== "closed" && request.state !== "cancelled";
}

export function residentAction(
  request: RequestRecord,
): "verify" | "confirm_visit" | null {
  if (!isOpen(request)) return null;
  // The API accepts resident verification only after the manager/vendor publishes that state.
  if (request.state === "verification") return "verify";
  if (
    request.appointment?.status === "proposed" &&
    !request.appointment.residentConfirmedAt
  )
    return "confirm_visit";
  return null;
}

export function displayId(id: string) {
  return id.length > 18 ? `${id.slice(0, 11)}…${id.slice(-4)}` : id;
}

export function matchesFilter(
  request: RequestRecord,
  filter: string,
  now = new Date(),
) {
  switch (filter) {
    case "open":
      return isOpen(request);
    case "urgent":
      return isOpen(request) && request.priority === "urgent";
    case "awaiting":
      return managerAction(request) !== null;
    case "waiting":
      return request.state === "waiting";
    case "scheduled":
      return request.state === "scheduled" || request.state === "in_progress";
    case "today": {
      if (
        !request.appointment ||
        request.appointment.status !== "confirmed" ||
        !["scheduled", "in_progress"].includes(request.state)
      )
        return false;
      const startsAt = timestamp(request.appointment.startsAt);
      if (startsAt === null) return false;
      try {
        const formatter = new Intl.DateTimeFormat("en-CA", {
          timeZone: request.appointment.timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        });
        return formatter.format(new Date(startsAt)) === formatter.format(now);
      } catch {
        return false;
      }
    }
    case "verification":
      return request.state === "completed" || request.state === "verification";
    case "completed":
      return request.state === "closed";
    default:
      return true;
  }
}

export function stageFor(request: RequestRecord): RepairStage {
  if (request.state === "closed" || request.state === "cancelled")
    return "closed";
  if (["completed", "verification", "invoice_review"].includes(request.state))
    return "verification";
  if (request.state === "scheduled" || request.state === "in_progress")
    return "work";
  if (["draft", "submitted", "urgent"].includes(request.state))
    return "reported";
  return "coordination";
}

const stateLabels: Record<RequestState, string> = {
  draft: "Draft",
  submitted: "Reported",
  urgent: "Reported",
  acknowledged: "Acknowledged",
  assigned: "Vendor assigned",
  waiting: "Waiting for resident",
  scheduled: "Visit scheduling",
  approved: "Quote approved",
  in_progress: "Work in progress",
  completed: "Work completed",
  verification: "Resident verification",
  invoice_review: "Invoice review",
  closed: "Closed",
  cancelled: "Cancelled",
};
export function stateLabel(state: RequestState) {
  return stateLabels[state] ?? state;
}

export function requestStatusLabel(request: RequestRecord) {
  if (request.state === "scheduled") {
    return request.appointment?.status === "confirmed"
      ? "Visit confirmed"
      : request.appointment?.status === "proposed"
        ? "Visit proposed"
        : "Visit scheduling";
  }
  return stateLabel(request.state);
}

export type NextStep = {
  owner: "Manager" | "Vendor" | "Resident" | "Resident & vendor" | "None";
  title: string;
  detail: string;
  href: string;
};
export function nextStep(request: RequestRecord): NextStep {
  const base = `/requests/${encodeURIComponent(request.id)}`;
  const action = managerAction(request);
  if (action === "acknowledge")
    return {
      owner: "Manager",
      title: "Review new report",
      detail: "Acknowledge the issue and check safety and access details.",
      href: base,
    };
  if (action === "assign")
    return {
      owner: "Manager",
      title:
        request.vendorDecision === "declined"
          ? "Find another vendor"
          : "Choose a vendor",
      detail: "Offer the job to a suitable vendor. An offer is not acceptance.",
      href: `/vendors?request=${encodeURIComponent(request.id)}`,
    };
  if (action === "review_quote")
    return {
      owner: "Manager",
      title: "Review vendor quote",
      detail: "Check the scope and amount before authorizing work.",
      href: `${base}?tab=costs`,
    };
  if (action === "schedule")
    return {
      owner: "Manager",
      title:
        request.appointment?.status === "cancelled"
          ? "Propose another visit"
          : "Propose a visit",
      detail: "Both the resident and vendor must confirm the proposed time.",
      href: `${base}?tab=visits`,
    };
  if (request.state === "closed" || request.state === "cancelled")
    return {
      owner: "None",
      title:
        request.state === "closed"
          ? "Repair record complete"
          : "Request cancelled",
      detail:
        request.residentVerification?.status === "verified"
          ? "The resident confirmed the problem is fixed."
          : "The history remains available. Closure alone does not prove resident verification.",
      href: `${base}?tab=audit`,
    };
  if (request.state === "completed")
    return {
      owner: "Manager",
      title: "Prepare resident verification",
      detail:
        "This legacy completed record must move to resident verification before a resident can respond. Use Update status on the repair record.",
      href: base,
    };
  if (request.state === "verification")
    return {
      owner: "Resident",
      title: "Confirm the repair worked",
      detail:
        "Vendor completion is recorded. The resident still needs to verify the outcome.",
      href: `${base}?tab=messages`,
    };
  if (request.state === "waiting")
    return {
      owner: "Resident",
      title: "Waiting for more information",
      detail: "Review the conversation for the information needed to continue.",
      href: `${base}?tab=messages`,
    };
  if (request.state === "in_progress")
    return {
      owner: "Vendor",
      title:
        request.residentVerification?.status === "unresolved"
          ? "Follow up on the unresolved issue"
          : "Complete the approved work",
      detail: "Keep evidence and progress on the repair record.",
      href: `${base}?tab=work-orders`,
    };
  if (request.appointment?.status === "proposed") {
    const residentPending = !request.appointment.residentConfirmedAt;
    const vendorPending = !request.appointment.vendorConfirmedAt;
    return {
      owner: residentPending
        ? vendorPending
          ? "Resident & vendor"
          : "Resident"
        : vendorPending
          ? "Vendor"
          : "None",
      title:
        residentPending || vendorPending
          ? "Confirm the proposed visit"
          : "Refresh visit confirmation",
      detail: visitConfirmation(request.appointment).summary,
      href: `${base}?tab=visits`,
    };
  }
  if (request.appointment?.status === "confirmed")
    return {
      owner: "Vendor",
      title: "Attend the confirmed visit",
      detail:
        "The resident and vendor confirmed this time. Review access instructions.",
      href: `${base}?tab=visits`,
    };
  if (request.vendorDecision === "pending")
    return {
      owner: "Vendor",
      title: "Respond to the job offer",
      detail: "The assigned vendor has not accepted the job yet.",
      href: `${base}?tab=work-orders`,
    };
  if (request.vendorDecision === "accepted")
    return {
      owner: "Vendor",
      title:
        request.estimate?.status === "changes_requested"
          ? "Revise the quote"
          : "Submit a quote",
      detail: "Work cannot start until its scope and quote are approved.",
      href: `${base}?tab=costs`,
    };
  return {
    owner: "Manager",
    title: request.nextAction || "Review repair",
    detail: "Open the record for workflow details.",
    href: base,
  };
}

export function visitConfirmation(appointment: AppointmentRecord) {
  if (appointment.status === "cancelled")
    return {
      label: "Visit declined",
      summary: "This time is no longer booked. A new proposal is needed.",
      resident: "Previous response",
      vendor: "Previous response",
      tone: "cancelled",
    };
  if (appointment.status === "confirmed")
    return {
      label: "Visit confirmed",
      summary: "Both parties confirmed this visit.",
      resident: "Confirmed",
      vendor: "Confirmed",
      tone: "confirmed",
    };
  const pending = [
    !appointment.residentConfirmedAt && "resident",
    !appointment.vendorConfirmedAt && "vendor",
  ].filter(Boolean);
  return {
    label: "Proposed · not booked",
    summary: pending.length
      ? `Waiting for ${pending.join(" and ")} confirmation.`
      : "Responses recorded; waiting for the visit to be confirmed.",
    resident: appointment.residentConfirmedAt
      ? "Confirmed"
      : "Awaiting response",
    vendor: appointment.vendorConfirmedAt ? "Confirmed" : "Awaiting response",
    tone: "proposed",
  };
}

function timestamp(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
export function ageLabel(createdAt: string, now = Date.now()) {
  const created = timestamp(createdAt);
  if (created === null) return "Date unavailable";
  const days = Math.floor(Math.max(0, now - created) / 86_400_000);
  return days === 0
    ? "Reported today"
    : `${days} ${days === 1 ? "day" : "days"} open since report`;
}

export function sortRequests(
  requests: readonly RequestRecord[],
  sort: RequestSort = "attention",
) {
  return [...requests].sort((left, right) => {
    if (sort === "property")
      return (
        `${left.property} ${left.unit}`.localeCompare(
          `${right.property} ${right.unit}`,
          undefined,
          { numeric: true },
        ) || left.id.localeCompare(right.id)
      );
    if (sort === "attention") {
      const score = (r: RequestRecord) =>
        (!isOpen(r) ? 0 : r.priority === "urgent" ? 4 : 1) +
        (managerAction(r) ? 2 : 0);
      const priority = score(right) - score(left);
      if (priority) return priority;
    }
    const a = timestamp(left.createdAt),
      b = timestamp(right.createdAt);
    if (a === null || b === null)
      return a === b ? left.id.localeCompare(right.id) : a === null ? 1 : -1;
    return (
      (sort === "newest" ? b - a : a - b) || left.id.localeCompare(right.id)
    );
  });
}

export function formatDate(value: string, timezone?: string) {
  if (timestamp(value) === null) return "Date unavailable";
  const options: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  };
  try {
    return new Date(value).toLocaleString(undefined, {
      ...options,
      timeZone: timezone,
    });
  } catch {
    return (
      new Date(value).toLocaleString(undefined, {
        ...options,
        timeZone: "UTC",
      }) + " UTC"
    );
  }
}

export function propertyDateInput(timezone: string, now = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const part = (name: string) =>
      parts.find((item) => item.type === name)?.value ?? "";
    return `${part("year")}-${part("month")}-${part("day")}`;
  } catch {
    return now.toISOString().slice(0, 10);
  }
}
