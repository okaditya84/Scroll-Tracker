import type { TrackingPayload } from '@/types/tracking';
import { getSettings } from '@/storage/settings';

const BROADCAST_SOURCE = 'scrollwise-web';
const EXTENSION_BROADCAST_SOURCE = 'scrollwise-extension';

const broadcastLogoutToPage = () => {
  try {
    window.localStorage.removeItem('scrollwise-auth');
  } catch (error) {
    console.warn('scrollwise: unable to clear web auth storage', error);
  }
  window.postMessage({ source: EXTENSION_BROADCAST_SOURCE, origin: 'extension', type: 'AUTH_LOGOUT' }, '*');
};

const readForcedLogoutFlag = () =>
  new Promise<boolean>(resolve => {
    if (!chrome?.storage?.local?.get) {
      resolve(false);
      return;
    }
    try {
      chrome.storage.local.get('scrollwiseForceLogoutAt', store => {
        resolve(Boolean(store?.scrollwiseForceLogoutAt));
      });
    } catch (error) {
      console.warn('scrollwise: unable to read forced logout flag', error);
      resolve(false);
    }
  });

const clearForcedLogoutFlag = () =>
  new Promise<void>(resolve => {
    if (!chrome?.storage?.local?.remove) {
      resolve();
      return;
    }
    try {
      chrome.storage.local.remove('scrollwiseForceLogoutAt', () => resolve());
    } catch (error) {
      console.warn('scrollwise: unable to clear forced logout flag', error);
      resolve();
    }
  });

let trackingEnabled = false;
let idleTimer: number | undefined;
let lastActionAt = Date.now();
let storageSyncInterval: number | undefined;
const BUFFER: TrackingPayload[] = [];
let runtimeInvalidated = false;
type ScrollKey = Window | HTMLElement;
type ScrollSource = 'scroll' | 'wheel' | 'touch' | 'key';
const MIN_SCROLL_DELTA = 8;
const IDLE_THRESHOLD_MS = 60_000;
const scrollOffsets = new WeakMap<ScrollKey, number>();
scrollOffsets.set(window, window.scrollY);

const EVENT_LISTENER_OPTIONS: AddEventListenerOptions = { passive: true, capture: true };
const WHEEL_LISTENER_OPTIONS: AddEventListenerOptions = { passive: false, capture: true };
const KEYDOWN_LISTENER_OPTIONS: AddEventListenerOptions = { capture: true };

const pendingAnimationHandles = new Set<number>();

const resolveErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message ?? '';
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' ? message : '';
  }
  return '';
};

const isContextInvalidError = (error: unknown) => {
  const message = resolveErrorMessage(error);
  return /extension context invalidated|receiving end does not exist|no tab with id/i.test(message);
};

let flushTimeout: number | undefined;
let listenersAttached = false;

const clearIdleTimer = () => {
  if (!idleTimer) return;
  window.clearTimeout(idleTimer);
  idleTimer = undefined;
};

const scheduleIdleTimer = () => {
  clearIdleTimer();
  if (!trackingEnabled || document.visibilityState !== 'visible') {
    return;
  }
  idleTimer = window.setTimeout(() => {
    idleTimer = undefined;
    if (!trackingEnabled || document.visibilityState !== 'visible') {
      return;
    }
    const now = Date.now();
    const elapsed = Math.max(now - lastActionAt, IDLE_THRESHOLD_MS);
      void pushEvent({
      type: 'idle',
      url: location.href,
      domain: urlDomain(location.href),
      durationMs: elapsed,
      startedAt: new Date(now - elapsed).toISOString(),
      metadata: { reason: 'pointer-idle', thresholdMs: IDLE_THRESHOLD_MS }
    });
    lastActionAt = now;
    scheduleIdleTimer();
  }, IDLE_THRESHOLD_MS);
};

const cancelScheduledFlush = () => {
  if (flushTimeout) {
    window.clearTimeout(flushTimeout);
    flushTimeout = undefined;
  }
};

const cancelScheduledMeasurements = () => {
  pendingAnimationHandles.forEach(handle => window.cancelAnimationFrame(handle));
  pendingAnimationHandles.clear();
};

