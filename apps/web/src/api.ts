import { demoMode, supabase } from "./supabase";
import type {
  DashboardData,
  RequestRecord,
  RequestDetail,
  RequestState,
  MessageRecord,
  VendorRecord,
  EstimateVersion,
  PropertyRecord,
  NotificationRecord,
  CommonAreaRecord,
} from "./types";
import { clearResidentDraft } from "./features/residentPrivacy";

const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
type Result<T> = { data: T };
type RepairInput = Pick<
  RequestRecord,
  | "title"
  | "unit"
  | "resident"
  | "category"
  | "description"
  | "priority"
  | "language"
  | "access"
> &
  Partial<
    Pick<
      RequestRecord,
      | "property"
      | "propertyId"
      | "accessNotes"
      | "preferredWindow"
      | "safetyAnswers"
      | "timezone"
    >
  > & { residentUserId?: string; residentOccupancyId?: string };
type PropertyInput = Pick<
  PropertyRecord,
  "name" | "address" | "units" | "timezone"
>;
const revisions = new Map<string, number>();
let draftAccountId: string | null = null;
supabase?.auth.onAuthStateChange((event, session) => {
  revisions.clear();
  const nextAccountId = session?.user.id ?? null;
  if (event === "SIGNED_OUT" || nextAccountId !== draftAccountId) clearResidentDraft();
  draftAccountId = nextAccountId;
});

export function validateEvidence(file: File) {
  if (
    ![
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "video/mp4",
      "video/quicktime",
      "application/pdf",
    ].includes(file.type)
  )
    throw new Error("Choose a JPEG, PNG, WebP, GIF, MP4, MOV or PDF file.");
  if (file.size < 1 || file.size > 20 * 1024 * 1024)
    throw new Error("Choose a non-empty file of at most 20 MB.");
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const session = supabase
    ? (await supabase.auth.getSession()).data.session
    : null;
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok)
    throw new Error(
      (await response.json().catch(() => null))?.message ??
        `Request failed (${response.status})`,
    );
  const result = await response.json();
  if (result.data?.id && typeof result.data.revision === "number")
    revisions.set(result.data.id, result.data.revision);
  return result as T;
}

function mutate<T>(id: string, action: string, payload?: object) {
  const revision = revisions.get(id);
  return request<Result<T>>(
    `/api/requests/${encodeURIComponent(id)}/${action}`,
    {
      method: "POST",
      headers: revision === undefined ? {} : { "If-Match": `"${revision}"` },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    },
  );
}

