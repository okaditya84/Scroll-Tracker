import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Switch } from '@radix-ui/react-switch';
import type { AuthState } from '@/storage/auth';
import { getAuthState, updateTrackingEnabled } from '@/storage/auth';

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

const formatActiveCaption = (minutes: number) => {
  if (minutes <= 20) return 'Light session so far—short bursts like this are great.';
  if (minutes <= 120) return 'Solid pace. Staying under two hours keeps energy steady.';
  if (minutes <= 180) return 'You are in deep focus—plan a leg stretch within the next 15 minutes.';
  return 'Crossed the three-hour mark—schedule a longer screen break to reset.';
};

const formatScrollCaption = (pixels: number) => {
  // 96 pixels = 2.54 cm (standard web DPI)
  const cm = pixels * (2.54 / 96);
  const km = cm / 100000;

  if (km >= 0.1) {
    if (pixels <= 20000) return `Light scrolling—just ${(km * 1000).toFixed(1)} meters of content.`;
    if (pixels <= 60000) return `Nice scroll distance—about ${km.toFixed(2)} km worth of reading!`;
    if (pixels <= 120000) return `Impressive scroll—over ${km.toFixed(2)} km of content covered.`;
    return `Marathon scrolling—you've scrolled the equivalent of ${km.toFixed(1)} kilometers!`;
  }

  if (pixels <= 20000) return 'Gentle scrolling day—keep posture relaxed and continue pacing.';
  if (pixels <= 60000) return 'Healthy reading streak—stand up briefly every hour to stay fresh.';
  if (pixels <= 120000) return 'Big scroll session—roll your shoulders and rest your eyes for a minute.';
  return 'Huge scroll distance—step away for a longer reset to avoid fatigue.';
};

const formatClickCaption = (clicks: number) => {
  if (clicks <= 100) return 'Plenty of room for focused deep work—keep it steady.';
  if (clicks <= 250) return 'Steady clicking pace—stretch your fingers occasionally.';
  return 'High click count—use micro-breaks to prevent hand strain.';
};

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

  return (
    <div className="w-[340px] min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white px-4 py-5">
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="Scrollwise" className="h-8 w-8" />
            <div>
              <h1 className="text-xl font-bold">Scrollwise</h1>
              <p className="text-xs text-slate-600 dark:text-slate-400">Track. Analyze. Optimize.</p>
            </div>
          </div>
        </div>
      </header>

      {loading && (
        <div className="space-y-3">
          <div className="h-20 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
          <div className="h-12 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
        </div>
      )}

      {!loading && !auth?.accessToken && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4 text-sm text-slate-600 dark:text-slate-300">
          <p className="mb-4">Sign in to start tracking your scroll patterns and daily insights.</p>
          <button
            className="w-full rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
            onClick={handleLogin}
          >
            Sign in
          </button>
        </div>
      )}

      {auth?.accessToken && (
        <>
          <motion.div
            className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4 mb-4"
            animate={{ opacity: 1 }}
            initial={{ opacity: 0.5 }}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">Tracking Status</p>
                <p className="text-sm font-semibold mt-1">
                  {auth.trackingEnabled ? '🟢 Active' : '🔴 Paused'}
                </p>
              </div>
              <Switch
                className="relative inline-flex h-6 w-11 cursor-pointer rounded-full bg-slate-300 dark:bg-slate-700 data-[state=checked]:bg-blue-600"
                checked={auth.trackingEnabled}
                onCheckedChange={handleToggle}
              >
                <span className="sr-only">Toggle tracking</span>
              </Switch>
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

          <button
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            onClick={handleLogout}
            disabled={pending}
          >
            {pending ? 'Signing out…' : 'Logout'}
          </button>
        </>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950 px-3 py-2 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
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
