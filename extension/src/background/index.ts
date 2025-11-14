import { clearAuthState, getAuthState, setAuthState, syncTrackingFlag } from '@/storage/auth';
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

    const result = await sendEventsToApi(auth);
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
      .then(async () => {
        await clearForcedLogoutFlag();
        await syncTrackingFlag();
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
  return false;
});

chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name !== TRACKING_ALARM) return;
  const pending = await getQueuedEvents();
  if (!pending.length) return;
  processUploadQueue('alarm');
});
