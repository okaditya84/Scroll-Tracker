"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

export default function AdminDashboard() {
  const { accessToken, loading } = useAuth();
  const [summary, setSummary] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!accessToken) {
      setError('Sign in as an admin to view this page.');
      return;
    }

    let mounted = true;
    (async () => {
      try {
        const data = await api.adminSummary(accessToken);
        if (mounted) setSummary(data);
      } catch (err: any) {
        setError(err?.message ?? 'Failed to load admin summary');
      }
    })();
    return () => {
      mounted = false;
    };
  }, [accessToken, loading]);

  if (loading) return <div>Loading…</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Admin dashboard</h1>
      {!summary && <div>Loading summary…</div>}
      {summary && (
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-lg border p-4">
            <div className="text-sm text-gray-500">Users</div>
            <div className="text-3xl font-semibold">{summary.users}</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-sm text-gray-500">Events</div>
            <div className="text-3xl font-semibold">{summary.events}</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-sm text-gray-500">Metrics</div>
            <div className="text-3xl font-semibold">{summary.metrics}</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-sm text-gray-500">Insights</div>
            <div className="text-3xl font-semibold">{summary.insights}</div>
          </div>
        </div>
      )}

      <div className="mt-6">
        <a href="/admin/users" className="text-blue-600 underline">View users</a>
      </div>
    </main>
  );
}