export const api = {
  // Reuse native assignments: a first report need not have an existing registered unit row.
  residentContext: (signal?: AbortSignal) => request<Result<{ properties: { id: string; units: string[] }[] }>>("/api/mobile/context", { signal }),
  linkResident: (id: string, payload: { residentUserId?: string; residentOccupancyId?: string }, revision: number) => request<Result<RequestDetail>>(`/api/requests/${encodeURIComponent(id)}/resident-link`, {
    method: "POST", headers: { "If-Match": `"${revision}"` }, body: JSON.stringify(payload),
  }),
  commonAreaIssues: (signal?: AbortSignal) => request<Result<CommonAreaRecord[]>>("/api/mobile/common-area-issues", { signal }),
  updateCommonAreaIssue: (id: string, payload: { status: "in_progress" | "resolved"; note: string; revision: number }) =>
    request<Result<CommonAreaRecord>>(`/api/mobile/common-area-issues/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) }),
  dashboard: (signal?: AbortSignal) =>
    request<Result<DashboardData>>("/api/dashboard", { signal }),
  requests: (
    params?: {
      search?: string;
      state?: string;
      priority?: string;
      property?: string;
    },
    signal?: AbortSignal,
  ) => {
    const query = new URLSearchParams(
      Object.entries(params ?? {}).filter(([, value]) => Boolean(value)) as [
        string,
        string,
      ][],
    ).toString();
    return request<Result<RequestRecord[]>>(
      `/api/requests${query ? `?${query}` : ""}`,
      { signal },
    );
  },
  request: (id: string, signal?: AbortSignal) =>
    request<Result<RequestDetail>>(`/api/requests/${encodeURIComponent(id)}`, {
      signal,
    }),
  createRequest: (payload: RepairInput) =>
    request<Result<RequestRecord>>("/api/requests", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  transitionRequest: (id: string, state: RequestState, note?: string) =>
    mutate<RequestDetail>(id, "transition", { state, note }),
  messages: (id: string, signal?: AbortSignal) =>
    request<Result<MessageRecord[]>>(
      `/api/requests/${encodeURIComponent(id)}/messages`,
      { signal },
    ),
  sendMessage: async (id: string, body: string) => {
    const result = await mutate<MessageRecord>(id, "messages", { body });
    revisions.delete(id); // Message writes also increment the aggregate revision.
    return result;
  },
  vendors: (signal?: AbortSignal) =>
    request<Result<VendorRecord[]>>("/api/vendors", { signal }),
  inviteVendor: (payload: {
    name: string;
    email: string;
    phone?: string;
    trade: string;
  }) =>
    request<Result<VendorRecord>>("/api/vendors/invite", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  offerVendor: (
    id: string,
    payload: { vendorId: string; note?: string; preferredWindow?: string },
  ) => mutate<RequestDetail>(id, "offer", payload),
  vendorResponse: (
    id: string,
    payload: {
      vendorId: string;
      decision: "accepted" | "declined";
      reason?: string;
    },
  ) => mutate<RequestDetail>(id, "vendor-response", payload),
  submitEstimate: async (
    id: string,
    payload: { scope: string; labor: number; parts: number; tax: number; currency?: string },
  ) => {
    const result = await mutate<EstimateVersion>(id, "estimates", payload);
    revisions.delete(id);
    return result;
  },
  approveEstimate: (id: string, estimateId: string) =>
    mutate<RequestDetail>(
      id,
      `estimates/${encodeURIComponent(estimateId)}/approve`,
    ),
  requestEstimateChanges: (id: string, estimateId: string, note: string) =>
    mutate<RequestDetail>(
      id,
      `estimates/${encodeURIComponent(estimateId)}/request-changes`,
      { note },
    ),
  proposeAppointment: (
    id: string,
    payload: { localStart: string; durationMinutes: number; timezone: string },
  ) => mutate<RequestDetail>(id, "appointments", payload),
  confirmAppointment: (
    id: string,
    appointmentId: string,
    confirmed: boolean,
    party?: "resident" | "vendor",
  ) =>
    mutate<RequestDetail>(
      id,
      `appointments/${encodeURIComponent(appointmentId)}/confirm`,
      { confirmed, party },
    ),
  verifyRepair: (id: string, fixed: boolean, note?: string) =>
    mutate<RequestDetail>(id, "verify", { fixed, note }),
  completeWork: (id: string) => mutate<RequestDetail>(id, "complete-work"),
  startWork: (id: string) => mutate<RequestDetail>(id, "start-work"),
  properties: (signal?: AbortSignal) =>
    request<Result<PropertyRecord[]>>("/api/properties", { signal }),
  createProperty: (payload: PropertyInput) =>
    request<Result<PropertyRecord>>("/api/properties", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateProperty: (id: string, payload: PropertyInput) =>
    request<Result<PropertyRecord>>(
      `/api/properties/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(payload) },
    ),
  notifications: (signal?: AbortSignal) =>
    request<Result<NotificationRecord[]>>("/api/notifications", { signal }),
  markNotificationRead: (id: string) =>
    request<Result<NotificationRecord>>(
      `/api/notifications/${encodeURIComponent(id)}/read`,
      { method: "POST" },
    ),
  evidenceUrl: (id: string, evidenceId: string, signal?: AbortSignal) =>
    request<Result<{ url: string }>>(
      `/api/requests/${encodeURIComponent(id)}/evidence/${encodeURIComponent(evidenceId)}/url`,
      { signal },
    ),
  uploadEvidence: async (file: File, requestId: string) => {
    validateEvidence(file);
    if (!requestId)
      throw new Error("Save the repair before attaching evidence.");
    if (demoMode)
      throw new Error(
        "Demo mode supports local previews only. Configure Supabase to persist evidence.",
      );
    const signed = await request<
      Result<{
        evidenceId: string;
        path: string;
        signedUrl: string;
        token: string;
      }>
    >("/api/evidence/upload-url", {
      method: "POST",
      body: JSON.stringify({
        requestId,
        name: file.name,
        contentType: file.type,
        size: file.size,
      }),
    });
    const upload = await fetch(signed.data.signedUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type, "x-upsert": "false" },
      body: file,
    });
    if (!upload.ok)
      throw new Error(
        "Evidence upload failed. The repair is saved; retry the attachment.",
      );
    await request(
      `/api/evidence/${encodeURIComponent(signed.data.evidenceId)}/complete`,
      { method: "POST", body: JSON.stringify({ requestId }) },
    );
    revisions.delete(requestId);
    return signed;
  },
};
