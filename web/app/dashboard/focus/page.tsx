"use client";

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, api, FocusSettings } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

export default function FocusPage() {
    const router = useRouter();
    const { accessToken, loading, refresh } = useAuth();
    const queryClient = useQueryClient();

    const [blocklistInput, setBlocklistInput] = useState('');
    const [strictMode, setStrictMode] = useState(false);
    const [dailyGoal, setDailyGoal] = useState(30);
    const [sessionDuration, setSessionDuration] = useState(25);

    useEffect(() => {
        if (!loading && !accessToken) {
            router.push('/login');
        }
    }, [loading, accessToken, router]);

    const runWithRefresh = useCallback(
        async <T,>(operation: (token: string) => Promise<T>) => {
            const currentToken = accessToken;
            if (!currentToken) throw new Error('Missing access token');
            try {
                return await operation(currentToken);
            } catch (error) {
                if (error instanceof ApiError && error.status === 401) {
                    const nextSession = await refresh().catch(() => undefined);
                    if (nextSession?.accessToken) return operation(nextSession.accessToken);
                }
                throw error;
            }
        },
        [accessToken, refresh]
    );

    const { data, isLoading } = useQuery({
        queryKey: ['focus-stats'],
        queryFn: () => runWithRefresh(token => api.focusStats(token)),
        enabled: Boolean(accessToken),
        refetchInterval: 5000 // Poll frequently for active session updates
    });

    // Initialize form state when data loads
    useEffect(() => {
        if (data?.settings) {
            setBlocklistInput(data.settings.blocklist.join('\n'));
            setStrictMode(data.settings.strictMode);
            setDailyGoal(data.settings.dailyGoalMinutes);
        }
    }, [data]);

    const activeSession = data?.history.find(s => !s.endTime);
    const history = data?.history.filter(s => s.endTime).reverse() || [];

    const updateSettingsMutation = useMutation({
        mutationFn: (settings: Partial<FocusSettings>) =>
            runWithRefresh(token => api.updateFocusSettings(token, settings)),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['focus-stats'] });
            alert('Settings saved!');
        },
        onError: (error) => alert(`Failed to save settings: ${error}`)
    });

    const startSessionMutation = useMutation({
        mutationFn: () => runWithRefresh(token => api.startSession(token, sessionDuration)),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['focus-stats'] });
        },
        onError: (error) => alert(`Failed to start session: ${error}`)
    });

    const endSessionMutation = useMutation({
        mutationFn: () => runWithRefresh(token => api.endFocusSession(token)),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['focus-stats'] });
        },
        onError: (error: any) => {
            if (error.status === 403) {
                alert(error.message || 'Strict mode is active. You cannot end the session early.');
            } else {
                alert(`Failed to end session: ${error}`);
            }
        }
    });

    const handleSaveSettings = () => {
        const blocklist = blocklistInput.split('\n').map(s => s.trim()).filter(Boolean);
        updateSettingsMutation.mutate({
            blocklist,
            strictMode,
            dailyGoalMinutes: dailyGoal
        });
    };

    if (!accessToken) return null;

    return (
        <main className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-white">
            <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold">Focus Mode</h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-2">Eliminate distractions and get deep work done.</p>
                </header>

                {isLoading ? (
                    <div className="animate-pulse space-y-6">
                        <div className="h-64 rounded-xl bg-slate-100 dark:bg-slate-900" />
                        <div className="h-64 rounded-xl bg-slate-100 dark:bg-slate-900" />
                    </div>
                ) : (
                    <div className="space-y-8">
                        {/* Active Session Card */}
                        {activeSession ? (
                            <section className="rounded-xl border border-blue-200 bg-blue-50 p-8 text-center dark:border-blue-900 dark:bg-blue-950/30">
                                <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-100 mb-2">Focus Session Active</h2>
                                <p className="text-blue-700 dark:text-blue-300 mb-6">
                                    Started at {new Date(activeSession.startTime).toLocaleTimeString()} • {activeSession.durationMinutes} min goal
                                </p>
                                <div className="flex justify-center gap-4">
                                    <button
                                        onClick={() => endSessionMutation.mutate()}
                                        disabled={endSessionMutation.isPending || (strictMode && !hasSessionEnded(activeSession))}
                                        className="rounded-xl bg-red-600 px-8 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {strictMode && !hasSessionEnded(activeSession) ? 'Locked (Strict Mode)' : 'End Session'}
                                    </button>
                                </div>
                                {strictMode && !hasSessionEnded(activeSession) && (
                                    <p className="mt-4 text-sm text-blue-600 dark:text-blue-400">
                                        Strict mode is on. You cannot stop until the timer finishes.
                                    </p>
                                )}
                            </section>
                        ) : (
                            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                <h2 className="mb-4 text-xl font-bold">Start a Session</h2>
                                <div className="flex items-end gap-4">
                                    <div className="flex-1">
                                        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                            Duration (minutes)
                                        </label>
                                        <input
                                            type="number"
                                            value={sessionDuration}
                                            onChange={(e) => setSessionDuration(Number(e.target.value))}
                                            min="1"
                                            max="180"
                                            className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                        />
                                    </div>
                                    <button
                                        onClick={() => startSessionMutation.mutate()}
                                        disabled={startSessionMutation.isPending}
                                        className="h-[42px] rounded-xl bg-blue-600 px-6 font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                                    >
                                        Start Focus
                                    </button>
                                </div>
                            </section>
                        )}

                        {/* Settings Card */}
                        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <h2 className="mb-6 text-xl font-bold">Focus Settings</h2>

                            <div className="space-y-6">
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Blocked Domains (one per line)
                                    </label>
                                    <textarea
                                        value={blocklistInput}
                                        onChange={(e) => setBlocklistInput(e.target.value)}
                                        rows={5}
                                        className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                        placeholder="facebook.com&#10;twitter.com&#10;reddit.com"
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Strict Mode</label>
                                        <p className="text-xs text-slate-500">Prevent ending sessions early</p>
                                    </div>
                                    <button
                                        onClick={() => setStrictMode(!strictMode)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${strictMode ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'
                                            }`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${strictMode ? 'translate-x-6' : 'translate-x-1'
                                                }`}
                                        />
                                    </button>
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Daily Focus Goal (minutes)
                                    </label>
                                    <input
                                        type="number"
                                        value={dailyGoal}
                                        onChange={(e) => setDailyGoal(Number(e.target.value))}
                                        className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                    />
                                </div>

                                <div className="pt-4">
                                    <button
                                        onClick={handleSaveSettings}
                                        disabled={updateSettingsMutation.isPending}
                                        className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 disabled:opacity-70"
                                    >
                                        {updateSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
                                    </button>
                                </div>
                            </div>
                        </section>

                        {/* History List */}
                        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <h2 className="mb-6 text-xl font-bold">Recent Sessions</h2>
                            <div className="space-y-4">
                                {history.length > 0 ? (
                                    history.slice(0, 5).map((session, i) => (
                                        <div key={i} className="flex items-center justify-between rounded-lg border border-slate-100 p-4 dark:border-slate-800">
                                            <div>
                                                <p className="font-medium text-slate-900 dark:text-white">
                                                    {new Date(session.startTime).toLocaleDateString()}
                                                </p>
                                                <p className="text-sm text-slate-500">
                                                    {new Date(session.startTime).toLocaleTimeString()}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-slate-900 dark:text-white">
                                                    {session.durationMinutes ? Math.round(session.durationMinutes) : 0} min
                                                </p>
                                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${session.success
                                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                    }`}>
                                                    {session.success ? 'Completed' : 'Interrupted'}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-center text-slate-500 py-8">No completed sessions yet.</p>
                                )}
                            </div>
                        </section>
                    </div>
                )}
            </div>
        </main>
    );
}

function hasSessionEnded(session: any) {
    if (!session || !session.startTime || !session.durationMinutes) return true;
    const end = new Date(session.startTime).getTime() + session.durationMinutes * 60000;
    return Date.now() >= end;
}
