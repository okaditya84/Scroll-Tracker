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
    icon: '⏱️',
    color: 'from-blue-500 to-blue-600',
    bgLight: 'bg-blue-50 dark:bg-blue-950',
    textLight: 'text-blue-900 dark:text-blue-100',
    badgeLight: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
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
      const unit = data.km >= 0.1 ? 'km' : 'cm';
      return unit;
    },
    subtitle: (value: number) => {
      const data = getScrollDistanceData(value);
      return `${(value / 1000).toFixed(1)}k px`;
    },
    icon: '📜',
    color: 'from-fuchsia-500 to-fuchsia-600',
    bgLight: 'bg-fuchsia-50 dark:bg-fuchsia-950',
    textLight: 'text-fuchsia-900 dark:text-fuchsia-100',
    badgeLight: 'bg-fuchsia-100 dark:bg-fuchsia-900/40 text-fuchsia-700 dark:text-fuchsia-300'
  },
  {
    label: 'Clicks',
    key: 'clickCount',
    format: (value: number) => `${Math.round(value)}`,
    unit: 'taps',
    icon: '🖱️',
    color: 'from-emerald-500 to-emerald-600',
    bgLight: 'bg-emerald-50 dark:bg-emerald-950',
    textLight: 'text-emerald-900 dark:text-emerald-100',
    badgeLight: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
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
            className={clsx(
              'card card-light dark:card-dark p-5 shadow-sm hover:shadow-md',
              tile.bgLight
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-caption text-slate-600 dark:text-slate-400">{tile.label}</p>
                <div className="mt-3 flex items-baseline gap-2">
                  <p className={clsx('text-3xl font-bold', tile.textLight)}>{tile.format(value)}</p>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{unitValue}</p>
                </div>
                {subtitleValue && (
                  <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">{subtitleValue}</p>
                )}
              </div>
              <div className="text-3xl">{tile.icon}</div>
            </div>
          </motion.article>
        );
      })}
    </div>
  );
};

export default SummaryTiles;
