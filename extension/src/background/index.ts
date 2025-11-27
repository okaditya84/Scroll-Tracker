import { clearAuthState, getAuthState, setAuthState, syncTrackingFlag, type AuthState } from '@/storage/auth';
import { clearQueue, enqueueEvents, getQueuedEvents } from '@/storage/queue';
import { sendEventsToApi } from '@/utils/api';

const TRACKING_ALARM = 'scrollwise-upload';
let uploadInFlight: Promise<void> | null = null;
let uploadQueued = false;

const broadcastToTabs = async (message: Record<string, unknown>) => {
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs.map(tab => (tab.id ? chrome.tabs.sendMessage(tab.id, message).catch(() => undefined) : undefined))
  );
};

const broadcastAuthUpdate = async (state: AuthState | undefined) => {
  if (!state?.accessToken || !state?.refreshToken) return;
  await broadcastToTabs({
    type: 'AUTH_STATE_PUSH',
    payload: {
      accessToken: state.accessToken,
      refreshToken: state.refreshToken,
      user: state.user
    }
  });
};

const setForcedLogoutFlag = () =>
  new Promise<void>(resolve => {
    chrome.storage.local.set({ scrollwiseForceLogoutAt: Date.now() }, () => resolve());
  });

const clearForcedLogoutFlag = () =>
  new Promise<void>(resolve => {
    chrome.storage.local.remove('scrollwiseForceLogoutAt', () => resolve());
  });

const processUploadQueue = (reason: 'alarm' | 'enqueue') => {
  const schedule = async () => {
    const auth = await getAuthState();
    if (!auth?.accessToken) {
      return;
    }

    const result = await sendEventsToApi(auth, { onTokensUpdated: broadcastAuthUpdate });
    if (result?.sentIds?.length) {
      chrome.runtime
        .sendMessage({ type: 'SUMMARY_INVALIDATE' })
        .catch(() => undefined);
    }

    if (result?.hasMore || result?.requestAuthRefresh) {
      uploadQueued = true;
    }
  };

  if (uploadInFlight) {
    uploadQueued = true;
    return;
  }

  uploadInFlight = schedule()
    .catch(error => {
      console.warn(`[scrollwise] upload failed (${reason})`, error);
    })
    .finally(() => {
      uploadInFlight = null;
      if (uploadQueued) {
        uploadQueued = false;
        processUploadQueue('enqueue');
      }
    });
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(TRACKING_ALARM, { periodInMinutes: 1 });
});

chrome.runtime.onStartup.addListener(async () => {
  await syncTrackingFlag();
  const pending = await getQueuedEvents();
  if (pending.length) {
    processUploadQueue('alarm');
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'TRACKING_EVENT') {
    void enqueueEvents(message.payload)
      .then(async () => {
        processUploadQueue('enqueue');
        sendResponse({ ok: true });
      })
      .catch(error => sendResponse({ ok: false, error }));
    return true;
  }
  if (message.type === 'AUTH_UPDATE') {
    void setAuthState(message.payload)
      .then(async nextState => {
        await clearForcedLogoutFlag();
        await syncTrackingFlag();
        await broadcastAuthUpdate(nextState);
        processUploadQueue('enqueue');
        sendResponse({ ok: true });
      })
      .catch(error => sendResponse({ ok: false, error }));
    return true;
  }
  if (message.type === 'AUTH_LOGOUT') {
    clearAuthState()
      .then(async () => {
        await clearQueue();
        await syncTrackingFlag();
        await broadcastToTabs({ type: 'AUTH_LOGOUT_BROADCAST' });
        await setForcedLogoutFlag();
        sendResponse({ ok: true });
      })
      .catch(error => sendResponse({ ok: false, error }));
    return true;
  }
  if (message.type === 'AUTH_STATE_REQUEST') {
    void getAuthState()
      .then(state => sendResponse({ ok: true, state }))
      .catch(error => sendResponse({ ok: false, error: (error as Error)?.message ?? 'unknown' }));
    return true;
  }
  if (message.type === 'TRACKING_TOGGLE') {
    syncTrackingFlag().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message.type === 'TRACKING_STATUS_REQUEST') {
    void getAuthState()
      .then(state => {
        const enabled = Boolean(state?.trackingEnabled && state?.accessToken);
        sendResponse({ enabled });
      })
      .catch(error => sendResponse({ enabled: false, error: (error as Error)?.message ?? 'unknown' }));
    return true;
  }

  // Focus Mode Handlers
  if (message.type === 'FOCUS_START') {
    focusState = {
      ...focusState,
      isActive: true,
      endTime: message.payload.endTime,
      blocklist: message.payload.blocklist || []
    };
    broadcastToTabs({ type: 'FOCUS_STATE_UPDATE', payload: focusState });
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'FOCUS_STOP') {
    focusState = {
      ...focusState,
      isActive: false,
      endTime: 0,
      blocklist: []
    };
    broadcastToTabs({ type: 'FOCUS_STATE_UPDATE', payload: focusState });
    sendResponse({ ok: true });
    return true;
  }

  return false;
});