const markRuntimeInvalidated = () => {
  if (runtimeInvalidated) return;
  runtimeInvalidated = true;
  trackingEnabled = false;
  BUFFER.length = 0;
  clearIdleTimer();
  cancelScheduledFlush();
  cancelScheduledMeasurements();
  if (storageSyncInterval) {
    window.clearInterval(storageSyncInterval);
    storageSyncInterval = undefined;
  }
  detachTrackingListeners();
  console.debug('scrollwise: extension runtime invalidated, suspending messaging');
};

const isRuntimeAvailable = () => {
  if (runtimeInvalidated) return false;
  if (typeof chrome === 'undefined' || !chrome.runtime?.id) {
    return false;
  }

  try {
    if (typeof chrome.runtime.getURL === 'function') {
      chrome.runtime.getURL('');
    }
  } catch (error) {
    if (isContextInvalidError(error)) {
      markRuntimeInvalidated();
    }
    return false;
  }

  return true;
};

type MessageResult<T> = { ok: true; data: T | undefined } | { ok: false; error?: Error };

const safeSendMessage = <T = unknown>(message: unknown): Promise<MessageResult<T>> => {
  if (!isRuntimeAvailable()) {
    markRuntimeInvalidated();
    return Promise.resolve({ ok: false });
  }

  return new Promise<MessageResult<T>>(resolve => {
    const finalizeFailure = (error?: unknown) => {
      if (isContextInvalidError(error)) {
        markRuntimeInvalidated();
      }
      resolve({ ok: false, error: error instanceof Error ? error : undefined });
    };

    try {
      const maybePromise = chrome.runtime.sendMessage(message, (response: T | undefined) => {
        const runtimeError = chrome.runtime.lastError;
        if (runtimeError) {
          finalizeFailure(runtimeError);
          return;
        }
        resolve({ ok: true, data: response });
      });

      if (typeof maybePromise !== 'undefined' && typeof (maybePromise as Promise<unknown>).then === 'function') {
        (maybePromise as Promise<T | undefined>)
          .then(response => {
            resolve({ ok: true, data: response });
          })
          .catch(finalizeFailure);
      }
    } catch (error) {
      finalizeFailure(error);
    }
  });
};

type PageAuthSnapshot = {
  accessToken: string;
  refreshToken?: string;
  user?: {
    id?: string;
    email?: string;
    displayName?: string;
    avatarUrl?: string;
    role?: 'user' | 'admin' | 'superadmin';
    timezone?: string;
    accountStatus?: 'active' | 'invited' | 'suspended';
    createdAt?: string;
  };
};

const readPageAuth = (): PageAuthSnapshot | undefined => {
  if (!(window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
    return undefined;
  }
  try {
    const raw = window.localStorage.getItem('scrollwise-auth');
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (!parsed?.accessToken) return undefined;
    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      user: parsed.user
    };
  } catch (error) {
    console.warn('scrollwise: unable to parse local auth', error);
    return undefined;
  }
};

const authHash = (auth?: PageAuthSnapshot | null) => {
  if (!auth) return null;
  const userId = auth.user?.id ?? '';
  return `${auth.accessToken}:${auth.refreshToken ?? ''}:${userId}`;
};

let lastAuthSignature: string | null = null;

const broadcastAuthSnapshotToPage = (snapshot: PageAuthSnapshot) => {
  if (!snapshot?.accessToken) return;
  window.postMessage(
    { source: EXTENSION_BROADCAST_SOURCE, origin: 'extension', type: 'AUTH_UPDATE', payload: snapshot },
    '*'
  );
};

const persistPageSnapshot = (snapshot: PageAuthSnapshot) => {
  if (!snapshot?.accessToken) return;
  try {
    window.localStorage.setItem('scrollwise-auth', JSON.stringify(snapshot));
  } catch (error) {
    console.warn('scrollwise: unable to persist web auth storage', error);
  }
};

