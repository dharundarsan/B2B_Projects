import { request } from './api';
import type {
  CommunityContext,
  CommunityData,
} from '../../../../shared/community';
export const communityApi = {
  context: (signal?: AbortSignal) =>
    request<CommunityContext>('/community/context', { signal }),
  read: (property: string, signal?: AbortSignal) =>
    request<CommunityData>('/community/' + encodeURIComponent(property), {
      signal,
    }),
  send: (property: string, path: string, body: unknown, method = 'POST') =>
    request('/community/' + encodeURIComponent(property) + '/' + path, {
      method,
      body: JSON.stringify(body),
    }),
};
