import mongoose from 'mongoose';
import DailyMetric from '../models/DailyMetric.js';
import TrackingEvent, { TrackingEventType } from '../models/TrackingEvent.js';
import User from '../models/User.js';
import { pixelsToClimbometers, pixelsToKilometers } from '../utils/scrollConversion.js';

interface RecordEventInput {
  type: TrackingEventType;
  durationMs?: number;
  scrollDistance?: number;
  scrollSpeed?: number;
  maxScrollDepth?: number;
  interactionType?: 'passive' | 'active';
  idempotencyKey?: string;
  url: string;
  domain: string;
  startedAt?: Date;
  metadata?: Record<string, unknown>;
}

export const recordEvents = async (userId: string, events: RecordEventInput[]) => {
  if (!events.length) return { stored: 0, acceptedKeys: [] };

  const user = await User.findById(userId).select('tracking');
  if (!user) {
    return { stored: 0, acceptedKeys: [] };
  }

  if (user.tracking?.paused) {
    return { stored: 0, acceptedKeys: [], trackingPaused: true };
  }

  // Convert to DB docs and split those with idempotency keys and those without.
  const docsWithKey = events
    .filter(e => e.idempotencyKey)
    .map(e => ({
      userId: new mongoose.Types.ObjectId(userId),
      type: e.type,
      durationMs: e.durationMs,
      scrollDistance: e.scrollDistance,
      scrollSpeed: e.scrollSpeed,
      maxScrollDepth: e.maxScrollDepth,
      interactionType: e.interactionType,
      url: e.url,
      domain: e.domain,
      metadata: e.metadata ?? {},
      startedAt: e.startedAt ? new Date(e.startedAt) : undefined,
      idempotencyKey: e.idempotencyKey
    }));

  const docsNoKey = events
    .filter(e => !e.idempotencyKey)
    .map(e => ({
      userId: new mongoose.Types.ObjectId(userId),
      type: e.type,
      durationMs: e.durationMs,
      scrollDistance: e.scrollDistance,
      scrollSpeed: e.scrollSpeed,
      maxScrollDepth: e.maxScrollDepth,
      interactionType: e.interactionType,
      url: e.url,
      domain: e.domain,
      metadata: e.metadata ?? {},
      startedAt: e.startedAt ? new Date(e.startedAt) : undefined
    }));

  // Determine which idempotency keys already exist so we can avoid duplicates
  const providedKeys = docsWithKey.map(d => String(d.idempotencyKey));
  const acceptedKeys: string[] = [];
  try {
    let existingKeys: string[] = [];
    if (providedKeys.length) {
      const existing = await TrackingEvent.find({
        userId: new mongoose.Types.ObjectId(userId),
        idempotencyKey: { $in: providedKeys }
      })
        .select('idempotencyKey')
        .lean();
      existingKeys = existing.map(e => String((e as any).idempotencyKey));
    }

    const toInsertWithKey = docsWithKey.filter(d => !existingKeys.includes(String(d.idempotencyKey)));

    // Insert only the missing keyed docs
    if (toInsertWithKey.length) {
      await TrackingEvent.insertMany(toInsertWithKey, { ordered: false });
    }

    // Insert docs without keys
    if (docsNoKey.length) {
      await TrackingEvent.insertMany(docsNoKey, { ordered: false });
    }

    // The accepted keys are the union of existing + newly inserted
    acceptedKeys.push(...existingKeys, ...toInsertWithKey.map(d => String(d.idempotencyKey)));
  } catch (err) {
    console.warn('[tracking] partial failure inserting events', (err as Error).message ?? err);
  }

  const impactedDates = new Set<string>();
  const today = new Date().toISOString().slice(0, 10);
  impactedDates.add(today);

  events.forEach(event => {
    const sourceDate = event.startedAt ? new Date(event.startedAt) : new Date();
    impactedDates.add(sourceDate.toISOString().slice(0, 10));
  });

  await Promise.all([...impactedDates].map(date => aggregateDailyMetrics(userId, date)));

  const stored = (docsNoKey.length ?? 0) + (acceptedKeys.length ?? 0);

  if (stored > 0) {
    const latest = events[events.length - 1];
    await User.findByIdAndUpdate(userId, {
      $set: {
        'presence.lastEventAt': latest?.startedAt ?? new Date(),
        'presence.lastEventType': latest?.type,
        'presence.lastUrl': latest?.url,
        'presence.lastDomain': latest?.domain,
        'presence.lastDurationMs': latest?.durationMs ?? 0,
        'presence.lastScrollDistance': latest?.scrollDistance ?? 0,
        accountStatus: 'active'
      }
    }).catch(() => undefined);
  }

  return { stored, acceptedKeys };
};