const applyAuthSnapshotFromExtension = (partial: Partial<PageAuthSnapshot> | undefined) => {
  if (!partial) return;
  const existing = readPageAuth();
  const mergedUser = partial.user
    ? { ...(existing?.user ?? {}), ...partial.user }
    : existing?.user;
  const next: PageAuthSnapshot = {
    accessToken: partial.accessToken ?? existing?.accessToken ?? '',
    refreshToken: partial.refreshToken ?? existing?.refreshToken,
    user: mergedUser
  };

  if (!next.accessToken || !next.refreshToken || !next.user) {
    return;
  }

  persistPageSnapshot(next);
  broadcastAuthSnapshotToPage(next);
  lastAuthSignature = authHash(next);
};

const syncFromPageStorage = async (activateTracking = false) => {
  const snapshot = readPageAuth();
  const nextSignature = authHash(snapshot);
  const runtimeReady = isRuntimeAvailable();

  if (!runtimeReady) {
    return;
  }

  const forcedLogout = await readForcedLogoutFlag();
  if (forcedLogout && snapshot) {
    broadcastLogoutToPage();
    lastAuthSignature = null;
    await clearForcedLogoutFlag();
    return;
  }

  const shouldActivate = activateTracking || (snapshot && nextSignature !== lastAuthSignature && !lastAuthSignature);

  if (snapshot && nextSignature !== lastAuthSignature) {
    void safeSendMessage({
      type: 'AUTH_UPDATE',
      payload: {
        accessToken: snapshot.accessToken,
        refreshToken: snapshot.refreshToken,
        user: snapshot.user,
        trackingEnabled: shouldActivate ? true : undefined
      }
    });
  }

  if (!snapshot && lastAuthSignature) {
    void safeSendMessage({ type: 'AUTH_LOGOUT' });
  }

  lastAuthSignature = nextSignature;
};

void syncFromPageStorage(true);

window.addEventListener('storage', () => {
  void syncFromPageStorage();
});

storageSyncInterval = window.setInterval(() => {
  void syncFromPageStorage();
}, 2000);

window.addEventListener('message', event => {
  if (event.source !== window) {
    return;
  }

  const data = event.data;
  if (!data || typeof data !== 'object' || data.source !== BROADCAST_SOURCE) {
    return;
  }

  if (!isRuntimeAvailable()) {
    return;
  }

  if (data.type === 'AUTH_UPDATE') {
    const payload = data.payload ?? {};
    lastAuthSignature = authHash({
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      user: payload.user
    }) ?? lastAuthSignature;
    void safeSendMessage({
      type: 'AUTH_UPDATE',
      payload: {
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
        user: payload.user,
        trackingEnabled: payload.trackingEnabled
      }
    });
  }

  if (data.type === 'AUTH_LOGOUT') {
    void safeSendMessage({ type: 'AUTH_LOGOUT' });
    lastAuthSignature = null;
  }
});

const setTrackingEnabled = (enabled: boolean) => {
  trackingEnabled = enabled;
  if (!enabled) {
    BUFFER.length = 0;
    clearIdleTimer();
  } else {
    lastActionAt = Date.now();
    scheduleIdleTimer();
  }
};

const flushBuffer = () => {
  if (!BUFFER.length) return;
  if (!isRuntimeAvailable()) {
    scheduleFlush();
    return;
  }
  const batch = [...BUFFER];
  BUFFER.length = 0;
  safeSendMessage({ type: 'TRACKING_EVENT', payload: batch }).then(result => {
    if (!result.ok) {
      // requeue if sending fails so we attempt again once connection resumes
      BUFFER.unshift(...batch);
      scheduleFlush();
    }
  });
};

const scheduleFlush = () => {
  if (flushTimeout) window.clearTimeout(flushTimeout);
  flushTimeout = window.setTimeout(flushBuffer, 1500);
};

const pushEvent = async (event: TrackingPayload) => {
  if (!trackingEnabled) return;
  try {
    const settings = await getSettings();
    const domain = event.domain || urlDomain(event.url || location.href);
    if (settings.blocklist.includes(domain)) return;
  } catch (e) {
    // ignore settings read errors — do not block event capture
  }

  if (!isRuntimeAvailable()) {
    markRuntimeInvalidated();
    return;
  }

  BUFFER.push(event);
  if (BUFFER.length >= 8) {
    flushBuffer();
  } else {
    scheduleFlush();
  }
};

