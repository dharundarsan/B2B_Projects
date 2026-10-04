import { request } from '../../api';
import type {
  CommunityContext,
  CommunityData,
} from '../../../../../shared/community';
const base = '/api/community';
export const communityApi = {
  context: (signal?: AbortSignal) =>
    request<{ data: CommunityContext }>(base + '/context', { signal }),
  read: (property: string, signal?: AbortSignal) =>
    request<{ data: CommunityData }>(
      base + '/' + encodeURIComponent(property),
      { signal },
    ),
  send: <T = unknown>(
    property: string,
    path: string,
    body: unknown,
    method = 'POST',
  ) =>
    request<{ data: T }>(
      base + '/' + encodeURIComponent(property) + '/' + path,
      { method, body: JSON.stringify(body) },
    ),
  receiptUrl: (property: string, id: string) =>
    request<{ data: { url: string } }>(
      base + '/' + encodeURIComponent(property) + '/receipts/' + id + '/url',
    ),
};
