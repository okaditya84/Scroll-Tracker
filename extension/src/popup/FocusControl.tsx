import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';

const API_URL = import.meta.env.VITE_API_URL;

interface FocusSettings {
    blocklist: string[];
    strictMode: boolean;
    dailyGoalMinutes: number;
}

interface FocusSession {
    startTime: string;
    endTime?: string;
    durationMinutes?: number;
    success?: boolean;
}

interface FocusStatsResponse {
    settings: FocusSettings;
    history: FocusSession[];
}

export const FocusControl = ({ token }: { token: string }) => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<FocusStatsResponse | null>(null);
    const [duration, setDuration] = useState(25);
    const [blocklistInput, setBlocklistInput] = useState('');
    const [view, setView] = useState<'main' | 'settings'>('main');

    const loadStats = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/analytics/focus`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setStats(data);
                if (data.settings) {
                    setBlocklistInput(data.settings.blocklist.join('\n'));
                }
            }
        } catch (err) {
            console.error('Failed to load focus stats', err);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        loadStats();
        const interval = setInterval(loadStats, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, [loadStats]);

    const activeSession = stats?.history.find(s => !s.endTime);

    const startSession = async () => {
        try {
            const res = await fetch(`${API_URL}/focus/session/start`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ durationMinutes: duration })
            });
            if (res.ok) {
                const data = await res.json();
                // Notify background script
                chrome.runtime.sendMessage({
                    type: 'FOCUS_START',
                    payload: {
                        endTime: Date.now() + (data.session.durationMinutes || 25) * 60000,
                        blocklist: stats?.settings.blocklist || []
                    }
                });
                loadStats();
            }
        } catch (err) {
            console.error('Failed to start session', err);
        }
    };

    const endSession = async () => {
        try {
            const res = await fetch(`${API_URL}/focus/session/end`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                chrome.runtime.sendMessage({ type: 'FOCUS_STOP' });
                loadStats();
            } else if (res.status === 403) {
                const err = await res.json();
                alert(err.error || 'Strict mode active');
            }
        } catch (err) {
            console.error('Failed to end session', err);
        }
    };

    const saveSettings = async () => {
        const blocklist = blocklistInput.split('\n').map(s => s.trim()).filter(Boolean);
        try {
            const res = await fetch(`${API_URL}/focus/settings`, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    blocklist,
                    strictMode: stats?.settings.strictMode,
                    dailyGoalMinutes: stats?.settings.dailyGoalMinutes
                })
            });
            if (res.ok) {
                loadStats();
                setView('main');
            }
        } catch (err) {
            console.error('Failed to save settings', err);
        }
    };

    const toggleStrictMode = async () => {
        if (!stats) return;
        try {
            await fetch(`${API_URL}/focus/settings`, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...stats.settings,
                    strictMode: !stats.settings.strictMode
                })
            });
            loadStats();
        } catch (err) {
            console.error('Failed to toggle strict mode', err);
        }
    };

    if (loading) return <div className="animate-pulse h-20 bg-slate-100 rounded-lg" />;

    if (view === 'settings') {
        return (
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 mb-4">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-sm">Focus Settings</h3>
                    <button onClick={() => setView('main')} className="text-xs text-blue-600">Back</button>
                </div>

                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium mb-1">Blocked Sites</label>
                        <textarea
                            className="w-full text-xs p-2 border rounded dark:bg-slate-800 dark:border-slate-700"
                            rows={4}
                            value={blocklistInput}
                            onChange={e => setBlocklistInput(e.target.value)}
                            placeholder="twitter.com"
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">Strict Mode</span>
                        <button
                            onClick={toggleStrictMode}
                            className={`w-8 h-4 rounded-full transition-colors ${stats?.settings.strictMode ? 'bg-blue-600' : 'bg-slate-300'}`}
                        >
                            <div className={`w-3 h-3 bg-white rounded-full transform transition-transform ${stats?.settings.strictMode ? 'translate-x-4' : 'translate-x-0.5'} mt-0.5`} />
                        </button>
                    </div>

                    <button
                        onClick={saveSettings}
                        className="w-full py-1.5 bg-slate-900 text-white text-xs rounded hover:bg-slate-800"
                    >
                        Save Settings
                    </button>
                </div>
            </div>
        );
    }

    return (
        <motion.div
            className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 mb-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
        >
            <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm flex items-center gap-2">
                    🎯 Focus Mode
                    {activeSession && <span className="text-[10px] bg-green-100 text-green-800 px-1.5 py-0.5 rounded-full">Active</span>}
                </h3>
                <button onClick={() => setView('settings')} className="text-xs text-slate-500 hover:text-slate-900">
                    ⚙️
                </button>
            </div>

            {activeSession ? (
                <div className="text-center py-2">
                    <div className="text-2xl font-bold mb-1">
                        {Math.max(0, Math.ceil((new Date(activeSession.startTime).getTime() + (activeSession.durationMinutes || 25) * 60000 - Date.now()) / 60000))}m
                    </div>
                    <p className="text-xs text-slate-500 mb-3">remaining</p>
                    <button
                        onClick={endSession}
                        disabled={stats?.settings.strictMode}
                        className="w-full py-2 bg-red-50 text-red-600 text-xs font-semibold rounded hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {stats?.settings.strictMode ? 'Locked (Strict Mode)' : 'End Session'}
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            value={duration}
                            onChange={e => setDuration(Number(e.target.value))}
                            className="w-16 text-xs p-1.5 border rounded text-center dark:bg-slate-800 dark:border-slate-700"
                            min="1"
                            max="180"
                        />
                        <span className="text-xs text-slate-500">minutes</span>
                    </div>
                    <button
                        onClick={startSession}
                        className="w-full py-2 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700"
                    >
                        Start Focus Session
                    </button>
                </div>
            )}
        </motion.div>
    );
};
