"use client";

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { api, ApiError } from '@/lib/api';
import type { AdminUserDetail } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

export default function AdminUserDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { accessToken, refresh, user, loading } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const runWithAdminAuth = useCallback(
    async <T,>(operation: (token: string) => Promise<T>) => {
      if (!accessToken) throw new Error('Missing token');
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

  const detailQuery = useQuery({
    queryKey: ['admin', 'user-detail', params.id],
    queryFn: () => runWithAdminAuth(token => api.adminGetUserDetail(token, params.id)),
    enabled: Boolean(accessToken) && isAdmin
  });

  if (loading) {
    return <div className="p-10 text-center text-slate-400">Loading profile…</div>;
  }

  if (!isAdmin) {
    return <div className="p-10 text-center text-red-500">Admin privileges required.</div>;
  }

  if (detailQuery.isError) {
    return (
      <div className="p-10 text-center text-red-500">
        {(detailQuery.error as Error)?.message ?? 'Unable to load user'}
      </div>
    );
  }

  const payload = detailQuery.data as AdminUserDetail | undefined;
  if (!payload) {
    return <div className="p-10 text-center text-slate-500">No data available.</div>;
  }

  const { user: subject, metrics, recentEvents, insights, audits } = payload;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 text-slate-900 dark:text-white">
      <button className="mb-6 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white" onClick={() => router.push('/admin/users')}>
        ← Back to roster
      </button>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Member overview</p>
            <h1 className="text-3xl font-semibold">{subject.displayName}</h1>
            <p className="text-sm text-slate-500">{subject.email}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-slate-900/10 px-3 py-1 text-slate-700 dark:bg-white/10 dark:text-white">{subject.role}</span>
            {subject.tracking?.paused && <span className="rounded-full bg-rose-500/20 px-3 py-1 text-rose-600 dark:text-rose-200">Tracking paused</span>}
            {subject.timezone && <span className="rounded-full bg-slate-200 px-3 py-1 text-slate-700 dark:bg-slate-800 dark:text-white">{subject.timezone}</span>}
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <InfoStat label="Joined" value={format(new Date(subject.createdAt), 'PPP')} />
          <InfoStat label="Last activity" value={subject.presence?.lastEventAt ? formatDistanceToNow(new Date(subject.presence.lastEventAt), { addSuffix: true }) : '—'} />
          <InfoStat label="Account status" value={subject.accountStatus ?? 'active'} />
          <InfoStat label="Tracking" value={subject.tracking?.paused ? 'Paused' : 'Active'} />
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-3">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 lg:col-span-2">
          <h2 className="text-lg font-semibold">Recent timeline</h2>
          <table className="mt-4 w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead>
              <tr>
                <th className="py-2">Type</th>
                <th>Domain</th>
                <th>Duration</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {recentEvents.slice(0, 10).map(event => (
                <tr key={event._id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="py-2 capitalize">{event.type}</td>
                  <td>{event.domain}</td>
                  <td>{event.durationMs ? `${Math.round(event.durationMs / 1000)}s` : '—'}</td>
                  <td>{formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}</td>
                </tr>
              ))}
              {!recentEvents.length && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-400">
                    No events recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </article>
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <h2 className="text-lg font-semibold">Latest insights</h2>
          <div className="mt-4 space-y-3 text-sm">
            {insights.slice(0, 3).map(insight => (
              <div key={insight._id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
                <p className="font-semibold">{insight.title}</p>
                <p className="text-xs text-slate-500">{formatDistanceToNow(new Date(insight.createdAt ?? insight.metricDate), { addSuffix: true })}</p>
              </div>
            ))}
            {!insights.length && <p className="text-slate-400">No insights generated.</p>}
          </div>
        </article>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <h2 className="text-lg font-semibold">Recent metrics</h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
            {metrics.slice(0, 7).map(metric => (
              <li key={metric._id ?? metric.date} className="flex items-center justify-between">
                <span>{format(new Date(metric.date), 'MMM d')}</span>
                <span>{Math.round(metric.totals?.activeMinutes ?? 0)} min active</span>
              </li>
            ))}
            {!metrics.length && <li className="text-slate-400">No metrics yet.</li>}
          </ul>
        </article>
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <h2 className="text-lg font-semibold">Audit log</h2>
          <ul className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-300">
            {audits.map(log => (
              <li key={log._id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
                <p className="font-semibold text-slate-700 dark:text-white">{log.action}</p>
                <p className="text-slate-500">{formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}</p>
              </li>
            ))}
            {!audits.length && <li className="text-slate-400">No admin actions recorded.</li>}
          </ul>
        </article>
      </section>
    </main>
  );
}

const InfoStat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{label}</p>
    <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{value}</p>
  </div>
);
