"use client";

import { motion } from 'framer-motion';
import clsx from 'classnames';
import { getScrollDistanceData } from '@/lib/scrollConversion';

interface SummaryTilesProps {
  summary: any;
  loading: boolean;
}

const tileConfig = [
  {
    label: 'Active minutes',
    key: 'activeMinutes',
    format: (value: number) => `${Math.round(value)}`,
    unit: 'min',
    icon: '⏱️'
  },
  {
    label: 'Scroll distance',
    key: 'scrollDistance',
    format: (value: number) => {
      const data = getScrollDistanceData(value);
      return data.display;
    },
    unit: (value: number) => {
      const data = getScrollDistanceData(value);
      return data.km >= 0.1 ? 'km' : 'cm';
    },
    subtitle: (value: number) => {
      const data = getScrollDistanceData(value);
      return `${(value / 1000).toFixed(1)}k px`;
    },
    icon: '📜'
  },
  {
    label: 'Clicks',
    key: 'clickCount',
    format: (value: number) => `${Math.round(value)}`,
    unit: 'taps',
    icon: '🖱️'
  }
];

const SummaryTiles = ({ summary, loading }: SummaryTilesProps) => {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {tileConfig.map((tile, idx) => {
        const value = Number(summary?.today?.totals?.[tile.key] ?? 0);
        const unitValue = typeof tile.unit === 'function' ? tile.unit(value) : tile.unit;
        const subtitleValue = typeof tile.subtitle === 'function' ? tile.subtitle(value) : undefined;

        return (
          <motion.article
            key={tile.key}
            animate={{ opacity: loading ? 0.5 : 1, y: loading ? 4 : 0 }}
            transition={{ delay: idx * 0.1 }}
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{tile.label}</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">{tile.format(value)}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{unitValue}</p>
                </div>
                {subtitleValue && (
                  <p className="text-xs text-slate-400 mt-1">{subtitleValue}</p>
                )}
              </div>
              <div className="text-2xl opacity-80">{tile.icon}</div>
            </div>
          </motion.article>
        );
      })}
    </div>
  );
};

export default SummaryTiles;