export const getSummary = async (userId: string) => {
  const today = new Date().toISOString().slice(0, 10);
  const [existingMetric, weeklyData, totals] = await Promise.all([
    DailyMetric.findOne({ userId, date: today }).lean(),
    aggregateRange(userId, 7),
    TrackingEvent.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          durationMs: { $sum: '$durationMs' },
          scrollDistance: { $sum: '$scrollDistance' }
        }
      }
    ])
  ]);

  let todayMetric = existingMetric;
  const staleThresholdMs = 2 * 60 * 1000;
  const needsRefresh =
    !todayMetric ||
    !todayMetric.lastComputedAt ||
    Date.now() - new Date(todayMetric.lastComputedAt).getTime() > staleThresholdMs;

  if (needsRefresh) {
    await aggregateDailyMetrics(userId, today);
    todayMetric = await DailyMetric.findOne({ userId, date: today }).lean();
  }

  const totalsMap = totals.reduce<Record<string, { count: number; durationMs: number; scrollDistance: number }>>(
    (acc, item) => {
      acc[item._id as string] = {
        count: item.count ?? 0,
        durationMs: item.durationMs ?? 0,
        scrollDistance: item.scrollDistance ?? 0
      };
      return acc;
    },
    {}
  );

  // Add conversions to today's metric
  const todayWithConversions = todayMetric
    ? {
      ...todayMetric,
      totals: {
        ...todayMetric.totals,
        scrollDistanceCm: pixelsToClimbometers(todayMetric.totals?.scrollDistance ?? 0),
        scrollDistanceKm: pixelsToKilometers(todayMetric.totals?.scrollDistance ?? 0)
      }
    }
    : null;

  // Add conversions to weekly data
  const weeklyWithConversions = weeklyData.map(entry => ({
    ...entry,
    scrollDistanceCm: pixelsToClimbometers(entry.scrollDistance),
    scrollDistanceKm: pixelsToKilometers(entry.scrollDistance)
  }));

  return {
    today: todayWithConversions,
    weekly: weeklyWithConversions,
    totals: totalsMap
  };
};

const aggregateRange = async (userId: string, days: number) => {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const aggregate = await TrackingEvent.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        createdAt: { $gte: since }
      }
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
        },
        scrollDistance: {
          $sum: {
            $cond: [
              { $gt: [{ $ifNull: ['$scrollDistance', 0] }, 0] },
              { $ifNull: ['$scrollDistance', 0] },
              0
            ]
          }
        },
        activeMinutes: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ['$type', 'idle'] },
                  { $gt: [{ $ifNull: ['$durationMs', 0] }, 0] }
                ]
              },
              { $divide: [{ $ifNull: ['$durationMs', 0] }, 60000] },
              0
            ]
          }
        },
        clickCount: {
          $sum: {
            $cond: [{ $eq: ['$type', 'click'] }, 1, 0]
          }
        }
      }
    },
    { $sort: { '_id.date': 1 } }
  ]);

  return aggregate.map(entry => {
    const scrollDistance = entry.scrollDistance ?? 0;
    return {
      date: entry._id.date,
      scrollDistance,
      scrollDistanceCm: pixelsToClimbometers(scrollDistance),
      scrollDistanceKm: pixelsToKilometers(scrollDistance),
      activeMinutes: entry.activeMinutes ?? 0,
      clickCount: entry.clickCount ?? 0
    };
  });
};

