export type RequestState =
  | "draft"
  | "submitted"
  | "urgent"
  | "acknowledged"
  | "assigned"
  | "waiting"
  | "scheduled"
  | "approved"
  | "in_progress"
  | "completed"
  | "verification"
  | "invoice_review"
  | "closed"
  | "cancelled";
export type RequestPriority = "urgent" | "routine";

export type LanguageCode = "en" | "hi" | "es" | "fr" | "de" | "ar";

export interface RequestRecord {
  id: string;
  revision?: number;
  title: string;
  property: string;
  propertyId?: string;
  unit: string;
  resident: string;
  category: string;
  priority: RequestPriority;
  state: RequestState;
  nextAction: string;
  dueLabel: string;
  description: string;
  access: string;
  language: string;
  createdAt: string;
  timezone?: string;
  photoUrl?: string;
  accessNotes?: string;
  preferredWindow?: string;
  safetyAnswers?: Record<string, string>;
  assignedVendorId?: string;
  assignedVendorName?: string;
  vendorDecision?: "pending" | "accepted" | "declined";
  events?: ActivityEvent[];
  estimate?: EstimateVersion;
  estimates?: EstimateVersion[];
  appointment?: AppointmentRecord;
  appointments?: AppointmentRecord[];
  evidence?: EvidenceRecord[];
  residentVerification?: {
    status: "pending" | "verified" | "unresolved";
    note?: string;
    updatedAt?: string;
  };
}

export interface AppointmentRecord {
  id: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  status: "proposed" | "confirmed" | "cancelled";
  residentConfirmedAt?: string;
  vendorConfirmedAt?: string;
}

export interface EvidenceRecord {
  id: string;
  path: string;
  name: string;
  contentType: string;
  size: number;
  uploadedBy: string;
  createdAt: string;
  status: "uploading" | "uploaded";
}

export interface VendorRecord {
  id: string;
  name: string;
  trade: string;
  distance: string;
  availability: string;
  firstVisitFixes: string;
  status: "preferred" | "approved" | "review";
}

export interface EstimateVersion {
  id: string;
  version: number;
  scope: string;
  labor: number;
  parts: number;
  tax: number;
  total: number;
  currency?: string;
  vendorId?: string;
  status: "draft" | "submitted" | "approved" | "changes_requested";
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
}

export interface DashboardData {
  urgent: number;
  awaitingYou: number;
  visitsToday: number;
  residentVerified?: number | null;
  openRequests?: number;
  pendingQuotes?: number;
  awaitingVerification?: number;
  requests: RequestRecord[];
  schedule: {
    time: string;
    vendor: string;
    detail: string;
    requestId?: string;
    startsAt?: string;
    timezone?: string;
  }[];
}

export interface MessageRecord {
  id: string;
  requestId: string;
  sender: string;
  role: "resident" | "manager" | "vendor" | "system";
  body: string;
  at: string;
  translatedBody?: string;
  status?: "sent" | "delivered" | "failed";
}

export interface PropertyRecord {
  id: string;
  name: string;
  address: string;
  units: number;
  timezone: string;
  openRequests: number;
  urgentRequests: number;
  assets: number;
  imageUrl?: string;
}

export interface NotificationRecord {
  id: string;
  title: string;
  detail: string;
  type: "request" | "message" | "visit" | "cost" | "system";
  read: boolean;
  href?: string;
  at: string;
}

export interface ActivityEvent {
  id: string;
  type: string;
  label: string;
  detail: string;
  at: string;
  actor?: string;
}

export interface RequestDetail extends RequestRecord {
  events: ActivityEvent[];
  estimate?: EstimateVersion;
}

export interface CommonAreaRecord {
  id: string;
  propertyId: string;
  propertyName: string;
  title: string;
  location: string;
  category: string;
  description: string;
  priority: string;
  status: "reported" | "in_progress" | "resolved";
  resolutionNote?: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
}
