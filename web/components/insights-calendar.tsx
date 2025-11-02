"use client";

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Insight {
  _id: string;
  title: string;
  body: string;
  metricDate: string;
  createdAt?: string;
  updatedAt?: string;
  tags?: string[];
}

interface InsightsCalendarProps {
  insights: Insight[];
  loading: boolean;
}

const InsightsCalendar = ({ insights, loading }: InsightsCalendarProps) => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Group insights by date
  const insightsByDate = useMemo(() => {
    const grouped: Record<string, Insight[]> = {};
    insights.forEach(insight => {
      if (!grouped[insight.metricDate]) {
        grouped[insight.metricDate] = [];
      }
      grouped[insight.metricDate].push(insight);
    });
    return grouped;
  }, [insights]);

  // Get insights for selected date
  const selectedInsights = insightsByDate[selectedDate] || [];

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const prevLastDay = new Date(year, month, 0);

    const firstDayOfWeek = firstDay.getDay();
    const lastDayDate = lastDay.getDate();
    const prevLastDayDate = prevLastDay.getDate();

    const days = [];

    // Previous month's days
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevLastDayDate - i),
        isCurrentMonth: false,
        dateStr: new Date(year, month - 1, prevLastDayDate - i).toISOString().slice(0, 10)
      });
    }

    // Current month's days
    for (let i = 1; i <= lastDayDate; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
        dateStr: new Date(year, month, i).toISOString().slice(0, 10)
      });
    }

    // Next month's days
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
        dateStr: new Date(year, month + 1, i).toISOString().slice(0, 10)
      });
    }

    return days;
  }, [currentMonth]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch {
      return '';
    }
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const hasInsights = (dateStr: string) => dateStr in insightsByDate;
  const insightCount = (dateStr: string) => insightsByDate[dateStr]?.length || 0;

  const isToday = (dateStr: string) => {
    const today = new Date().toISOString().slice(0, 10);
    return dateStr === today;
  };

  const isSelected = (dateStr: string) => dateStr === selectedDate;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-96 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      {/* Calendar Section */}
      <div className="lg:col-span-1">
        <div className="card card-light dark:card-dark p-6 sticky top-8">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-900 dark:text-white">
              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h3>
            <div className="flex gap-1">
              <button
                onClick={prevMonth}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition text-slate-600 dark:text-slate-400"
              >
                ←
              </button>
              <button
                onClick={nextMonth}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition text-slate-600 dark:text-slate-400"
              >
                →
              </button>
            </div>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
              <div key={day} className="text-center text-xs font-semibold text-slate-600 dark:text-slate-400 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, idx) => {
              const hasData = hasInsights(day.dateStr);
              const count = insightCount(day.dateStr);
              const selected = isSelected(day.dateStr);
              const today = isToday(day.dateStr);

              return (
                <motion.button
                  key={idx}
                  onClick={() => setSelectedDate(day.dateStr)}
                  className={`
                    relative p-1.5 rounded-lg text-xs font-medium transition-all
                    ${!day.isCurrentMonth ? 'text-slate-400 dark:text-slate-600' : ''}
                    ${selected ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950' : ''}
                    ${today && !selected ? 'ring-2 ring-emerald-400' : ''}
                    ${hasData && !selected && !today ? 'bg-slate-100 dark:bg-slate-800' : ''}
                    ${!hasData && !selected && !today && day.isCurrentMonth ? 'hover:bg-slate-100 dark:hover:bg-slate-800' : ''}
                    ${day.isCurrentMonth ? 'text-slate-900 dark:text-white' : ''}
                  `}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span className="text-center block">{day.date.getDate()}</span>
                  {hasData && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 inline-flex h-1.5 w-1.5 rounded-full bg-blue-500" />
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-6 space-y-2 pt-6 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              <span className="text-slate-600 dark:text-slate-400">Has insights</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="h-3 w-3 rounded border-2 border-emerald-400" />
              <span className="text-slate-600 dark:text-slate-400">Today</span>
            </div>
          </div>
        </div>
      </div>

      {/* Insights Section */}
      <div className="lg:col-span-2">
        <div>
          <div className="mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              {formatDate(selectedDate)}
            </h3>
          </div>

          <AnimatePresence mode="popLayout">
            {selectedInsights.length > 0 ? (
              <div className="space-y-3">
                {selectedInsights
                  .sort((a, b) => {
                    const aTime = new Date(a.createdAt || 0).getTime();
                    const bTime = new Date(b.createdAt || 0).getTime();
                    return bTime - aTime;
                  })
                  .map((insight, idx) => (
                    <motion.article
                      key={insight._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ delay: idx * 0.05 }}
                      className="card card-light dark:card-dark p-4 overflow-hidden"
                    >
                      {/* Insight Header */}
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1">
                          <h4 className="font-semibold text-slate-900 dark:text-white line-clamp-2">
                            {insight.title}
                          </h4>
                        </div>
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {insight.createdAt ? formatTime(insight.createdAt) : ''}
                        </span>
                      </div>

                      {/* Insight Body */}
                      <div className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed">
                        {insight.body}
                      </div>

                      {/* Meta */}
                      <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                        <p className="text-xs text-slate-500 dark:text-slate-500">
                          {insight.createdAt ? new Date(insight.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          }) : 'No date'}
                        </p>
                      </div>
                    </motion.article>
                  ))}
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 p-8 text-center dark:border-slate-800 dark:from-slate-900 dark:to-slate-800"
              >
                <div className="text-4xl mb-3">📅</div>
                <h4 className="font-semibold text-slate-900 dark:text-white">No insights for this date</h4>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  Select a different date or check back later
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default InsightsCalendar;
