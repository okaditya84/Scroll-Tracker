"use client";

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import InsightsCalendar from '@/components/insights-calendar';

export default function SettingsPage() {
  const router = useRouter();
  const { accessToken, loading, logout, refresh } = useAuth();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('profile');
  const [formData, setFormData] = useState({
    displayName: '',
    timezone: '',
    avatarUrl: '',
    dailyGoalMinutes: 120,
    notificationsEnabled: true
  });

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

  const userQuery = useQuery({
    queryKey: ['user'],
    queryFn: () => runWithRefresh(token => api.me(token)),
    enabled: Boolean(accessToken)
  });

  const insightsQuery = useQuery({
    queryKey: ['insights'],
    queryFn: () => runWithRefresh(token => api.insights(token)),
    enabled: Boolean(accessToken)
  });

  useEffect(() => {
    if (userQuery.data) {
      setFormData({
        displayName: userQuery.data.displayName,
        timezone: userQuery.data.timezone || 'UTC',
        avatarUrl: userQuery.data.avatarUrl || '',
        dailyGoalMinutes: userQuery.data.habits?.dailyGoalMinutes || 120,
        notificationsEnabled: userQuery.data.habits?.notificationsEnabled ?? true
      });
    }
  }, [userQuery.data]);

  const updateProfileMutation = useMutation({
    mutationFn: (data: { displayName: string; timezone: string; avatarUrl: string }) =>
      runWithRefresh(token => api.updateProfile(token, data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
    }
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: (data: { dailyGoalMinutes: number; notificationsEnabled: boolean }) =>
      runWithRefresh(token => api.updatePreferences(token, data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
    }
  });

  const deleteAccountMutation = useMutation({
    mutationFn: () => runWithRefresh(token => api.deleteAccount(token)),
    onSuccess: async () => {
      await logout();
      router.push('/');
    }
  });

  const handleSave = () => {
    updateProfileMutation.mutate({
      displayName: formData.displayName,
      timezone: formData.timezone,
      avatarUrl: formData.avatarUrl
    });
    updatePreferencesMutation.mutate({
      dailyGoalMinutes: formData.dailyGoalMinutes,
      notificationsEnabled: formData.notificationsEnabled
    });
  };

  if (!accessToken) {
    return null;
  }

  return (
    <main className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8">
          <button
            onClick={() => router.push('/dashboard')}
            className="mb-4 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white">Settings</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">Manage your account and preferences</p>
        </header>

        {/* Tab Navigation */}
        <div className="mb-6 flex gap-2 border-b border-slate-200 dark:border-slate-800">
          {[
            { id: 'profile', label: '👤 Profile' },
            { id: 'preferences', label: '⚙️ Preferences' },
            { id: 'appearance', label: '🎨 Appearance' },
            { id: 'insights', label: '📊 Insights History' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 font-medium transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div>
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <section className="card card-light dark:card-dark p-6">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Profile Information</h2>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Timezone
                  </label>
                  <select
                    value={formData.timezone}
                    onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">Eastern Time</option>
                    <option value="America/Chicago">Central Time</option>
                    <option value="America/Denver">Mountain Time</option>
                    <option value="America/Los_Angeles">Pacific Time</option>
                  </select>
                </div>
                <div className="flex gap-3 justify-end pt-4">
                  <button
                    onClick={() => router.push('/dashboard')}
                    className="px-6 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={updateProfileMutation.isPending}
                    className="px-6 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition"
                  >
                    {updateProfileMutation.isPending ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
                <div className="mt-6 border-t pt-4">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Danger zone</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Deleting your account will remove all tracked events and insights.</p>
                  <button
                    onClick={() => deleteAccountMutation.mutate()}
                    disabled={deleteAccountMutation.isPending}
                    className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:bg-slate-400 transition"
                  >
                    {deleteAccountMutation.isPending ? 'Deleting…' : 'Delete account'}
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Preferences Tab */}
          {activeTab === 'preferences' && (
            <section className="card card-light dark:card-dark p-6">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Preferences</h2>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Daily Goal (minutes)
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="10"
                      max="480"
                      step="10"
                      value={formData.dailyGoalMinutes}
                      onChange={(e) => setFormData({ ...formData, dailyGoalMinutes: Number(e.target.value) })}
                      className="flex-1 h-2 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-lg font-semibold text-slate-900 dark:text-white w-20 text-right">
                      {formData.dailyGoalMinutes} min
                    </span>
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.notificationsEnabled}
                      onChange={(e) => setFormData({ ...formData, notificationsEnabled: e.target.checked })}
                      className="w-5 h-5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer"
                    />
                    <span className="font-medium text-slate-700 dark:text-slate-300">Enable Notifications</span>
                  </label>
                </div>
                <div className="flex gap-3 justify-end pt-4">
                  <button
                    onClick={() => router.push('/dashboard')}
                    className="px-6 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={updatePreferencesMutation.isPending}
                    className="px-6 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition"
                  >
                    {updatePreferencesMutation.isPending ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Appearance Tab */}
          {activeTab === 'appearance' && (
            <section className="card card-light dark:card-dark p-6">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Appearance</h2>
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                {theme === 'dark' ? '☀️ Switch to Light Mode' : '🌙 Switch to Dark Mode'}
              </button>
            </section>
          )}

          {/* Insights History Tab */}
          {activeTab === 'insights' && (
            <section>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Insights History</h2>
              <InsightsCalendar
                insights={insightsQuery.data?.insights ?? []}
                loading={insightsQuery.isLoading}
              />
            </section>
          )}
        </div>
      </div>
    </main>
  );
}