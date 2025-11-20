const CHANNEL = 'scrollwise-web';

type AuthPayload = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl?: string;
  };
};

type BroadcastOptions = {
  activateTracking?: boolean;
};

const postMessageToExtension = (message: Record<string, unknown>) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.postMessage({ source: CHANNEL, ...message }, '*');
};

export const notifyExtensionAuth = (payload: AuthPayload, options?: BroadcastOptions) => {
  postMessageToExtension({
    type: 'AUTH_UPDATE',
    origin: 'web',
    payload: {
      ...payload,
      trackingEnabled: options?.activateTracking ? true : undefined
    }
  });
};

export const notifyExtensionLogout = () => {
  postMessageToExtension({ type: 'AUTH_LOGOUT', origin: 'web' });
};
