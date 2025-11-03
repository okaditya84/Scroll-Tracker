import crypto from 'node:crypto';
import DailyMetric from '../models/DailyMetric.js';
import Insight from '../models/Insight.js';
import { callGroq, type GroqMessage } from '../utils/groqClient.js';
import {
  pixelsToClimbometers,
  pixelsToKilometers,
  formatScrollDistanceWithBoth,
  getScrollDistanceDescription
} from '../utils/scrollConversion.js';

const toMinutes = (valueMs?: number) => Math.round((valueMs ?? 0) / 60000);

type InsightContext = {
  date: string;
  totals: {
    activeMinutes: number;
    idleMinutes: number;
    scrollDistance: number;
    scrollDistanceCm: number;
    scrollDistanceKm: number;
    clickCount: number;
    activeGoalMinutes: number;
  };
  topDomains: Array<{
    domain: string;
    activeMinutes: number;
    sharePercent: number;
    scrollDistance: number;
    scrollDistanceCm: number;
    scrollDistanceKm: number;
  }>;
  peakHours: Array<{
    hour: number;
    activeMinutes: number;
  }>;
  coverage: {
    domainCount: number;
    hourCount: number;
  };
  flags: {
    lowActivity: boolean;
    extendedActivity: boolean;
    highScrollDistance: boolean;
    highClickCount: boolean;
  };
  derived: {
    activeVsGoalMinutes: number;
    scrollPerActiveMinute: number | null;
    scrollPerActiveMinuteCm: number | null;
    clicksPerActiveMinute: number | null;
    activeIdleRatio: number | null;
  };
};

export const getLatest = async (userId: string, limit = 10) => {
  const candidates = await Insight.find({ userId })
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(limit * 3)
    .lean();

  const unique: typeof candidates = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const key = `${candidate.metricDate}:${candidate.metricSignature ?? candidate.title}`;
    if (seen.has(key)) {
      continue;
    }
    unique.push(candidate);
    seen.add(key);
    if (unique.length >= limit) {
      break;
    }
  }

  return unique;
};

export const generateInsight = async (userId: string, metricDate?: string, regenerate = false) => {
  const date = metricDate ?? new Date().toISOString().slice(0, 10);
  const metric = await DailyMetric.findOne({ userId, date });
  if (!metric) {
    throw new Error('No metrics available for insights yet');
  }

  const totalActive = Math.round(metric.totals?.activeMinutes ?? 0);
  const totalIdle = Math.round(metric.totals?.idleMinutes ?? 0);
  const totalScroll = Math.round(metric.totals?.scrollDistance ?? 0);
  const totalClicks = Math.round(metric.totals?.clickCount ?? 0);

  const totalScrollCm = pixelsToClimbometers(totalScroll);
  const totalScrollKm = pixelsToKilometers(totalScroll);

  const topDomains = (metric.breakdown?.domain ?? [])
    .filter(entry => (entry?.durationMs ?? 0) > 0 || (entry?.scrollDistance ?? 0) > 0)
    .slice(0, 5)
    .map(entry => {
      const activeMinutes = toMinutes(entry.durationMs);
      const sharePercent = totalActive > 0 ? Math.round((activeMinutes / totalActive) * 100) : 0;
      const scrollDistance = Math.round(entry.scrollDistance ?? 0);
      return {
        domain: entry.domain,
        activeMinutes,
        sharePercent,
        scrollDistance,
        scrollDistanceCm: pixelsToClimbometers(scrollDistance),
        scrollDistanceKm: pixelsToKilometers(scrollDistance)
      };
    });

  const peakHours = Object.entries(metric.breakdown?.hour ?? {})
    .map(([hour, duration]) => ({
      hour: Number(hour),
      activeMinutes: toMinutes(typeof duration === 'number' ? duration : Number(duration ?? 0))
    }))
    .filter(entry => entry.activeMinutes > 0)
    .sort((a, b) => b.activeMinutes - a.activeMinutes)
    .slice(0, 4);

  const scrollPerActiveMinute = totalActive > 0 ? Math.round(totalScroll / totalActive) : null;
  const scrollPerActiveMinuteCm = totalActive > 0 ? pixelsToClimbometers(scrollPerActiveMinute ?? 0) : null;
  const clicksPerActiveMinute = totalActive > 0 ? Number((totalClicks / totalActive).toFixed(1)) : null;
  const activeVsGoal = totalActive - 120;

  const context: InsightContext = {
    date,
    totals: {
      activeMinutes: totalActive,
      idleMinutes: totalIdle,
      scrollDistance: totalScroll,
      scrollDistanceCm: Math.round(totalScrollCm * 10) / 10,
      scrollDistanceKm: Math.round(totalScrollKm * 10000) / 10000,
      clickCount: totalClicks,
      activeGoalMinutes: 120
    },
    topDomains,
    peakHours,
    coverage: {
      domainCount: metric.breakdown?.domain?.length ?? 0,
      hourCount: Object.keys(metric.breakdown?.hour ?? {}).length
    },
    flags: {
      lowActivity: totalActive < 10,
      extendedActivity: totalActive > 180,
      highScrollDistance: totalScroll > 90000,
      highClickCount: totalClicks > 250
    },
    derived: {
      activeVsGoalMinutes: activeVsGoal,
      scrollPerActiveMinute,
      scrollPerActiveMinuteCm,
      clicksPerActiveMinute,
      activeIdleRatio:
        totalIdle + totalActive > 0 ? Number(((totalActive / Math.max(totalIdle + totalActive, 1)) * 100).toFixed(1)) : null
    }
  };

  const signature = computeMetricSignature(context);
  const prompt: GroqMessage[] = [
    {
      role: 'system',
      content: `You are Scrollwise, a personable metrics coach. Craft exactly three sharply different analogies anchored in the provided data.\n- One analogy must focus on movement or distance using the exact scroll conversions supplied.\n- One must frame productivity or output (e.g. tasks completed, artifacts produced) using clicks or active minutes.\n- One must highlight wellbeing or pacing (e.g. breaks, rhythm, focus) using active vs idle minutes or peak hours.\nUse the top domains or peak hours when they add colour, and never repeat the same comparison category twice in a day. Quote the precise numbers you are given—do not invent new units. Keep the tone optimistic yet realistic, avoiding exaggerated feats (no flights of stairs unless maths supports it). ${regenerate ? 'Deliver three brand-new angles that do not reuse prior metaphors or sentence stems.' : ''} Stay under 160 words. Format as three bullet points starting with a single emoji.`
    },
    {
      role: 'user',
      content: `Metrics: Active minutes: ${totalActive}, Idle minutes: ${totalIdle}, Scroll distance: ${totalScroll} pixels (${formatScrollDistanceWithBoth(totalScroll)}), Clicks: ${totalClicks}. 
      
Top domains: ${topDomains.map(d => `${d.domain} (${d.activeMinutes} min, ${d.scrollDistance} px / ${d.scrollDistanceCm.toFixed(1)} cm)`).join(', ')}. 

Peak hours: ${peakHours.map(h => `${h.hour}:00 (${h.activeMinutes} min)`).join(', ')}.

Scroll distance context: You scrolled the equivalent of ${getScrollDistanceDescription(totalScroll)} today.`
    }
  ];

  const completion = await callGroq(prompt);
  const sanitized = sanitizeCompletion(completion) || completion.trim();
  const payload = {
    userId,
    title: deriveTitle(sanitized),
    body: sanitized,
    metricDate: date,
    tags: deriveTags(metric),
    metricSignature: signature
  };

  const latest = await Insight.findOne({ userId, metricDate: date })
    .sort({ updatedAt: -1, createdAt: -1 })
    .exec();

  if (latest && latest.metricSignature === signature) {
    latest.title = payload.title;
    latest.body = payload.body;
    latest.tags = payload.tags;
    latest.metricSignature = signature;
    latest.set('updatedAt', new Date());
    await latest.save();
    await trimDailyInsights(userId, date, 10);
    return latest;
  }

  const insight = await Insight.create(payload);
  await trimDailyInsights(userId, date, 10);
  return insight;
};

