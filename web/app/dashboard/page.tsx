"use client";

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import WeeklyTrendChart from '@/components/weekly-trend-chart';
import SummaryTiles from '@/components/summary-tiles';

export default function DashboardPage() {
  const router = useRouter();
  const { accessToken, loading, logout, refresh } = useAuth();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!loading && !accessToken) {
      router.push('/login');
    }
  }, [loading, accessToken, router]);

  const runWithRefresh = useCallback(
    async <T,>(operation: (token: string) => Promise<T>) => {
      const currentToken = accessToken;
      if (!currentToken) {
        throw new Error('Missing access token');
      }

      try {
        return await operation(currentToken);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          const nextSession = await refresh().catch(() => undefined);
          if (nextSession?.accessToken) {
            return operation(nextSession.accessToken);
          }
        }

        throw error;
      }
    },
    [accessToken, refresh]
  );

  const handleRegenerateInsight = useCallback(async () => {
    try {
      await runWithRefresh(token => api.generateInsight(token, { regenerate: true }));
      queryClient.invalidateQueries({ queryKey: ['insights'] });
    } catch (error) {
      // Handle error if needed
    }
  }, [runWithRefresh, queryClient]);

  const handleLogout = useCallback(async () => {
    setSigningOut(true);
    try {
      await logout();
      router.push('/login');
    } finally {
      setSigningOut(false);
    }
  }, [logout, router]);

  const summaryQuery = useQuery({
    queryKey: ['summary'],
    queryFn: () => runWithRefresh(token => api.summary(token)),
    enabled: Boolean(accessToken),
    retry: (failureCount, error) => failureCount < 3 && !(error instanceof ApiError && error.status === 401),
    staleTime: 60_000,
    refetchInterval: 120_000,
    refetchIntervalInBackground: true
  });

  const insightsQuery = useQuery({
    queryKey: ['insights'],
    queryFn: () => runWithRefresh(token => api.insights(token)),
    enabled: Boolean(accessToken),
    retry: (failureCount, error) => failureCount < 3 && !(error instanceof ApiError && error.status === 401),
    staleTime: 60_000,
    refetchInterval: 120_000,
    refetchIntervalInBackground: true
  });

  if (!accessToken) {
    return null;
  }

  return (
    <main className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2">
            <p className="text-caption text-slate-600 dark:text-slate-400">Welcome back</p>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => router.push('/settings')}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 dark:border-slate-700 px-4 text-sm font-medium text-slate-700 dark:text-slate-300 transition hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30"
            >
              ⚙️ Settings
            </button>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 dark:border-slate-700 px-4 text-sm font-medium text-slate-700 dark:text-slate-300 transition hover:border-amber-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
            >
              {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
            </button>
            <button
              onClick={handleLogout}
              disabled={signingOut}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 dark:border-slate-700 px-4 text-sm font-medium text-slate-700 dark:text-slate-300 transition hover:border-red-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {signingOut ? 'Signing out…' : '🚪 Logout'}
            </button>
          </div>
        </header>
        <SummaryTiles summary={summaryQuery.data} loading={summaryQuery.isLoading} />
        <section className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <WeeklyTrendChart summary={summaryQuery.data} loading={summaryQuery.isLoading} />
          </div>
          <div>
            <div className="card card-light dark:card-dark p-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Daily Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-400">Idle time</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {Math.round(summaryQuery.data?.today?.totals?.idleMinutes ?? 0)} min
                  </span>
                </div>
                <div className="h-px bg-slate-200 dark:bg-slate-800" />
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  {summaryQuery.isLoading ? "Syncing..." : "Last updated just now"}
                </div>
              </div>
            </div>
          </div>
        </section>
        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Today&apos;s Insight</h2>
          <div className="space-y-4">
            {insightsQuery.isLoading ? (
              <div className="card card-light dark:card-dark h-32 animate-pulse p-4" />
            ) : insightsQuery.data?.insights && insightsQuery.data.insights.length > 0 ? (
              <>
                <article className="card card-light dark:card-dark p-6">
                  <div className="mb-3">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                      {insightsQuery.data.insights[0].title}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Generated{' '}
                      {insightsQuery.data.insights[0].createdAt &&
                        new Date(insightsQuery.data.insights[0].createdAt).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                    </p>
                  </div>
                  <div className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {insightsQuery.data.insights[0].body}
                  </div>
                </article>
                <button
                  onClick={handleRegenerateInsight}
                  className="w-full card card-light dark:card-dark py-3 px-4 font-medium text-slate-900 dark:text-white hover:shadow-md transition-shadow"
                >
                  ✨ Regenerate Insight
                </button>
              </>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 p-8 text-center dark:border-slate-800 dark:from-slate-900 dark:to-slate-800">
                <div className="text-4xl mb-3">✨</div>
                <h3 className="font-semibold text-slate-900 dark:text-white">No insight yet</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Keep scrolling—insights will appear once we gather enough data
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
    </main>
  );
}
