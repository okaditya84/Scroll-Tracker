"use client";

import { ReactNode, createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { ApiError, api, type UserPayload } from '@/lib/api';
import { notifyExtensionAuth, notifyExtensionLogout } from '@/lib/extensionBridge';

const EXTENSION_CHANNEL = 'scrollwise-extension';

interface AuthContextState {
  accessToken?: string;
  refreshToken?: string;
  user?: UserPayload;
  loading: boolean;
  login: (payload: { accessToken: string; refreshToken: string; user: UserPayload }) => void;
  logout: () => Promise<void>;
  refresh: () => Promise<{ accessToken: string; refreshToken: string; user: UserPayload } | undefined>;
}

const AuthContext = createContext<AuthContextState | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [accessToken, setAccessToken] = useState<string | undefined>();
  const [refreshToken, setRefreshToken] = useState<string | undefined>();
  const [user, setUser] = useState<UserPayload | undefined>();
  const [loading, setLoading] = useState(true);

  const persistSession = useCallback(
    (payload: { accessToken: string; refreshToken: string; user: UserPayload }, options?: { activateTracking?: boolean }) => {
      setAccessToken(payload.accessToken);
      setRefreshToken(payload.refreshToken);
      setUser(payload.user);
      localStorage.setItem('scrollwise-auth', JSON.stringify(payload));

      notifyExtensionAuth(
        {
          accessToken: payload.accessToken,
          refreshToken: payload.refreshToken,
          user: {
            id: payload.user.id,
            email: payload.user.email,
            displayName: payload.user.displayName,
            avatarUrl: payload.user.avatarUrl
          }
        },
        options
      );
    },
    []
  );

  const clearSession = useCallback(() => {
    setAccessToken(undefined);
    setRefreshToken(undefined);
    setUser(undefined);
    localStorage.removeItem('scrollwise-auth');
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || typeof data !== 'object' || data.source !== EXTENSION_CHANNEL) {
        return;
      }

      if (data.type === 'AUTH_LOGOUT') {
        clearSession();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [clearSession]);

  useEffect(() => {
    const stored = localStorage.getItem('scrollwise-auth');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed?.accessToken && parsed?.refreshToken && parsed?.user) {
          persistSession(parsed, { activateTracking: false });
        }
      } catch (error) {
        localStorage.removeItem('scrollwise-auth');
      }
    }
    setLoading(false);
  }, [persistSession]);

  const login = useCallback(
    (payload: { accessToken: string; refreshToken: string; user: UserPayload }) => {
      persistSession(payload, { activateTracking: true });
    },
    [persistSession]
  );

  const logout = useCallback(async () => {
    const currentAccess = accessToken;
    const currentRefresh = refreshToken;

    try {
      if (currentAccess) {
        await api.logout(currentAccess, currentRefresh);
      }
    } catch (error) {
      console.warn('Failed to revoke session', error);
    } finally {
      clearSession();
      notifyExtensionLogout();
    }
  }, [accessToken, refreshToken, clearSession]);

  const refresh = useCallback(async () => {
    if (!refreshToken) {
      await logout();
      return undefined;
    }

    try {
      const next = await api.refresh({ refreshToken });
      const ensuredUser = user ?? (await api.me(next.tokens.accessToken).catch(() => undefined));

      if (!ensuredUser) {
        await logout();
        return undefined;
      }

      const payload = {
        accessToken: next.tokens.accessToken,
        refreshToken: next.tokens.refreshToken,
        user: ensuredUser
      };

      persistSession(payload, { activateTracking: false });
      return payload;
    } catch (error) {
      if (error instanceof ApiError && [400, 401, 403].includes(error.status)) {
        await logout();
        return undefined;
      }

      throw error;
    }
  }, [refreshToken, user, logout, persistSession]);

  const value = useMemo<AuthContextState>(
    () => ({ accessToken, refreshToken, user, loading, login, logout, refresh }),
    [accessToken, refreshToken, user, loading, login, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
};