export const getTimeline = async (userId: string) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return TrackingEvent.find({ userId, createdAt: { $gte: since } })
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();
};

export const getStreaks = async (userId: string) => {
  const metrics = await DailyMetric.find({ userId }).sort({ date: -1 }).limit(30).lean();
  let current = 0;
  let best = 0;

  metrics.forEach(metric => {
    const reached = (metric.totals?.activeMinutes ?? 0) >= 120;
    if (reached) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  });

  return { current, best };
};

export async function aggregateDailyMetrics(userId: string, date: string) {
  const from = new Date(`${date}T00:00:00.000Z`);
  const to = new Date(`${date}T23:59:59.999Z`);

  const aggregate = await TrackingEvent.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        createdAt: { $gte: from, $lte: to }
      }
    },
    {
      $group: {
        _id: null,
        scrollDistance: {
          $sum: {
            $cond: [
              { $gt: [{ $ifNull: ['$scrollDistance', 0] }, 0] },
              { $ifNull: ['$scrollDistance', 0] },
              0
            ]
          }
        },
        activeMinutes: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ['$type', 'idle'] },
                  { $gt: [{ $ifNull: ['$durationMs', 0] }, 0] }
                ]
              },
              { $divide: [{ $ifNull: ['$durationMs', 0] }, 60000] },
              0
            ]
          }
        },
        idleMinutes: {
          $sum: {
            $cond: [
              { $eq: ['$type', 'idle'] },
              { $divide: [{ $ifNull: ['$durationMs', 0] }, 60000] },
              0
            ]
          }
        },
        clickCount: {
          $sum: {
            $cond: [{ $eq: ['$type', 'click'] }, 1, 0]
          }
        },
        domains: {
          $push: {
            domain: '$domain',
            durationMs: '$durationMs',
            scrollDistance: {
              $cond: [
                { $gt: [{ $ifNull: ['$scrollDistance', 0] }, 0] },
                { $ifNull: ['$scrollDistance', 0] },
                0
              ]
            }
          }
        },
        hours: { $push: { hour: { $hour: '$createdAt' }, durationMs: '$durationMs' } }
      }
    }
  ]);

  const totals = aggregate[0];
  const domainMap = new Map<string, { domain: string; durationMs: number; scrollDistance: number }>();
  const hourMap = new Map<string, number>();

  totals?.domains?.forEach((item: { domain: string; durationMs: number; scrollDistance: number }) => {
    if (!item?.domain) {
      return;
    }
    const key = item.domain.toLowerCase();
    const current = domainMap.get(key) ?? { domain: item.domain, durationMs: 0, scrollDistance: 0 };
    current.durationMs += item.durationMs ?? 0;
    current.scrollDistance += item.scrollDistance ?? 0;
    domainMap.set(key, current);
  });

  totals?.hours?.forEach((item: { hour: number; durationMs: number }) => {
    const key = item.hour.toString();
    const prev = hourMap.get(key) ?? 0;
    hourMap.set(key, prev + (item.durationMs ?? 0));
  });

  const domainBreakdown = Array.from(domainMap.values())
    .filter(entry => (Number.isFinite(entry.durationMs) && entry.durationMs > 0) || entry.scrollDistance > 0)
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 25)
    .map(entry => ({
      domain: entry.domain,
      durationMs: Math.round(entry.durationMs),
      scrollDistance: Math.round(entry.scrollDistance)
    }));

  await DailyMetric.findOneAndUpdate(
    { userId, date },
    {
      totals: {
        scrollDistance: totals?.scrollDistance ?? 0,
        activeMinutes: totals?.activeMinutes ?? 0,
        idleMinutes: totals?.idleMinutes ?? 0,
        clickCount: totals?.clickCount ?? 0
      },
      breakdown: {
        domain: domainBreakdown,
        hour: Object.fromEntries(hourMap)
      },
      lastComputedAt: new Date()
    },
    { upsert: true, setDefaultsOnInsert: true }
  );
}