const deriveTitle = (text: string) => {
  const firstLine = text.split('\n').find(line => line.trim().length > 0) ?? 'Scroll update';
  return firstLine.length > 70 ? `${firstLine.slice(0, 67)}...` : firstLine;
};

const deriveTags = (metric: any) => {
  const tags: string[] = [];
  if ((metric.totals?.activeMinutes ?? 0) > 240) tags.push('marathon');
  if ((metric.totals?.scrollDistance ?? 0) > 5000) tags.push('deep-dive');
  if ((metric.totals?.idleMinutes ?? 0) < 30) tags.push('laser-focus');
  return tags;
};

const computeMetricSignature = (context: InsightContext) => {
  const significant = {
    date: context.date,
    totals: context.totals,
    topDomains: context.topDomains.map(entry => ({
      domain: entry.domain,
      activeMinutes: entry.activeMinutes,
      sharePercent: entry.sharePercent,
      scrollDistance: entry.scrollDistance,
      scrollDistanceCm: entry.scrollDistanceCm,
      scrollDistanceKm: entry.scrollDistanceKm
    })),
    peakHours: context.peakHours,
    derived: context.derived
  };

  return crypto.createHash('sha256').update(JSON.stringify(significant)).digest('hex');
};

const sanitizeCompletion = (text: string) => {
  const lines = text
    .split('\n')
    .map(line => line.replace(/\s+$/u, ''));

  const deduped: string[] = [];
  const seen = new Set<string>();

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      if (deduped.length === 0 || deduped[deduped.length - 1] === '') {
        continue;
      }
      deduped.push('');
      continue;
    }

    const normalized = trimmed.replace(/^[-*•]\s*/u, '').toLowerCase();
    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    deduped.push(rawLine.replace(/^\s+/u, ''));
  }

  return deduped.join('\n').replace(/\n{3,}/gu, '\n\n').trim();
};

const trimDailyInsights = async (userId: string, date: string, keep: number) => {
  const extras = await Insight.find({ userId, metricDate: date })
    .sort({ updatedAt: -1, createdAt: -1 })
    .skip(keep)
    .select('_id')
    .lean();

  if (!extras.length) {
    return;
  }

  await Insight.deleteMany({ _id: { $in: extras.map(entry => entry._id) } });
};
