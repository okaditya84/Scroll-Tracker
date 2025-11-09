import type { AuthState } from '../storage/auth';
import { getQueuedEvents, removeQueuedEvents } from '../storage/queue';

type ResolvedBase = { base: string; appended: boolean };

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, '');
const hasApiSegment = (value: string) => /\/api(?:\/|$)/i.test(value);

const resolveApiBase = (raw?: string): ResolvedBase | undefined => {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  const normalised = stripTrailingSlash(trimmed);

  try {
    const url = new URL(normalised);
    const path = stripTrailingSlash(url.pathname || '');
    if (!path || path === '') {
      url.pathname = '/api';
      return { base: stripTrailingSlash(url.toString()), appended: true };
    }
    if (hasApiSegment(path)) {
      url.pathname = path;
      return { base: stripTrailingSlash(url.toString()), appended: false };
    }
    url.pathname = `${path}/api`;
    return { base: stripTrailingSlash(url.toString()), appended: true };
  } catch {
    if (hasApiSegment(normalised)) {
      return { base: normalised, appended: false };
    }
    return { base: `${normalised}/api`, appended: true };
  }
};

const resolvedBase = resolveApiBase(import.meta.env.VITE_API_URL);

if (!resolvedBase) {
  throw new Error('VITE_API_URL is not configured');
}

if (resolvedBase.appended) {
  // eslint-disable-next-line no-console
  console.warn('[scrollwise] VITE_API_URL was missing an /api segment; using', resolvedBase.base);
}

const API_URL = resolvedBase.base;

export interface UploadResult {
  sentIds: string[];
  hasMore: boolean;
  requestAuthRefresh?: boolean;
}

const BATCH_SIZE = 80;

// Simple mutex to avoid concurrent refreshes
let refreshPromise: Promise<boolean> | null = null;

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

const refreshAccessToken = async (auth: AuthState) => {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: auth.refreshToken })
      });

      if (!response.ok) {
        // disable tracking until user re-authenticates
        await chrome.storage.local.set({ 'scrollwise-auth': { trackingEnabled: false } });
        return false;
      }

      const data = await response.json();

      // merge existing state with new tokens
      const stored = await chrome.storage.local.get('scrollwise-auth');
      const prev = stored['scrollwise-auth'] ?? {};
      await chrome.storage.local.set({
        'scrollwise-auth': {
          ...prev,
          accessToken: data.tokens.accessToken,
          refreshToken: data.tokens.refreshToken,
          trackingEnabled: true
        }
      });

      return true;
    } catch (err) {
      // network error - don't flip tracking flag here, caller will retry later
      // eslint-disable-next-line no-console
      console.warn('[scrollwise] refresh failed', (err as Error).message ?? err);
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

export const sendEventsToApi = async (auth: AuthState): Promise<UploadResult | undefined> => {
  const queued = await getQueuedEvents();
  if (!queued.length || !auth.accessToken) {
    return undefined;
  }

  const batch = queued.slice(0, BATCH_SIZE);

  // Build payload including idempotency keys (client-side queue ids)
  const payload = { events: batch.map(item => ({ ...(item.event as any), idempotencyKey: item.id })) };

  // try upload with a small retry/backoff loop
  const maxAttempts = 3;
  let attempt = 0;
  let lastError: unknown = null;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const response = await fetch(`${API_URL}/tracking/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.accessToken}`
        },
        body: JSON.stringify(payload)
      });

      if (response.status === 401 && auth.refreshToken) {
        const refreshed = await refreshAccessToken(auth);
        if (!refreshed) {
          // cannot refresh, disable tracking and abort for now
          return { sentIds: [], hasMore: true, requestAuthRefresh: false };
        }

        // tokens refreshed, reload updated auth from storage and retry once immediately
        const stored = await chrome.storage.local.get('scrollwise-auth');
        const updated = stored['scrollwise-auth'] as AuthState | undefined;
        if (updated?.accessToken) {
          auth = { ...auth, accessToken: updated.accessToken, refreshToken: updated.refreshToken };
          // retry immediately without increasing attempt counter
          continue;
        }
      }

      if (!response.ok) {
        lastError = new Error(`Failed to upload events: ${response.status}`);
        // retry on server errors (5xx), but break for client errors
        if (response.status >= 500) {
          const backoff = 200 * Math.pow(2, attempt - 1);
          await sleep(backoff);
          continue;
        }
        throw lastError;
      }

      // success - parse server response for accepted idempotency keys
      const data = await response.json().catch(() => ({}));
      const accepted: string[] = Array.isArray(data?.acceptedKeys)
        ? data.acceptedKeys
        : batch.map(item => item.id);

      if (accepted.length) {
        await removeQueuedEvents(accepted);
      }

      const remaining = await getQueuedEvents();
      return {
        sentIds: accepted,
        hasMore: remaining.length > 0
      };
    } catch (err) {
      lastError = err;
      // transient network error -> retry with backoff
      const backoff = 200 * Math.pow(2, attempt - 1);
      // eslint-disable-next-line no-console
      console.warn('[scrollwise] upload attempt failed', attempt, (err as Error).message ?? err);
      await sleep(backoff);
      continue;
    }
  }

  // exhausting attempts
  if (lastError) throw lastError;
  return undefined;
};
