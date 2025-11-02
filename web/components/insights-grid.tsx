"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Insight {
  _id: string;
  title: string;
  body: string;
  metricDate: string;
}

interface InsightsGridProps {
  insights: Insight[];
  loading: boolean;
  onRegenerate?: () => void;
}

const InsightsGrid = ({ insights, loading, onRegenerate }: InsightsGridProps) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  // Group insights by date
  const groupedInsights = insights.reduce((acc, insight) => {
    if (!acc[insight.metricDate]) {
      acc[insight.metricDate] = [];
    }
    acc[insight.metricDate].push(insight);
    return acc;
  }, {} as Record<string, Insight[]>);

  const sortedDates = Object.keys(groupedInsights).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
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

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      await onRegenerate?.();
    } finally {
      setRegenerating(false);
    }
  };

  if (!insights.length && !loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 p-8 text-center dark:border-slate-800 dark:from-slate-900 dark:to-slate-800">
        <div className="text-4xl mb-3">✨</div>
        <h3 className="font-semibold text-slate-900 dark:text-white">No insights yet</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Keep scrolling—insights will appear once we gather enough data
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AnimatePresence mode="popLayout">
        {sortedDates.map((date, dateIdx) => (
          <motion.section
            key={date}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ delay: dateIdx * 0.1 }}
          >
            <div className="mb-3 flex items-center gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {formatDate(date)}
              </h3>
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            </div>

            <div className="space-y-2">
              {groupedInsights[date].map((insight, insightIdx) => (
                <motion.article
                  key={insight._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: dateIdx * 0.1 + insightIdx * 0.05 }}
                  onClick={() => setExpandedId(expandedId === insight._id ? null : insight._id)}
                  className="card card-light dark:card-dark overflow-hidden p-4 cursor-pointer hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-900 dark:text-white line-clamp-2">
                        {insight.title}
                      </h4>
                      <AnimatePresence>
                        {expandedId === insight._id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-3 text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap"
                          >
                            {insight.body}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <span className="text-lg">
                      {expandedId === insight._id ? '−' : '+'}
                    </span>
                  </div>
                </motion.article>
              ))}
            </div>
          </motion.section>
        ))}
      </AnimatePresence>

      {insights.length > 0 && onRegenerate && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={handleRegenerate}
          disabled={regenerating}
          className="w-full card card-light dark:card-dark py-3 px-4 font-medium text-slate-900 dark:text-white hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {regenerating ? 'Generating new insight…' : '✨ Want to know more?'}
        </motion.button>
      )}

      {loading && (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="card card-light dark:card-dark h-20 animate-pulse p-4" />
          ))}
        </div>
      )}
    </div>
  );
};

export default InsightsGrid;
