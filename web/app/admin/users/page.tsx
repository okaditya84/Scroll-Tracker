"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

export default function AdminUsersPage() {
  const { accessToken, loading } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
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
        const res = await api.adminListUsers(accessToken, { page: 1, limit: 200 });
        if (mounted) setUsers(res.items ?? []);
      } catch (err: any) {
        setError(err?.message ?? 'Failed to load users');
      }
    })();
    return () => {
      mounted = false;
    };
  }, [accessToken, loading]);

  if (loading) return <div>Loading…</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Users</h1>
      <div className="overflow-auto rounded-lg border">
        <table className="min-w-full text-left">
          <thead>
            <tr>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Display name</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Created</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u._id} className="border-t">
                <td className="px-4 py-2">{u.email}</td>
                <td className="px-4 py-2">{u.displayName}</td>
                <td className="px-4 py-2">{u.role ?? 'user'}</td>
                <td className="px-4 py-2">{new Date(u.createdAt).toLocaleString()}</td>
                <td className="px-4 py-2 space-x-2">
                  {u.role !== 'admin' && u.role !== 'superadmin' && (
                    <button
                      onClick={async () => {
                        try {
                          await api.adminPromoteUser(accessToken!, u._id);
                          setUsers(prev => prev.map(p => (p._id === u._id ? { ...p, role: 'admin' } : p)));
                        } catch (err) {
                          alert('Promote failed');
                        }
                      }}
                      className="text-sm text-green-600"
                    >
                      Promote
                    </button>
                  )}
                  {u.role === 'admin' && (
                    <button
                      onClick={async () => {
                        try {
                          await api.adminDemoteUser(accessToken!, u._id);
                          setUsers(prev => prev.map(p => (p._id === u._id ? { ...p, role: 'user' } : p)));
                        } catch (err) {
                          alert('Demote failed');
                        }
                      }}
                      className="text-sm text-orange-600"
                    >
                      Demote
                    </button>
                  )}
                  {u.role !== 'superadmin' && (
                    <button
                      onClick={async () => {
                        if (!confirm('Delete user and all data? This cannot be undone.')) return;
                        try {
                          await api.adminDeleteUser(accessToken!, u._id);
                          setUsers(prev => prev.filter(p => p._id !== u._id));
                        } catch (err) {
                          alert('Delete failed');
                        }
                      }}
                      className="text-sm text-red-600"
                    >
                      Delete
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      try {
                        const blob = await api.adminExportEvents(accessToken!, { userId: u._id });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `events-${u._id}.csv`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(url);
                      } catch (err) {
                        alert('Export failed');
                      }
                    }}
                    className="text-sm text-blue-600"
                  >
                    Export
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
