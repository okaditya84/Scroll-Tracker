"use client";

import { type ReactNode, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts';
import { format, formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { api, ApiError } from '@/lib/api';
import type { AdminUserRecord, InsightPayload } from '@/lib/api';

const compactNumber = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

const formatNumber = (value?: number) => compactNumber.format(value ?? 0);

export default function AdminDashboard() {
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

  const summaryQuery = useQuery({
    queryKey: ['admin', 'summary'],
    queryFn: () => runWithAdminAuth(token => api.adminSummary(token)),
    enabled: Boolean(accessToken) && isAdmin,
    staleTime: 30_000
  });

  const metricsQuery = useQuery({
    queryKey: ['admin', 'metrics'],
    queryFn: () => runWithAdminAuth(token => api.adminListMetrics(token, { limit: 45 })),
    enabled: Boolean(accessToken) && isAdmin,
    staleTime: 60_000
  });

  const eventsQuery = useQuery({
    queryKey: ['admin', 'events'],
    queryFn: () => runWithAdminAuth(token => api.adminListEvents(token, { limit: 200 })),
    enabled: Boolean(accessToken) && isAdmin,
    staleTime: 30_000
  });

  const usersQuery = useQuery({
    queryKey: ['admin', 'users', 'glance'],
    queryFn: () => runWithAdminAuth(token => api.adminListUsers(token, { limit: 50 })),
    enabled: Boolean(accessToken) && isAdmin,
    staleTime: 60_000
  });

  const insightsQuery = useQuery({
    queryKey: ['admin', 'insights'],
    queryFn: () => runWithAdminAuth(token => api.adminListInsights(token, { limit: 20 })),
    enabled: Boolean(accessToken) && isAdmin,
    staleTime: 60_000
  });

  const metricsSeries = useMemo(() => {
    const items = metricsQuery.data?.items ?? [];
    return [...items]
      .slice(-30)
      .map(metric => ({
        date: format(new Date(metric.date), 'MMM d'),
        activeMinutes: metric.totals?.activeMinutes ?? 0,
        scrollDistanceKm: (metric.totals?.scrollDistance ?? 0) / 1000,
        clickCount: metric.totals?.clickCount ?? 0
      }));
  }, [metricsQuery.data]);

  const activeMinutesTrend = useMemo(() => {
    if (metricsSeries.length < 14) return null;
    const recent = metricsSeries.slice(-7);
    const prior = metricsSeries.slice(-14, -7);
    const average = (arr: typeof metricsSeries) => arr.reduce((sum, item) => sum + item.activeMinutes, 0) / arr.length;
    const recAvg = average(recent);
    const prevAvg = average(prior);
    if (!prevAvg) return null;
    return ((recAvg - prevAvg) / prevAvg) * 100;
  }, [metricsSeries]);

  const avgActiveMinutes = useMemo(() => {
    const window = metricsSeries.slice(-7);
    if (!window.length) return 0;
    return Math.round(window.reduce((sum, item) => sum + item.activeMinutes, 0) / window.length);
  }, [metricsSeries]);

  const eventDistribution = useMemo(() => {
    const events = eventsQuery.data?.items ?? [];
    const counts: Record<string, number> = {};
    for (const event of events) {
      counts[event.type] = (counts[event.type] ?? 0) + 1;
    }
    const palette: Record<string, string> = {
      scroll: '#6366f1',
      click: '#22d3ee',
      idle: '#f97316',
      focus: '#10b981',
      blur: '#f43f5e'
    };
    return Object.entries(counts)
      .map(([type, value]) => ({ name: type, value, fill: palette[type] ?? '#94a3b8' }))
      .sort((a, b) => b.value - a.value);
  }, [eventsQuery.data]);

  const topDomains = useMemo(() => {
    const events = eventsQuery.data?.items ?? [];
    const domainCounts: Record<string, number> = {};
    for (const event of events) {
      if (!event.domain) continue;
      domainCounts[event.domain] = (domainCounts[event.domain] ?? 0) + 1;
    }
    return Object.entries(domainCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([domain, hits]) => ({ domain, hits }));
  }, [eventsQuery.data]);

  const newestUsers = useMemo(() => {
    const items = (usersQuery.data?.items ?? []) as AdminUserRecord[];
    return items
      .slice(0, 8)
      .map(userRecord => ({
        id: userRecord.id ?? userRecord._id ?? userRecord.email,
        name: userRecord.displayName ?? userRecord.email,
        email: userRecord.email,
        role: userRecord.role ?? 'user',
        createdAt: userRecord.createdAt,
        timezone: userRecord.timezone
      }));
  }, [usersQuery.data]);

  const highlightedInsights = useMemo(() => {
    const items = insightsQuery.data?.items ?? [];
    return items.slice(0, 4);
  }, [insightsQuery.data]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 to-slate-900 text-white">Preparing console…</div>;
  }

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-16 text-center">
        <div className="rounded-3xl border border-red-500/30 bg-red-500/5 p-10">
          <p className="text-sm uppercase tracking-[0.4em] text-red-300">Restricted</p>
          <h1 className="mt-4 text-3xl font-semibold text-red-100">Admin privileges required</h1>
          <p className="mt-3 text-red-200/80">Ask a super admin to elevate your account.</p>
        </div>
      </main>
    );
  }

  const summary = summaryQuery.data;
  const blockingError = [summaryQuery, metricsQuery, eventsQuery, usersQuery, insightsQuery].find(query => query.isError)?.error as
    | Error
    | undefined;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900/95 to-slate-900 px-6 py-10 text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-10">
        <header className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/5 px-8 py-10 backdrop-blur">
          <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-emerald-500/20 to-transparent blur-3xl" />
          <p className="text-xs uppercase tracking-[0.4em] text-emerald-200">Scrollwise Admin</p>
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-4xl font-semibold">Operations cockpit</h1>
              <p className="mt-3 max-w-2xl text-slate-200/80">
                Monitor platform health, understand engagement patterns, and take action on member accounts with a single glance.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/admin/users')}
                className="rounded-2xl border border-white/20 px-4 py-2 text-sm font-medium text-white transition hover:border-white/40"
              >
                Manage users
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="rounded-2xl bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white"
              >
                View customer view
              </button>
            </div>
          </div>
        </header>

        {blockingError && <ErrorNotice message={blockingError.message ?? 'Unable to load admin data right now.'} />}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total members"
            icon="👥"
            value={formatNumber(summary?.users)}
            helper="Across all plans"
          />
          <StatCard
            label="Tracking events"
            icon="📡"
            value={formatNumber(summary?.events)}
            helper="Lifetime signals captured"
          />
          <StatCard
            label="Avg. active minutes (7d)"
            icon="⏱"
            value={`${avgActiveMinutes}m`}
            trend={activeMinutesTrend ?? undefined}
            helper="Compared to prior week"
          />
          <StatCard
            label="Insights published"
            icon="✨"
            value={formatNumber(summary?.insights)}
            helper="AI-written nudges delivered"
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <Panel title="Platform health" description="Daily momentum across Scrollwise">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metricsSeries} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="activeMinutes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" stopOpacity={0.85} />
                      <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="scrollDistance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#818cf8" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 14 }}
                    labelStyle={{ color: '#e2e8f0' }}
                  />
                  <Area type="monotone" dataKey="activeMinutes" stroke="#34d399" fill="url(#activeMinutes)" strokeWidth={2} name="Active minutes" />
                  <Area type="monotone" dataKey="scrollDistanceKm" stroke="#818cf8" fill="url(#scrollDistance)" strokeWidth={2} name="Scroll distance (kpx)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Event mix" description="Latest 200 signals" className="lg:col-span-1">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="h-64 flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={eventDistribution}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={3}
                    >
                      {eventDistribution.map(entry => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 14 }}
                      labelStyle={{ color: '#e2e8f0' }}
                      formatter={(value: number, name: string) => [value, name.toUpperCase()]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="flex-1 space-y-3 text-sm">
                {eventDistribution.slice(0, 5).map(item => (
                  <li key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-2.5 w-2.5 rounded-full" style={{ background: item.fill }} />
                      <span className="capitalize text-slate-200">{item.name}</span>
                    </div>
                    <span className="font-medium text-slate-100">{item.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Panel>

          <Panel title="Top domains" description="Where users spend time" className="lg:col-span-1">
            <ul className="space-y-4 text-sm">
              {topDomains.map(domain => (
                <li key={domain.domain} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">{domain.domain}</p>
                    <p className="text-xs text-slate-400">{formatNumber(domain.hits)} signals</p>
                  </div>
                  <div className="text-right">
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">{domain.hits}</span>
                  </div>
                </li>
              ))}
              {!topDomains.length && <p className="text-slate-400">Not enough recent activity yet.</p>}
            </ul>
          </Panel>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Panel title="Newest members" description="Latest sign-ups">
            <UsersTable users={newestUsers} />
          </Panel>
          <Panel title="Latest insights" description="AI summarised nudges">
            <InsightsList insights={highlightedInsights} />
          </Panel>
        </section>
      </div>
    </main>
  );
}

const StatCard = ({ label, value, helper, trend, icon }: { label: string; value: string; helper?: string; trend?: number; icon?: string }) => {
  const trendPositive = (trend ?? 0) >= 0;
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
      <div className="flex items-center justify-between">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-300">{label}</p>
        {icon && <span className="text-xl" aria-hidden>{icon}</span>}
      </div>
      <div className="mt-4 text-4xl font-semibold">{value}</div>
      <div className="mt-2 flex items-center justify-between text-xs text-slate-300">
        <span>{helper}</span>
        {trend !== undefined && trend !== null && (
          <span className={trendPositive ? 'text-emerald-300' : 'text-rose-300'}>
            {trendPositive ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
};

const Panel = ({ title, description, children, className }: { title: string; description?: string; children: ReactNode; className?: string }) => (
  <section className={`rounded-[2.2rem] border border-white/10 bg-white/5 p-6 backdrop-blur ${className ?? ''}`}>
    <header className="mb-4">
      <h3 className="text-xl font-semibold text-white">{title}</h3>
      {description && <p className="text-sm text-slate-300">{description}</p>}
    </header>
    {children}
  </section>
);

const ErrorNotice = ({ message }: { message: string }) => (
  <div className="rounded-3xl border border-rose-500/40 bg-rose-500/10 px-6 py-4 text-sm text-rose-100 shadow-inner">
    {message}
  </div>
);

const UsersTable = ({ users }: { users: Array<{ id: string; name: string; email: string; role: string; createdAt?: string; timezone?: string }> }) => {
  if (!users.length) {
    return <p className="text-sm text-slate-400">No users yet.</p>;
  }
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10">
      <table className="min-w-full divide-y divide-white/5 text-sm">
        <thead>
          <tr className="bg-white/5 text-left text-xs uppercase tracking-[0.3em] text-slate-300">
            <th className="px-4 py-3">User</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Timezone</th>
            <th className="px-4 py-3">Joined</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {users.map(person => (
            <tr key={person.id} className="hover:bg-white/5">
              <td className="px-4 py-3">
                <p className="font-medium text-white">{person.name}</p>
                <p className="text-xs text-slate-400">{person.email}</p>
              </td>
              <td className="px-4 py-3">
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white">{person.role}</span>
              </td>
              <td className="px-4 py-3 text-slate-200">{person.timezone ?? '—'}</td>
              <td className="px-4 py-3 text-slate-200">{person.createdAt ? formatDistanceToNow(new Date(person.createdAt), { addSuffix: true }) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const InsightsList = ({ insights }: { insights: InsightPayload[] }) => {
  if (!insights.length) {
    return <p className="text-sm text-slate-400">No insights published yet.</p>;
  }
  return (
    <div className="space-y-4">
      {insights.map(insight => (
        <article key={insight._id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-semibold text-white">{insight.title}</h4>
            {insight.createdAt && (
              <span className="text-xs text-slate-400">{formatDistanceToNow(new Date(insight.createdAt), { addSuffix: true })}</span>
            )}
          </div>
          <p className="mt-2 text-sm text-slate-200 line-clamp-3">{insight.body}</p>
        </article>
      ))}
    </div>
  );
};
