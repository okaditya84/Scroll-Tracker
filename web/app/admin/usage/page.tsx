"use client";

import { type ReactNode, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format, formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { api, ApiError } from '@/lib/api';
import type { AdminUserRecord, DailyMetric } from '@/lib/api';

const compactNumber = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const formatNumber = (value?: number) => compactNumber.format(value ?? 0);

const USAGE_WINDOW_DAYS = 7;
const TIMELINE_WINDOW_DAYS = 21;

export default function AdminUsagePage() {
  const router = useRouter();
  const { accessToken, loading, user, refresh } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const runWithAdminAuth = useCallback(
    async <T,>(operation: (token: string) => Promise<T>) => {
      if (!accessToken) throw new Error('Missing access token');
      try {
        return await operation(accessToken);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          const next = await refresh().catch(() => undefined);
          if (next?.accessToken) {
            return operation(next.accessToken);
          }
        }
        throw error;
      }
    },
    [accessToken, refresh]
  );

  const metricsQuery = useQuery({
    queryKey: ['admin', 'usage', 'metrics'],
    queryFn: () => runWithAdminAuth(token => api.adminListMetrics(token, { limit: 400 })),
    enabled: Boolean(accessToken) && isAdmin,
    staleTime: 60_000
  });

  const usersQuery = useQuery({
    queryKey: ['admin', 'usage', 'users'],
    queryFn: () => runWithAdminAuth(token => api.adminListUsers(token, { limit: 400 })),
    enabled: Boolean(accessToken) && isAdmin,
    staleTime: 60_000
  });

  const metrics = useMemo(() => (metricsQuery.data?.items ?? []) as Array<DailyMetric & { userId?: string }>, [metricsQuery.data?.items]);
  const users = useMemo(() => (usersQuery.data?.items ?? []) as AdminUserRecord[], [usersQuery.data?.items]);
  const userMap = useMemo(() => {
    return new Map(users.map(record => [record.id ?? (record as any)._id ?? record.email, record]));
  }, [users]);

  const usageRows = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - USAGE_WINDOW_DAYS);

    const grouped = new Map<
      string,
      {
        userId: string;
        activeMinutes: number;
        scrollDistance: number;
        idleMinutes: number;
        clickCount: number;
        lastComputed?: Date;
      }
    >();

    metrics.forEach(metric => {
      const userId = metric.userId ?? (metric as any).userId ?? (metric as any).userId?._id;
      if (!userId) return;
      const metricDate = toDate(metric.date);
      const entry = grouped.get(userId) ?? {
        userId,
        activeMinutes: 0,
        scrollDistance: 0,
        idleMinutes: 0,
        clickCount: 0,
        lastComputed: undefined
      };
      if (metricDate >= cutoff) {
        entry.activeMinutes += metric.totals?.activeMinutes ?? 0;
        entry.scrollDistance += metric.totals?.scrollDistance ?? 0;
        entry.idleMinutes += metric.totals?.idleMinutes ?? 0;
        entry.clickCount += metric.totals?.clickCount ?? 0;
      }
      if (!entry.lastComputed || metricDate > entry.lastComputed) {
        entry.lastComputed = metricDate;
      }
      grouped.set(userId, entry);
    });

    return Array.from(grouped.values()).sort((a, b) => b.activeMinutes - a.activeMinutes);
  }, [metrics]);

  const timelineSeries = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() - TIMELINE_WINDOW_DAYS);
    const buckets = new Map<string, { label: string; activeMinutes: number; scrollKm: number }>();

    metrics.forEach(metric => {
      const metricDate = toDate(metric.date);
      if (metricDate < start) return;
      const key = metric.date ?? metricDate.toISOString().slice(0, 10);
      const bucket = buckets.get(key) ?? { label: format(metricDate, 'MMM d'), activeMinutes: 0, scrollKm: 0 };
      bucket.activeMinutes += metric.totals?.activeMinutes ?? 0;
      bucket.scrollKm += (metric.totals?.scrollDistance ?? 0) / 1000;
      buckets.set(key, bucket);
    });

    return Array.from(buckets.entries())
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([, value]) => ({ ...value, scrollKm: Number(value.scrollKm.toFixed(2)) }));
  }, [metrics]);

  const totalActiveMinutes = usageRows.reduce((sum, row) => sum + row.activeMinutes, 0);
  const totalScrollKm = usageRows.reduce((sum, row) => sum + row.scrollDistance, 0) / 1000;
  const avgMinutesPerMember = usageRows.length ? Math.round(totalActiveMinutes / usageRows.length) : 0;
  const spotlight = usageRows[0];

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">Loading analytics…</div>;
  }

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-16 text-center">
        <div className="rounded-3xl border border-red-500/40 bg-red-500/10 p-10 text-red-50">
          <p className="text-sm uppercase tracking-[0.4em]">Restricted</p>
          <h1 className="mt-4 text-3xl font-semibold">Admin access required</h1>
          <p className="mt-2 opacity-80">Ask a super admin to enable usage analytics.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900/95 to-slate-900 px-6 py-10 text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-10">
        <header className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/5 px-8 py-10 backdrop-blur">
          <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-sky-500/20 to-transparent blur-3xl" aria-hidden />
          <p className="text-xs uppercase tracking-[0.4em] text-sky-200">Usage intelligence</p>
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-4xl font-semibold">Customer usage</h1>
              <p className="mt-3 max-w-2xl text-slate-200/80">
                Understand how every member spends time in Scrollwise, surface heavy adopters, and spot dormant accounts before they churn.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => router.push('/admin')}
                className="rounded-2xl border border-white/20 px-4 py-2 text-sm font-medium text-white transition hover:border-white/40"
              >
                Back to cockpit
              </button>
              <button
                type="button"
                onClick={() => router.push('/admin/users')}
                className="rounded-2xl bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white"
              >
                Manage users
              </button>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <UsageStat label="Tracked members" value={formatNumber(usageRows.length)} helper="Seen in last 7 days" icon="👥" />
          <UsageStat label="Total active minutes" value={formatNumber(totalActiveMinutes)} helper="Across past week" icon="⏱" />
          <UsageStat label="Average per member" value={`${avgMinutesPerMember} min`} helper="Active minutes / member" icon="📊" />
          <UsageStat label="Scroll distance" value={`${totalScrollKm.toFixed(1)} km`} helper="Past week" icon="🌀" />
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <UsagePanel title="Engagement trend" description="Rolling 3-week window" className="lg:col-span-2">
            <div className="h-72 w-full">
              {timelineSeries.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timelineSeries} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="usage-active" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34d399" stopOpacity={0.85} />
                        <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="usage-scroll" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#818cf8" stopOpacity={0.8} />
                        <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis stroke="#94a3b8" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 14 }}
                      labelStyle={{ color: '#e2e8f0' }}
                      formatter={(value: number, name) => [value, name === 'activeMinutes' ? 'Active minutes' : 'Scroll (km)']}
                    />
                    <Area type="monotone" dataKey="activeMinutes" stroke="#34d399" fill="url(#usage-active)" strokeWidth={2} name="Active minutes" />
                    <Area type="monotone" dataKey="scrollKm" stroke="#818cf8" fill="url(#usage-scroll)" strokeWidth={2} name="Scroll (km)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-slate-400">Not enough data yet.</p>
              )}
            </div>
          </UsagePanel>

          <UsagePanel title="Heavy adopters" description="Top movers in past 7 days">
            <div className="space-y-3">
              {usageRows.slice(0, 6).map(row => {
                const record = userMap.get(row.userId);
                const name = record?.displayName ?? record?.email ?? 'Unknown member';
                const email = record?.email;
                return (
                  <button
                    key={row.userId}
                    type="button"
                    onClick={() => router.push(`/admin/users/${row.userId}`)}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:border-white/30"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-white">{name}</p>
                        {email && <p className="text-xs text-slate-400">{email}</p>}
                      </div>
                      <p className="text-sm text-emerald-200">{Math.round(row.activeMinutes)} min</p>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{(row.scrollDistance / 1000).toFixed(2)} km scrolled</p>
                  </button>
                );
              })}
              {!usageRows.length && <p className="text-sm text-slate-400">No tracked members yet.</p>}
            </div>
          </UsagePanel>
        </section>

        <UsagePanel title="Member usage detail" description="Rolling 7-day sums">
          <div className="overflow-hidden rounded-3xl border border-white/10">
            <table className="min-w-full divide-y divide-white/5 text-sm">
              <thead>
                <tr className="bg-white/5 text-left text-xs uppercase tracking-[0.3em] text-slate-300">
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Active minutes</th>
                  <th className="px-4 py-3">Scroll distance</th>
                  <th className="px-4 py-3">Idle minutes</th>
                  <th className="px-4 py-3">Clicks</th>
                  <th className="px-4 py-3">Last computed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {usageRows.map(row => {
                  const record = userMap.get(row.userId);
                  const name = record?.displayName ?? record?.email ?? 'Unknown member';
                  const email = record?.email ?? '—';
                  return (
                    <tr key={row.userId} className="hover:bg-white/5">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-white">{name}</p>
                        <p className="text-xs text-slate-400">{email}</p>
                      </td>
                      <td className="px-4 py-3 text-emerald-200">{Math.round(row.activeMinutes)} min</td>
                      <td className="px-4 py-3">{(row.scrollDistance / 1000).toFixed(2)} km</td>
                      <td className="px-4 py-3">{Math.round(row.idleMinutes)} min</td>
                      <td className="px-4 py-3">{row.clickCount}</td>
                      <td className="px-4 py-3 text-slate-300">
                        {row.lastComputed ? formatDistanceToNow(row.lastComputed, { addSuffix: true }) : '—'}
                      </td>
                    </tr>
                  );
                })}
                {!usageRows.length && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">
                      No usage has been recorded in the past week.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </UsagePanel>

        {spotlight && (
          <UsagePanel title="Spotlight" description="Most engaged member this week">
            {(() => {
              const record = userMap.get(spotlight.userId);
              if (!record) return <p className="text-sm text-slate-400">Member details unavailable.</p>;
              const domain = extractTopDomain(metrics.filter(metric => (metric.userId ?? (metric as any).userId) === spotlight.userId));
              return (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm uppercase tracking-[0.4em] text-slate-400">{record.role ?? 'user'}</p>
                      <h3 className="mt-2 text-2xl font-semibold text-white">{record.displayName ?? record.email}</h3>
                      <p className="text-sm text-slate-400">{record.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push(`/admin/users/${spotlight.userId}`)}
                      className="rounded-full border border-white/20 px-4 py-2 text-sm text-white transition hover:border-white/40"
                    >
                      View profile
                    </button>
                  </div>
                  <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    <SpotlightMetric label="Active minutes" value={`${Math.round(spotlight.activeMinutes)} min`} helper="Past 7 days" />
                    <SpotlightMetric label="Scroll distance" value={`${(spotlight.scrollDistance / 1000).toFixed(2)} km`} helper="Past 7 days" />
                    <SpotlightMetric label="Top domain" value={domain ?? '—'} helper="Most visited" />
                  </div>
                </div>
              );
            })()}
          </UsagePanel>
        )}
      </div>
    </main>
  );
}