const urlDomain = (url: string) => {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return location.hostname;
  }
};

const resolveScrollTarget = (target: EventTarget | null): ScrollKey => {
  if (!target) return window;
  if (target === document || target === document.body || target === document.documentElement) {
    return window;
  }
  if (target instanceof HTMLElement) {
    return target;
  }
  if (target instanceof Element) {
    return target as unknown as HTMLElement;
  }
  return window;
};

const readScrollOffset = (target: ScrollKey) => {
  if (target === window) {
    return window.scrollY;
  }

  const value = (target as HTMLElement).scrollTop;
  return Number.isFinite(value) ? value : 0;
};

const seedScrollOffset = (target: ScrollKey) => {
  if (!scrollOffsets.has(target)) {
    scrollOffsets.set(target, readScrollOffset(target));
  }
};

const describeScrollTarget = (target: ScrollKey) => {
  if (target === window) return 'window';
  const element = target as HTMLElement;
  const tag = element.tagName?.toLowerCase() ?? 'element';
  const id = element.id ? `#${element.id}` : '';
  let classList = '';
  const rawClassName = typeof element.className === 'string'
    ? element.className
    : typeof (element.className as SVGAnimatedString | undefined)?.baseVal === 'string'
      ? (element.className as SVGAnimatedString).baseVal
      : '';
  if (rawClassName) {
    const tokens = rawClassName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((cls: string) => `.${cls}`)
      .join('');
    classList = tokens;
  }
  return `${tag}${id}${classList}`;
};

const recordScrollForTarget = (target: ScrollKey, source: ScrollSource = 'scroll') => {
  seedScrollOffset(target);
  const previous = scrollOffsets.get(target) ?? 0;
  const current = readScrollOffset(target);
  const delta = Math.abs(current - previous);
  if (delta < MIN_SCROLL_DELTA) {
    return;
  }
  scrollOffsets.set(target, current);
  const now = Date.now();
    void pushEvent({
    type: 'scroll',
    url: location.href,
    domain: urlDomain(location.href),
    scrollDistance: delta,
    durationMs: now - lastActionAt,
    startedAt: new Date(lastActionAt).toISOString(),
    metadata: {
      viewportHeight: window.innerHeight,
      container: describeScrollTarget(target),
      source
    }
  });
  lastActionAt = now;
};

const scheduleScrollMeasurement = (target: ScrollKey, source: ScrollSource, immediate = false) => {
  if (immediate) {
    recordScrollForTarget(target, source);
    return;
  }

  const handle = window.requestAnimationFrame(() => {
    pendingAnimationHandles.delete(handle);
    recordScrollForTarget(target, source);
  });
  pendingAnimationHandles.add(handle);
};

const keyScrollKeys = new Set(['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', 'Space']);

const handleScrollEvent = (event: Event) => {
  resetIdleTimer();
  const target = resolveScrollTarget(event.target);
  scheduleScrollMeasurement(target, 'scroll', true);
};

const handleWheel = (event: WheelEvent) => {
  resetIdleTimer();
  const target = resolveScrollTarget(event.target);
  if (!scrollOffsets.has(target)) {
    seedScrollOffset(target);
  }
  scheduleScrollMeasurement(target, 'wheel');
};

const handleTouchMove = (event: TouchEvent) => {
  resetIdleTimer();
  const target = resolveScrollTarget(event.target);
  scheduleScrollMeasurement(target, 'touch');
};

const handleKeyDown = (event: KeyboardEvent) => {
  if (!keyScrollKeys.has(event.key)) {
    return;
  }
  resetIdleTimer();
  const activeElement = document.activeElement as HTMLElement | null;
  const target = activeElement && activeElement !== document.body ? activeElement : window;
  seedScrollOffset(target);
  scheduleScrollMeasurement(target, 'key');
};

