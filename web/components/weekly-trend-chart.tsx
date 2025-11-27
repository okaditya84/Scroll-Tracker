"use client";

import { useTheme } from 'next-themes';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatScrollDistanceDetailed } from '@/lib/scrollConversion';

interface WeeklyTrendChartProps {
  summary: any;
  loading: boolean;
}

const WeeklyTrendChart = ({ summary, loading }: WeeklyTrendChartProps) => {
  const { theme } = useTheme();
  const data = summary?.weekly ?? [];

  const isDark = theme === 'dark';
  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const tooltipBg = isDark ? '#1e293b' : '#f1f5f9';
  const tooltipBorder = isDark ? '#334155' : '#cbd5e1';
  const tooltipText = isDark ? '#e2e8f0' : '#1e293b';
  const gridColor = isDark ? '#334155' : '#e2e8f0';

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div
          style={{
            background: tooltipBg,
            border: `1px solid ${tooltipBorder}`,
            borderRadius: 8,
            padding: '8px 12px',
            color: tooltipText
          }}
        >
          <p className="font-semibold">{dataPoint.date}</p>
          <p className="text-sm">Active: {Math.round(dataPoint.activeMinutes)} min</p>
          <p className="text-sm">
            Scroll: {Math.round(dataPoint.scrollDistance / 1000)}k px ({formatScrollDistanceDetailed(dataPoint.scrollDistance)})
          </p>
          <p className="text-sm">Clicks: {Math.round(dataPoint.clickCount)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="card card-light dark:card-dark p-6 shadow-sm">
      <header className="flex items-center justify-between mb-6">
        <div>
          <p className="text-caption text-slate-600 dark:text-slate-400">Weekly Overview</p>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-1">Activity Trend</h2>
        </div>
        {loading && <span className="text-xs text-slate-400 animate-pulse">Updating…</span>}
      </header>

      <div className="overflow-x-auto pb-2">
        <div className="h-64 min-w-[600px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <defs>
                <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorScroll" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ec4899" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#ec4899" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                stroke={axisColor}
                tick={{ fontSize: 12, fill: axisColor }}
                axisLine={{ stroke: gridColor }}
                tickLine={false}
              />
              <YAxis
                stroke={axisColor}
                tick={{ fontSize: 12, fill: axisColor }}
                axisLine={{ stroke: gridColor }}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="activeMinutes"
                stroke="#3b82f6"
                strokeWidth={2.5}
                dot={false}
                name="Active Minutes"
              />
              <Line
                type="monotone"
                dataKey="scrollDistance"
                stroke="#ec4899"
                strokeWidth={2}
                dot={false}
                name="Scroll Distance (px)"
                opacity={0.7}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-4 flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-slate-600 dark:text-slate-400">Active Minutes</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-pink-500" />
          <span className="text-slate-600 dark:text-slate-400">Scroll Distance (px / cm / km)</span>
        </div>
      </div>
    </div>
  );
};

export default WeeklyTrendChart;