const UsageStat = ({ label, value, helper, icon }: { label: string; value: string; helper?: string; icon?: string }) => (
  <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
    <div className="flex items-center justify-between">
      <p className="text-sm uppercase tracking-[0.3em] text-slate-300">{label}</p>
      {icon && <span className="text-xl" aria-hidden>{icon}</span>}
    </div>
    <div className="mt-4 text-4xl font-semibold">{value}</div>
    {helper && <p className="mt-2 text-xs text-slate-300">{helper}</p>}
  </div>
);

const UsagePanel = ({ title, description, children, className }: { title: string; description?: string; children: ReactNode; className?: string }) => (
  <section className={`rounded-[2.2rem] border border-white/10 bg-white/5 p-6 backdrop-blur ${className ?? ''}`}>
    <header className="mb-4">
      <h3 className="text-xl font-semibold text-white">{title}</h3>
      {description && <p className="text-sm text-slate-300">{description}</p>}
    </header>
    {children}
  </section>
);

const SpotlightMetric = ({ label, value, helper }: { label: string; value: string; helper?: string }) => (
  <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{label}</p>
    <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    {helper && <p className="mt-1 text-xs text-slate-400">{helper}</p>}
  </div>
);

const toDate = (value?: string) => {
  if (!value) return new Date(0);
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;
  return new Date(`${value}T00:00:00Z`);
};

const extractTopDomain = (metrics: Array<DailyMetric & { userId?: string }>) => {
  const domainCounts = new Map<string, number>();
  metrics.forEach(metric => {
    const breakdownDomains = Array.isArray((metric.breakdown as any)?.domain)
      ? ((metric.breakdown as any).domain as Array<{ domain: string; durationMs: number }>)
      : Object.entries(metric.breakdown?.domain ?? {}).map(([domain, durationMs]) => ({ domain, durationMs: Number(durationMs) }));
    breakdownDomains.forEach(entry => {
      if (!entry?.domain) return;
      domainCounts.set(entry.domain, (domainCounts.get(entry.domain) ?? 0) + (entry.durationMs ?? 0));
    });
  });
  const best = Array.from(domainCounts.entries()).sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : undefined;
};
