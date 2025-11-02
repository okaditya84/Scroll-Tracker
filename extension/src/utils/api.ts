import type { AuthState } from '../storage/auth';
import { getQueuedEvents, removeQueuedEvents } from '../storage/queue';

const API_URL = import.meta.env.VITE_API_URL;

export interface UploadResult {
  sentIds: string[];
  hasMore: boolean;
  requestAuthRefresh?: boolean;
}

const BATCH_SIZE = 80;

export const sendEventsToApi = async (auth: AuthState): Promise<UploadResult | undefined> => {
  const queued = await getQueuedEvents();
  if (!queued.length || !auth.accessToken) {
    return undefined;
  }

  const batch = queued.slice(0, BATCH_SIZE);
  const response = await fetch(`${API_URL}/tracking/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${auth.accessToken}`
    },
    body: JSON.stringify({ events: batch.map(item => item.event) })
  });

  if (response.status === 401 && auth.refreshToken) {
    const refreshed = await refreshAccessToken(auth);
    return {
      sentIds: [],
      hasMore: true,
      requestAuthRefresh: refreshed
    };
  }

  if (!response.ok) {
    throw new Error(`Failed to upload events: ${response.status}`);
  }

  await removeQueuedEvents(batch.map(item => item.id));
  const remaining = await getQueuedEvents();

  return {
    sentIds: batch.map(item => item.id),
    hasMore: remaining.length > 0
  };
};

const refreshAccessToken = async (auth: AuthState) => {
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: auth.refreshToken })
  });

  if (!response.ok) {
    await chrome.storage.local.set({ 'scrollwise-auth': { trackingEnabled: false } });
    return false;
  }

  const data = await response.json();
  await chrome.storage.local.set({
    'scrollwise-auth': {
      ...auth,
      accessToken: data.tokens.accessToken,
      refreshToken: data.tokens.refreshToken,
      trackingEnabled: true
    }
  });
  return true;
};
