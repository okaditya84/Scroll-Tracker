"use client";

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function AnalyticsPage() {
    const router = useRouter();
    const { accessToken, loading, refresh } = useAuth();

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
        queryKey: ['analytics-dashboard'],
        queryFn: () => runWithRefresh(token => api.analyticsDashboard(token)),
        enabled: Boolean(accessToken),
        refetchInterval: 60000
    });

    if (!accessToken) return null;

    return (
        <main className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-white">
            <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold">Advanced Analytics</h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-2">Deep dive into your browsing habits and focus metrics.</p>
                </header>

                {isLoading ? (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 animate-pulse">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-32 rounded-xl bg-slate-100 dark:bg-slate-900" />
                        ))}
                    </div>
                ) : (
                    <div className="space-y-8">
                        {/* Key Metrics */}
                        <section className="grid gap-6 md:grid-cols-3">
                            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Avg Scroll Speed</h3>
                                <div className="mt-2 flex items-baseline gap-2">
                                    <span className="text-3xl font-bold">{Math.round(data?.scrollStats.avgScrollSpeed || 0)}</span>
                                    <span className="text-sm text-slate-500">px/s</span>
                                </div>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Distance</h3>
                                <div className="mt-2 flex items-baseline gap-2">
                                    <span className="text-3xl font-bold">{(data?.scrollStats.totalScrollDistance || 0).toLocaleString()}</span>
                                    <span className="text-sm text-slate-500">px</span>
                                </div>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Doom Scrolls Detected</h3>
                                <div className="mt-2 flex items-baseline gap-2">
                                    <span className="text-3xl font-bold text-red-500">{data?.doomScrolls.length || 0}</span>
                                    <span className="text-sm text-slate-500">sessions {'>'} 5m</span>
                                </div>
                            </div>
                        </section>

                        <div className="grid gap-8 lg:grid-cols-2">
                            {/* Most Visited Chart */}
                            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                <h3 className="mb-6 text-lg font-semibold">Most Visited Domains (7 Days)</h3>
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={data?.mostVisited || []} layout="vertical" margin={{ left: 40 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" opacity={0.2} />
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="domain" type="category" width={100} tick={{ fontSize: 12 }} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                                                cursor={{ fill: 'transparent' }}
                                            />
                                            <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </section>

                            {/* Activity Heatmap Chart */}
                            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                <h3 className="mb-6 text-lg font-semibold">Activity by Hour</h3>
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={data?.activityHeatmap || []}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                                            <XAxis dataKey="_id" tickFormatter={(val) => `${val}:00`} tick={{ fontSize: 12 }} />
                                            <YAxis hide />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                                                labelFormatter={(val) => `${val}:00 - ${val + 1}:00`}
                                            />
                                            <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </section>
                        </div>

                        {/* Doom Scroll List */}
                        {data?.doomScrolls && data.doomScrolls.length > 0 && (
                            <section className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-900/50 dark:bg-red-950/20">
                                <h3 className="mb-4 text-lg font-semibold text-red-700 dark:text-red-400">Doom Scroll Alerts</h3>
                                <div className="space-y-3">
                                    {data.doomScrolls.map((scroll) => (
                                        <div key={scroll._id} className="flex items-center justify-between rounded-lg bg-white p-4 shadow-sm dark:bg-slate-900">
                                            <div>
                                                <p className="font-medium text-slate-900 dark:text-white">{scroll.domain}</p>
                                                <p className="text-sm text-slate-500 truncate max-w-md">{scroll.url}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-red-600 dark:text-red-400">
                                                    {Math.round(scroll.durationMs / 60000)} min
                                                </p>
                                                <p className="text-xs text-slate-400">
                                                    {new Date(scroll.startedAt).toLocaleTimeString()}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>
                )}
            </div>
        </main>
    );
}
