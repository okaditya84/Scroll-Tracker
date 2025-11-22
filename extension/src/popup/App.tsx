import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { AuthState } from '@/storage/auth';
import { getAuthState, updateTrackingEnabled } from '@/storage/auth';
import { FocusControl } from './FocusControl';

const API_URL = import.meta.env.VITE_API_URL;
const WEB_URL = import.meta.env.VITE_WEB_URL;

const sendRuntimeMessage = <T,>(message: unknown) =>
  new Promise<T | undefined>(resolve => {
    chrome.runtime.sendMessage(message, response => {
      if (chrome.runtime.lastError) {
        // eslint-disable-next-line no-console
        console.warn('runtime message error', chrome.runtime.lastError.message);
      }
      resolve(response as T);
    });
  });

const App = () => {
  const [auth, setAuth] = useState<AuthState | undefined>();
  const [summary, setSummary] = useState<any>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    getAuthState().then(state => {
      setAuth(state);
      setLoading(false);
    });

    const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName !== 'local' || !Object.prototype.hasOwnProperty.call(changes, 'scrollwise-auth')) {
        return;
      }
      const nextAuth = changes['scrollwise-auth'].newValue as AuthState | undefined;
      setAuth(nextAuth);
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  const loadSummary = useCallback(async (token: string) => {
    try {
      setSummaryLoading(true);
      setError(undefined);
      const response = await fetch(`${API_URL}/tracking/summary`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Unable to fetch summary');
      const payload = await response.json();
      setSummary(payload);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!auth?.accessToken) {
      setSummary(undefined);
      return;
    }
    void loadSummary(auth.accessToken);
  }, [auth?.accessToken, loadSummary]);

  useEffect(() => {
    if (!auth?.accessToken) {
      return undefined;
    }

    const handleRuntimeMessage = (message: any) => {
      if (message?.type === 'SUMMARY_INVALIDATE' && auth?.accessToken) {
        void loadSummary(auth.accessToken);
      }
    };

    chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    const interval = window.setInterval(() => {
      if (auth?.accessToken) {
        void loadSummary(auth.accessToken);
      }
    }, 45000);

    return () => {
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
      window.clearInterval(interval);
    };
  }, [auth?.accessToken, loadSummary]);

  const handleToggle = async (checked: boolean) => {
    if (!auth?.accessToken) {
      setError('Please sign in from the web dashboard to activate tracking.');
      return;
    }
    await updateTrackingEnabled(checked);
    setAuth(prev => (prev ? { ...prev, trackingEnabled: checked } : prev));
  };

  const handleLogin = () => {
    chrome.tabs.create({ url: `${WEB_URL}/login?ext=true` });
  };

  const handleLogout = async () => {
    if (!auth?.accessToken) {
      await sendRuntimeMessage({ type: 'AUTH_LOGOUT' });
      setAuth(undefined);
      setSummary(undefined);
      return;
    }

    setPending(true);
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.accessToken}`
        },
        body: JSON.stringify(auth.refreshToken ? { refreshToken: auth.refreshToken } : {})
      }).catch(() => undefined);
    } finally {
      await sendRuntimeMessage({ type: 'AUTH_LOGOUT' });
      setAuth(undefined);
      setSummary(undefined);
      setPending(false);
    }
  };

  const handleOpenLegal = (slug: 'terms' | 'privacy' | 'contact') => {
    chrome.tabs.create({ url: `${WEB_URL}/legal/${slug}` });
  };

  return (
    <div className="w-[340px] min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white px-4 py-5">
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Scrollwise" className="h-8 w-8" />
            <div>
              <h1 className="text-xl font-bold">Scrollwise</h1>
              <p className="text-xs text-slate-600 dark:text-slate-400">Track. Analyze. Optimize.</p>
            </div>
          </div>
        </div>
      </header>

      <div className="mb-4 text-xs text-slate-500 dark:text-slate-400">
        <div>Why permissions? We need storage to save queued events, tabs to sync tracking across pages, and alarms for periodic uploads.</div>
        <div>
          <button className="underline" onClick={() => chrome.runtime.openOptionsPage?.()}>Manage extension settings</button>
        </div>
      </div>

      {loading && (
        <div className="space-y-3">
          <div className="h-20 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
          <div className="h-12 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
        </div>
      )}

      {!loading && !auth?.accessToken && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4 text-sm text-slate-600 dark:text-slate-300">
          <p className="mb-2">Tracking is currently paused for this browser.</p>
          <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">If you previously signed in, your session may have expired — sign in again to reactivate tracking and resume uploads.</p>
          <button
            className="w-full rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
            onClick={handleLogin}
          >
            Sign in / Re-authenticate
          </button>
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            <button className="underline" onClick={() => chrome.runtime.openOptionsPage?.()}>Manage extension settings</button>
          </div>
        </div>
      )}

      {auth?.accessToken && (
        <>
          <FocusControl token={auth.accessToken} />

          <motion.div
            className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4 mb-4"
            animate={{ opacity: 1 }}
            initial={{ opacity: 0.5 }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex-1">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">Tracking Status</p>
                <p className="text-sm font-semibold mt-1">
                  {auth.trackingEnabled ? '🟢 Active' : '🔴 Paused'}
                </p>
              </div>
              <button
                onClick={() => handleToggle(!auth.trackingEnabled)}
                className={`flex items-center justify-center w-12 h-12 rounded-full transition-all ${auth.trackingEnabled
                  ? 'bg-blue-500 hover:bg-blue-600 text-white'
                  : 'bg-slate-300 dark:bg-slate-600 hover:bg-slate-400 dark:hover:bg-slate-700 text-slate-700 dark:text-white'
                  }`}
                title={auth.trackingEnabled ? 'Pause tracking' : 'Resume tracking'}
              >
                {auth.trackingEnabled ? (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Updates sync every minute across all tabs
            </p>
          </motion.div>

          {summary && (
            <section className="mb-4 space-y-2">
              {(() => {
                const totals = summary.today?.totals ?? {};
                const activeMinutes = Math.round(totals.activeMinutes ?? 0);
                const scrollDistance = Math.round(totals.scrollDistance ?? 0);
                const scrollDistanceCm = totals.scrollDistanceCm ?? 0;
                const scrollDistanceKm = totals.scrollDistanceKm ?? 0;
                const clickCount = Math.round(totals.clickCount ?? 0);

                // Format scroll distance for display
                const formatScroll = () => {
                  if (scrollDistanceKm >= 0.1) {
                    return `${scrollDistanceKm.toFixed(2)} km`;
                  }
                  return `${scrollDistanceCm.toFixed(1)} cm`;
                };

                return (
                  <>
                    <MetricCard
                      icon="⏱️"
                      title="Active"
                      value={summaryLoading ? '…' : `${activeMinutes}`}
                      unit="min"
                    />
                    <MetricCard
                      icon="📜"
                      title="Scroll"
                      value={summaryLoading ? '…' : formatScroll()}
                      unit={scrollDistanceKm >= 0.1 ? '(km)' : '(cm)'}
                      subtitle={`${(scrollDistance / 1000).toFixed(1)}k px`}
                    />
                    <MetricCard
                      icon="🖱️"
                      title="Clicks"
                      value={summaryLoading ? '…' : clickCount.toString()}
                      unit="taps"
                    />
                  </>
                );
              })()}
            </section>
          )}

          <div className="space-y-2">
            <button
              className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 py-2 text-sm font-semibold text-white transition"
              onClick={() => chrome.tabs.create({ url: `${WEB_URL}/dashboard` })}
            >
              View Dashboard
            </button>
            <button
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              onClick={handleLogout}
              disabled={pending}
            >
              {pending ? 'Signing out…' : 'Logout'}
            </button>
          </div>
        </>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950 px-3 py-2 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <footer className="mt-6 border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <div className="flex flex-wrap gap-3">
          <button className="underline" onClick={() => handleOpenLegal('terms')}>Terms</button>
          <button className="underline" onClick={() => handleOpenLegal('privacy')}>Privacy</button>
          <button className="underline" onClick={() => handleOpenLegal('contact')}>Contact</button>
        </div>
        <p className="mt-2">Need urgent help? Email hello@scrollwise.app and we’ll respond within a day.</p>
      </footer>
    </div>
  );
};

const MetricCard = ({ icon, title, value, unit, subtitle }: { icon: string; title: string; value: string; unit: string; subtitle?: string }) => (
  <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
    <div className="flex items-center gap-3">
      <span className="text-xl">{icon}</span>
      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{title}</span>
    </div>
    <div className="text-right">
      <span className="text-lg font-bold text-slate-900 dark:text-white">{value}</span>
      <span className="text-xs text-slate-500 dark:text-slate-500 ml-1">{unit}</span>
      {subtitle && <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{subtitle}</div>}
    </div>
  </div>
);

export default App;