// Focus Mode State
let focusState = {
  isActive: false,
  endTime: 0,
  blocklist: [] as string[],
  dailyLimitMinutes: 30,
  usageMinutes: 0
};

const isBlocked = (url: string) => {
  try {
    const hostname = new URL(url).hostname;
    const isBlocklisted = focusState.blocklist.some(domain => hostname.includes(domain));

    if (!isBlocklisted) return false;

    // Logic:
    // 1. If Focus Session is ACTIVE (Strict Mode), BLOCK.
    // 2. If Daily Limit is EXCEEDED, BLOCK.
    // 3. Otherwise, ALLOW.

    if (focusState.isActive) {
      // If session is active, we block.
      // Wait, user said "when time gets over... blocked".
      // This implies session = allowed time?
      // Let's stick to the requested "Daily Limit" model.
      // If "Focus Session" is meant to be "Deep Work" (Block Now), then yes, block.
      // But if user wants "Session" to be "Allowed Time", then we should ALLOW if isActive.

      // Given the user's confusion, let's implement:
      // - "Focus Session" (Deep Work): Blocks everything immediately. (Current behavior)
      // - "Daily Limit": Blocks if usage > limit. (New behavior)

      // However, user said "why have you named this focus mode... it is like a blocking mode after specified time".
      // This implies they want the "Session" to be the "Allowed Time".

      // Let's try this hybrid:
      // If we are in a "Session", we are ALLOWED to browse (override limit?).
      // No, that defeats the purpose of a limit.

      // Let's just implement the Daily Limit check.
      // If usage > limit, block.
      // UNLESS... maybe a session overrides it?
      // Let's keep it simple: Daily Limit is a hard limit.

      return true; // Active session always blocks (Deep Work)
    }

    if (focusState.usageMinutes >= focusState.dailyLimitMinutes) {
      return true; // Daily limit exceeded
    }

    return false;
  } catch {
    return false;
  }
};

// Poll for stats to update usage
const updateFocusStats = async () => {
  const auth = await getAuthState();
  if (!auth?.accessToken) return;

  try {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/analytics/focus`, {
      headers: { Authorization: `Bearer ${auth.accessToken}` }
    });
    if (res.ok) {
      const data = await res.json();
      focusState.dailyLimitMinutes = data.settings?.dailyLimitMinutes || 30;
      focusState.usageMinutes = data.usageMinutes || 0;
      focusState.blocklist = data.settings?.blocklist || [];

      // CRITICAL FIX: Check all tabs immediately after updating stats
      // This ensures that if the limit is reached while browsing, the site is blocked immediately.
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.id && tab.url && isBlocked(tab.url)) {
          chrome.tabs.sendMessage(tab.id, { type: 'SHOW_BLOCK_OVERLAY' }).catch(() => undefined);
        }
      }
    }
  } catch (e) {
    console.error('Failed to update focus stats', e);
  }
};

// Poll every minute
chrome.alarms.create('focus-stats-poll', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'focus-stats-poll') {
    updateFocusStats();
  }
});
// Initial fetch
updateFocusStats();

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Check on loading and complete to catch it early and ensure it sticks
  if ((changeInfo.status === 'loading' || changeInfo.status === 'complete') && tab.url && isBlocked(tab.url)) {
    chrome.tabs.sendMessage(tabId, { type: 'SHOW_BLOCK_OVERLAY' }).catch(() => undefined);
  }
});

chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name !== TRACKING_ALARM) return;
  const pending = await getQueuedEvents();
  if (!pending.length) return;
  processUploadQueue('alarm');
});
