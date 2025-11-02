export interface AuthState {
  accessToken?: string;
  refreshToken?: string;
  user?: { id: string; displayName: string; email: string };
  trackingEnabled: boolean;
}

const STORAGE_KEY = 'scrollwise-auth';

export const getAuthState = async (): Promise<AuthState | undefined> => {
  const store = await chrome.storage.local.get(STORAGE_KEY);
  return store[STORAGE_KEY] as AuthState | undefined;
};

type AuthStateUpdate = Partial<AuthState>;

export const setAuthState = async (update: AuthStateUpdate) => {
  const current: AuthState = {
    trackingEnabled: false,
    ...(await getAuthState())
  };

  const next: AuthState = {
    accessToken: update.accessToken ?? current.accessToken,
    refreshToken: update.refreshToken ?? current.refreshToken,
    user: update.user ?? current.user,
    trackingEnabled: update.trackingEnabled ?? current.trackingEnabled
  };

  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return next;
};

export const clearAuthState = async () => {
  await chrome.storage.local.remove(STORAGE_KEY);
};

export const updateTrackingEnabled = async (enabled: boolean) => {
  await setAuthState({ trackingEnabled: enabled });
  await syncTrackingFlag();
};

export const syncTrackingFlag = async () => {
  const state = await getAuthState();
  const enabled = Boolean(state?.trackingEnabled && state?.accessToken);
  const tabs = await chrome.tabs.query({ url: '<all_urls>' });
  await Promise.all(
    tabs.map(tab =>
      tab.id
        ? chrome.tabs
            .sendMessage(tab.id, { type: 'SYNC_TRACKING', enabled })
            .catch(() => undefined)
        : Promise.resolve()
    )
  );
};
