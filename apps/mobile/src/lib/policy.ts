import type { Appointment, GateVisit, MobileContext, MobileRole, Repair } from '../types';

export const isMobileRole = (role: string): role is MobileRole | 'unit_owner' | 'operator' | 'owner' | 'manager' | 'member' => ['tenant','watchman','unit_owner','operator','owner','manager','member'].includes(role);
export const isOpen = (repair: Repair) => !['closed', 'cancelled'].includes(repair.state);
export function canReport(context: MobileContext | null, propertyId: string, unit?: string): boolean {
  if (!context || !isMobileRole(context.role)) return false;
  const property = context.properties.find(p => p.id === propertyId);
  return !!property && (unit === undefined || context.role === 'tenant' && property.units.includes(unit));
}
export const canConfirm = (role: string, visit: Appointment) => role === 'tenant' && visit.status === 'proposed' && !visit.residentConfirmedAt;
export const canVerify = (role: string, repair: Repair) => role === 'tenant' && repair.state === 'verification';
export const presenceAction = (visit: GateVisit): 'arrive' | 'depart' | null => visit.departedAt ? null : visit.arrivedAt ? 'depart' : 'arrive';
export function assertImage(contentType: string, size: number) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType) || size <= 0 || size > 20 * 1024 * 1024)
    throw new Error('Choose a JPEG, PNG or WebP image up to 20 MB.');
}
export function formatTime(value: string, timezone: string, locale: string) {
  try { return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone: timezone }).format(new Date(value)); }
  catch { return '—'; }
}
export function formatDate(value: string, timezone: string, locale: string) {
  try { return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric', timeZone: timezone }).format(new Date(value)); }
  catch { return '—'; }
}