const handleClick = (event: MouseEvent) => {
  const now = Date.now();
    void pushEvent({
    type: 'click',
    url: location.href,
    domain: urlDomain(location.href),
    durationMs: now - lastActionAt,
    startedAt: new Date(lastActionAt).toISOString(),
    metadata: {
      tag: (event.target as HTMLElement)?.tagName,
      x: event.clientX,
      y: event.clientY
    }
  });
  lastActionAt = now;
  resetIdleTimer();
};

const resetIdleTimer = () => {
  if (!trackingEnabled) {
    return;
  }
  scheduleIdleTimer();
};

const handleMouseMove = () => {
  lastActionAt = Date.now();
  resetIdleTimer();
};

const handleVisibilityChange = () => {
  const nowVisible = document.visibilityState === 'visible';
  const now = Date.now();
    void pushEvent({
    type: nowVisible ? 'focus' : 'blur',
    url: location.href,
    domain: urlDomain(location.href),
    startedAt: new Date(now).toISOString()
  });
  lastActionAt = now;
  if (!nowVisible) {
    clearIdleTimer();
    flushBuffer();
  } else {
    scheduleIdleTimer();
  }
};

const handleBeforeUnload = () => {
  clearIdleTimer();
  lastActionAt = Date.now();
  flushBuffer();
};

const handlePageHide = () => {
  clearIdleTimer();
  lastActionAt = Date.now();
  flushBuffer();
};

function attachTrackingListeners() {
  if (listenersAttached) return;
  document.addEventListener('scroll', handleScrollEvent, EVENT_LISTENER_OPTIONS);
  document.addEventListener('wheel', handleWheel, WHEEL_LISTENER_OPTIONS);
  document.addEventListener('touchmove', handleTouchMove, EVENT_LISTENER_OPTIONS);
  document.addEventListener('keydown', handleKeyDown, KEYDOWN_LISTENER_OPTIONS);
  document.addEventListener('click', handleClick, { passive: true });
  document.addEventListener('mousemove', handleMouseMove, { passive: true });
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('beforeunload', handleBeforeUnload);
  window.addEventListener('pagehide', handlePageHide);
  listenersAttached = true;
}

function detachTrackingListeners() {
  if (!listenersAttached) return;
  document.removeEventListener('scroll', handleScrollEvent, EVENT_LISTENER_OPTIONS);
  document.removeEventListener('wheel', handleWheel, WHEEL_LISTENER_OPTIONS);
  document.removeEventListener('touchmove', handleTouchMove, EVENT_LISTENER_OPTIONS);
  document.removeEventListener('keydown', handleKeyDown, KEYDOWN_LISTENER_OPTIONS);
  document.removeEventListener('click', handleClick);
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('beforeunload', handleBeforeUnload);
  window.removeEventListener('pagehide', handlePageHide);
  cancelScheduledMeasurements();
  listenersAttached = false;
}

if (isRuntimeAvailable()) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'SYNC_TRACKING') {
      setTrackingEnabled(Boolean(message.enabled));
      sendResponse({ enabled: trackingEnabled });
      return;
    }

    if (message.type === 'AUTH_STATE_PUSH') {
      applyAuthSnapshotFromExtension(message.payload);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === 'AUTH_LOGOUT_BROADCAST') {
      setTrackingEnabled(false);
      BUFFER.length = 0;
      clearIdleTimer();
      cancelScheduledFlush();
      broadcastLogoutToPage();
      lastAuthSignature = null;
      sendResponse({ ok: true });
      return;
    }
  });
}

resetIdleTimer();

safeSendMessage<{ enabled?: boolean }>({ type: 'TRACKING_STATUS_REQUEST' }).then(result => {
  if (result.ok) {
    setTrackingEnabled(Boolean(result.data?.enabled));
  }
});

safeSendMessage<{ state?: PageAuthSnapshot }>({ type: 'AUTH_STATE_REQUEST' }).then(result => {
  if (result.ok && result.data?.state) {
    applyAuthSnapshotFromExtension(result.data.state);
  }
});

attachTrackingListeners();
