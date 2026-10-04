export type MobileRole = 'tenant' | 'watchman';
export type Language = 'en' | 'hi' | 'ta';
export interface MobileProperty { id: string; name: string; timezone: string; units: string[] }
export interface MobileContext { role: string; email: string; properties: MobileProperty[]; userContext?: 1|2|3; canSwitchContext?: boolean; availableContexts?: (1|2|3)[]; displayName?: string }
export interface Appointment { id: string; startsAt: string; endsAt: string; timezone: string; status: 'proposed' | 'confirmed' | 'cancelled'; residentConfirmedAt?: string; vendorConfirmedAt?: string }
export interface Evidence { id: string; name: string; contentType: string; size: number; status: 'uploading' | 'uploaded' }
export interface Repair {
  id: string; revision: number; title: string; property: string; propertyId: string; unit: string;
  category: string; priority: 'routine' | 'urgent'; state: string; description: string;
  createdAt: string; nextAction: string; timezone: string; access: string;
  appointments: Appointment[]; evidence: Evidence[];
  events: { id: string; label: string; detail: string; at: string }[];
  residentVerification?: { status: string; note?: string };
}
export interface Message { id: string; sender: string; role: string; body: string; at: string }
export interface GateVisit {
  id: string; propertyId: string; propertyName: string; unit: string; vendorName: string; trade: string;
  startsAt: string; endsAt: string; timezone: string; arrivedAt?: string; departedAt?: string; revision: number;
}
export interface CommonIssue {
  id: string; propertyId: string; propertyName: string; title: string; location: string; category: string;
  description: string; priority: 'routine' | 'urgent'; status: 'reported' | 'in_progress' | 'resolved';
  resolutionNote?: string; createdAt: string; updatedAt: string; revision: number;
}
export interface ApartmentInput {
  title: string; propertyId: string; unit: string; resident: string; category: string; description: string;
  priority: 'routine' | 'urgent'; language: string; access: string; accessNotes: string;
  preferredWindow: string; safetyAnswers: Record<string, string>;
}
export interface CommonInput {
  submissionId: string; propertyId: string; location: string; title: string; category: string;
  description: string; priority: 'routine' | 'urgent';
}
