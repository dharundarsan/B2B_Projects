import { supabase } from './supabase';
import type { ApartmentInput, CommonInput, CommonIssue, GateVisit, Message, MobileContext, Repair } from '../types';

export class ApiError extends Error { constructor(message: string, public readonly status: number) { super(message); } }
const base = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');
export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!base) throw new ApiError('Set EXPO_PUBLIC_API_URL to your C# API address.', 503);
  if (!__DEV__ && !base.startsWith('https://')) throw new ApiError('Production API connections require HTTPS.', 503);
  const session = await supabase?.auth.getSession();
  const token = session?.data.session?.access_token;
  if (!token) throw new ApiError('Sign in again to continue.', 401);
  const controller = new AbortController();
  const cancel = () => controller.abort(); options.signal?.addEventListener('abort', cancel, { once: true });
  if (options.signal?.aborted) controller.abort();
  const timeout = setTimeout(cancel, 20000);
  try {
    const response = await fetch(base + '/api' + path, { ...options, signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, ...options.headers } });
    const payload = await response.json().catch(() => null) as { data: T; message?: string } | null;
    if (!response.ok) throw new ApiError(payload?.message ?? (response.status === 429 ? 'Too many requests. Wait a minute and refresh.' : 'Request failed. Please refresh.'), response.status);
    if (!payload || !('data' in payload)) throw new ApiError('The API returned an invalid response.', 502);
    return payload.data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (options.signal?.aborted) throw error;
    throw new ApiError('Could not reach the API. Check your connection and refresh. If a submission timed out, check your list before submitting again.', 0);
  } finally { clearTimeout(timeout); options.signal?.removeEventListener('abort', cancel); }
}
const post = <T>(path: string, body: unknown, revision?: number) => request<T>(path, {
  method: 'POST', body: JSON.stringify(body), headers: revision === undefined ? {} : { 'If-Match': '"' + revision + '"' }
});
export const api = {
  context: (signal?: AbortSignal) => request<MobileContext>('/mobile/context', { signal }),
  repairs: (signal?: AbortSignal) => request<Repair[]>('/requests', { signal }),
  repair: (id: string, signal?: AbortSignal) => request<Repair>('/requests/' + encodeURIComponent(id), { signal }),
  create: (body: ApartmentInput) => post<Repair>('/requests', body),
  confirm: (repair: Repair, id: string, confirmed: boolean) => post<Repair>(`/requests/${encodeURIComponent(repair.id)}/appointments/${encodeURIComponent(id)}/confirm`, { confirmed }, repair.revision),
  verify: (repair: Repair, fixed: boolean, note: string) => post<Repair>(`/requests/${encodeURIComponent(repair.id)}/verify`, { fixed, note }, repair.revision),
  messages: (id: string, signal?: AbortSignal) => request<Message[]>(`/requests/${encodeURIComponent(id)}/messages`, { signal }),
  send: (id: string, body: string) => post<Message>(`/requests/${encodeURIComponent(id)}/messages`, { body }),
  visits: (signal?: AbortSignal) => request<GateVisit[]>('/mobile/watchman/visits', { signal }),
  presence: (visit: GateVisit, action: 'arrive' | 'depart') => post<GateVisit>(`/mobile/watchman/visits/${encodeURIComponent(visit.id)}/presence`, { action, revision: visit.revision }),
  issues: (signal?: AbortSignal) => request<CommonIssue[]>('/mobile/common-area-issues', { signal }),
  reportCommon: (body: CommonInput) => post<CommonIssue>('/mobile/common-area-issues', body),
  uploadUrl: (body: { requestId: string; name: string; contentType: string; size: number }) => post<{ evidenceId: string; path: string; signedUrl: string; token: string }>('/evidence/upload-url', body),
  completeUpload: (requestId: string, evidenceId: string) => post(`/evidence/${encodeURIComponent(evidenceId)}/complete`, { requestId }),
  evidenceUrl: (id: string, evidenceId: string) => request<{ url: string }>(`/requests/${encodeURIComponent(id)}/evidence/${encodeURIComponent(evidenceId)}/url`)
};
