"use client";

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { api, ApiError } from '@/lib/api';
import type { AdminUserRecord } from '@/lib/api';

export default function AdminUsersPage() {
  const router = useRouter();
  const { accessToken, loading, user, refresh } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paused' | 'admins' | 'active'>('all');
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

  const usersQuery = useQuery({
    queryKey: ['admin', 'users', search],
    queryFn: () => runWithAdminAuth(token => api.adminListUsers(token, { q: search, limit: 200 })),
    enabled: Boolean(accessToken) && isAdmin,
    staleTime: 30_000
  });

  const filteredUsers = useMemo(() => {
    const records = (usersQuery.data?.items ?? []) as AdminUserRecord[];
    return records.filter(record => {
      if (statusFilter === 'admins') {
        return record.role === 'admin' || record.role === 'superadmin';
      }
      if (statusFilter === 'paused') {
        return record.tracking?.paused;
      }
      if (statusFilter === 'active') {
        return !record.tracking?.paused && (record.presence?.lastEventAt ?? record.createdAt);
      }
      return true;
    });
  }, [usersQuery.data, statusFilter]);

  const handleTrackingToggle = async (record: AdminUserRecord, paused: boolean) => {
    await runWithAdminAuth(token => api.adminUpdateTracking(token, record.id ?? (record as any)._id, { paused }));
    usersQuery.refetch();
  };

  const handleRoleChange = async (record: AdminUserRecord, nextRole: 'promote' | 'demote') => {
    await runWithAdminAuth(token =>
      nextRole === 'promote'
        ? api.adminPromoteUser(token, record.id ?? (record as any)._id)
        : api.adminDemoteUser(token, record.id ?? (record as any)._id)
    );
    usersQuery.refetch();
  };

  const handleDelete = async (record: AdminUserRecord) => {
    if (!confirm(`Delete ${record.displayName}? This removes all tracking data.`)) return;
    await runWithAdminAuth(token => api.adminDeleteUser(token, record.id ?? (record as any)._id));
    usersQuery.refetch();
  };

  const handleExport = async (record: AdminUserRecord) => {
    const blob = await runWithAdminAuth(token => api.adminExportEvents(token, { userId: record.id ?? (record as any)._id }));
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `events-${record.id ?? record.email}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="p-10 text-center text-slate-500">Loading admin workspace…</div>;
  }

  if (!isAdmin) {
    return <div className="p-10 text-center text-red-500">Admin privileges required.</div>;
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-10 text-slate-900 dark:text-white">
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-slate-500">Admin</p>
            <h1 className="text-3xl font-semibold">Member roster</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Search, audit, and take action on every Scrollwise account.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <input
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              placeholder="Search email or name"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select
              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
            >
              <option value="all">All users</option>
              <option value="active">Active now</option>
              <option value="paused">Tracking paused</option>
              <option value="admins">Admins</option>
            </select>
          </div>
        </header>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <table className="min-w-full divide-y divide-slate-100 text-sm dark:divide-slate-800">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Tracking</th>
                <th className="px-4 py-3">Last activity</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredUsers.map(record => {
                const lastSeen = record.presence?.lastEventAt;
                const paused = record.tracking?.paused;
                const userId = record.id ?? (record as any)._id;
                return (
                  <tr key={userId} className="hover:bg-slate-50 dark:hover:bg-slate-900/70">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900 dark:text-white">{record.displayName}</p>
                      <p className="text-xs text-slate-500">{record.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-900/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-white/10 dark:text-white">
                        {record.role ?? 'user'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          paused ? 'bg-rose-500/20 text-rose-200' : 'bg-emerald-500/20 text-emerald-200'
                        }`}
                        onClick={() => handleTrackingToggle(record, !paused)}
                      >
                        {paused ? 'Paused — resume' : 'Active — pause'}
                      </button>
                      {record.tracking?.reason && <p className="mt-1 text-xs text-slate-400">{record.tracking.reason}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {lastSeen ? formatDistanceToNow(new Date(lastSeen), { addSuffix: true }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2 text-xs">
                        <button className="rounded-full border border-slate-200 px-3 py-1 text-slate-600 dark:border-slate-700 dark:text-slate-200" onClick={() => router.push(`/admin/users/${userId}`)}>
                          View detail
                        </button>
                        <button className="rounded-full border border-slate-200 px-3 py-1 text-slate-600 dark:border-slate-700 dark:text-slate-200" onClick={() => handleExport(record)}>
                          Export CSV
                        </button>
                        {record.role !== 'superadmin' && (
                          <button className="rounded-full border border-rose-200 px-3 py-1 text-rose-600 dark:border-rose-900/50 dark:text-rose-300" onClick={() => handleDelete(record)}>
                            Delete
                          </button>
                        )}
                        {record.role === 'admin' && record.role !== 'superadmin' && (
                          <button className="rounded-full border border-amber-200 px-3 py-1 text-amber-600 dark:border-amber-900/50 dark:text-amber-300" onClick={() => handleRoleChange(record, 'demote')}>
                            Demote
                          </button>
                        )}
                        {record.role === 'user' && (
                          <button className="rounded-full border border-emerald-200 px-3 py-1 text-emerald-600 dark:border-emerald-900/50 dark:text-emerald-300" onClick={() => handleRoleChange(record, 'promote')}>
                            Promote
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filteredUsers.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">
                    No users match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
